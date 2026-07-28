(() => {
    'use strict';

    const supportedPaperPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        const reader = document.querySelector('#paperReader');
        const parameters = new URLSearchParams(window.location.search);
        const slug = parameters.get('paper') || '';

        if (!supportedPaperPattern.test(slug)) {
            renderError(reader, 'That draft paper could not be found.');
            return;
        }

        const sourcePath = `/draft-papers/papers/${slug}.tex`;

        try {
            const response = await fetch(sourcePath);

            if (!response.ok) {
                throw new Error('The LaTeX source could not be loaded.');
            }

            const source = await response.text();
            const paper = parseLatexPaper(source);

            document.title = `${paper.title} — Draft Papers`;
            const article = renderPaper(paper);

            reader.replaceChildren(article);

            if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
                await window.MathJax.typesetPromise([reader]);
            }
        } catch (error) {
            renderError(reader, error.message);
        }
    }

    function parseLatexPaper(source) {
        const normalized = source.replace(/\r\n?/g, '\n');
        const cleanSource = stripComments(normalized);
        const bodyMatch = cleanSource.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
        const title = readCommand(cleanSource, 'title') || 'Untitled Draft';
        const author = readCommand(cleanSource, 'author') || 'Unknown author';
        const date = readCommand(cleanSource, 'date') || '';
        let body = bodyMatch ? bodyMatch[1] : cleanSource;
        const abstractMatch = body.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
        const abstract = abstractMatch ? abstractMatch[1].trim() : '';

        body = body
            .replace(/\\maketitle/g, '')
            .replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/g, '');

        const bibliography = parseBibliography(body);
        body = body.replace(/\\begin\{thebibliography\}\{[^}]*\}[\s\S]*?\\end\{thebibliography\}/g, '');

        return {
            title,
            author,
            date,
            abstract,
            content: renderDocumentBody(body, bibliography.citationNumbers),
            references: bibliography.items
        };
    }

    function stripComments(source) {
        return source
            .split('\n')
            .map(line => line.replace(/(^|[^\\])%.*/, '$1'))
            .join('\n');
    }

    function readCommand(source, command) {
        const marker = `\\${command}`;
        const markerIndex = source.indexOf(marker);

        if (markerIndex < 0) {
            return '';
        }

        const openingIndex = source.indexOf('{', markerIndex + marker.length);

        if (openingIndex < 0) {
            return '';
        }

        let depth = 0;

        for (let index = openingIndex; index < source.length; index++) {
            if (source[index] === '{') {
                depth++;
            } else if (source[index] === '}') {
                depth--;

                if (depth === 0) {
                    return source.slice(openingIndex + 1, index).trim();
                }
            }
        }

        return '';
    }

    function parseBibliography(body) {
        const environment = body.match(/\\begin\{thebibliography\}\{[^}]*\}([\s\S]*?)\\end\{thebibliography\}/);
        const items = [];
        const citationNumbers = new Map();

        if (!environment) {
            return { items, citationNumbers };
        }

        const itemPattern = /\\bibitem\{([^}]+)\}([\s\S]*?)(?=\\bibitem\{|$)/g;
        let match;

        while ((match = itemPattern.exec(environment[1])) !== null) {
            const number = items.length + 1;
            const key = match[1].trim();

            citationNumbers.set(key, number);
            items.push({
                key,
                number,
                content: match[2].trim()
            });
        }

        return { items, citationNumbers };
    }

    function renderDocumentBody(body, citationNumbers) {
        const protectedBlocks = [];
        let workingBody = body;

        workingBody = protectEnvironment(workingBody, 'equation', content => (
            `<div class="paper-equation">\\[${escapeHtml(content.trim())}\\]</div>`
        ), protectedBlocks);
        workingBody = protectEnvironment(workingBody, 'equation*', content => (
            `<div class="paper-equation">\\[${escapeHtml(content.trim())}\\]</div>`
        ), protectedBlocks);
        workingBody = protectEnvironment(workingBody, 'align', content => (
            `<div class="paper-equation">\\[\\begin{aligned}${escapeHtml(content.trim())}\\end{aligned}\\]</div>`
        ), protectedBlocks);
        workingBody = protectEnvironment(workingBody, 'itemize', content => (
            renderList(content, false, citationNumbers)
        ), protectedBlocks);
        workingBody = protectEnvironment(workingBody, 'enumerate', content => (
            renderList(content, true, citationNumbers)
        ), protectedBlocks);

        workingBody = workingBody
            .replace(/\\section\{([^}]+)\}/g, (_, title) => protectBlock(
                `<h2>${renderInline(title, citationNumbers)}</h2>`,
                protectedBlocks
            ))
            .replace(/\\subsection\{([^}]+)\}/g, (_, title) => protectBlock(
                `<h3>${renderInline(title, citationNumbers)}</h3>`,
                protectedBlocks
            ))
            .replace(/\\subsubsection\{([^}]+)\}/g, (_, title) => protectBlock(
                `<h4>${renderInline(title, citationNumbers)}</h4>`,
                protectedBlocks
            ));

        return workingBody
            .split(/\n\s*\n/)
            .map(block => block.trim())
            .filter(Boolean)
            .map(block => {
                const protectedMatch = block.match(/^@@LATEX_BLOCK_(\d+)@@$/);

                if (protectedMatch) {
                    return protectedBlocks[Number(protectedMatch[1])];
                }

                return `<p>${renderInline(block.replace(/\s*\n\s*/g, ' '), citationNumbers)}</p>`;
            })
            .join('');
    }

    function protectEnvironment(source, environment, renderer, protectedBlocks) {
        const escapedEnvironment = environment.replace('*', '\\*');
        const pattern = new RegExp(
            `\\\\begin\\{${escapedEnvironment}\\}([\\s\\S]*?)\\\\end\\{${escapedEnvironment}\\}`,
            'g'
        );

        return source.replace(pattern, (_, content) => protectBlock(renderer(content), protectedBlocks));
    }

    function protectBlock(html, protectedBlocks) {
        const index = protectedBlocks.push(html) - 1;
        return `\n\n@@LATEX_BLOCK_${index}@@\n\n`;
    }

    function renderList(content, ordered, citationNumbers) {
        const tag = ordered ? 'ol' : 'ul';
        const items = content
            .split(/\\item\s+/)
            .map(item => item.trim())
            .filter(Boolean)
            .map(item => `<li>${renderInline(item.replace(/\s*\n\s*/g, ' '), citationNumbers)}</li>`)
            .join('');

        return `<${tag}>${items}</${tag}>`;
    }

    function renderInline(source, citationNumbers) {
        const math = [];
        let value = source
            .replace(/\\\(([\s\S]*?)\\\)/g, (_, expression) => protectMath(`\\(${expression}\\)`, math))
            .replace(/\$([^$\n]+)\$/g, (_, expression) => protectMath(`\\(${expression}\\)`, math));

        value = escapeHtml(value)
            .replace(/\\textbf\{([^{}]*)\}/g, '<strong>$1</strong>')
            .replace(/\\(?:textit|emph)\{([^{}]*)\}/g, '<em>$1</em>')
            .replace(/\\texttt\{([^{}]*)\}/g, '<code>$1</code>')
            .replace(/\\cite\{([^}]+)\}/g, (_, keys) => renderCitation(keys, citationNumbers))
            .replace(/\\label\{[^}]+\}/g, '')
            .replace(/\\LaTeX\b/g, '<span class="latex-logo">L<sup>A</sup>T<sub>E</sub>X</span>')
            .replace(/\\%/g, '%')
            .replace(/\\&amp;/g, '&amp;')
            .replace(/\\_/g, '_')
            .replace(/\\#/g, '#')
            .replace(/~/g, '&nbsp;')
            .replace(/\\\\/g, '<br>');

        math.forEach((expression, index) => {
            value = value.replace(`@@MATH_${index}@@`, expression);
        });

        return value;
    }

    function protectMath(expression, math) {
        const index = math.push(escapeHtml(expression)) - 1;
        return `@@MATH_${index}@@`;
    }

    function renderCitation(keys, citationNumbers) {
        const citations = keys.split(',').map(key => {
            const cleanKey = key.trim();
            const number = citationNumbers.get(cleanKey);

            return number
                ? `<a class="paper-citation" href="#ref-${escapeAttribute(cleanKey)}">${number}</a>`
                : '?';
        });

        return `[${citations.join(', ')}]`;
    }

    function renderPaper(paper) {
        const article = document.createElement('article');
        const header = document.createElement('header');
        const manuscriptStatus = document.createElement('p');
        const title = document.createElement('h1');
        const authors = document.createElement('div');
        const date = document.createElement('div');
        const abstract = document.createElement('section');
        const abstractTitle = document.createElement('strong');
        const abstractBody = document.createElement('p');
        const content = document.createElement('div');

        article.className = 'paper-sheet';
        article.classList.add('paper-style-ieee');
        header.className = 'paper-title-block';
        manuscriptStatus.className = 'paper-manuscript-status';
        manuscriptStatus.textContent = 'Preprint · Not peer reviewed';
        title.textContent = paper.title;
        authors.className = 'paper-authors';
        authors.innerHTML = renderInline(paper.author, new Map()).replace(/\\and/g, '<span class="author-separator">and</span>');
        date.className = 'paper-date';
        date.textContent = paper.date;

        abstract.className = 'paper-abstract';
        abstractTitle.textContent = 'Abstract';
        abstractBody.innerHTML = renderInline(paper.abstract, new Map());
        abstract.append(abstractTitle, abstractBody);

        content.className = 'paper-content';
        content.innerHTML = paper.content;

        header.append(manuscriptStatus, title, authors, date);
        article.append(header, abstract, content);

        if (paper.references.length > 0) {
            article.appendChild(renderReferences(paper.references));
        }

        return article;
    }

    function renderReferences(references) {
        const section = document.createElement('section');
        const title = document.createElement('h2');
        const list = document.createElement('ol');

        section.className = 'paper-references';
        title.textContent = 'References';

        references.forEach(reference => {
            const item = document.createElement('li');

            item.id = `ref-${reference.key}`;
            item.value = reference.number;
            item.innerHTML = renderInline(reference.content, new Map());
            list.appendChild(item);
        });

        section.append(title, list);
        return section;
    }

    function renderError(reader, message) {
        const error = document.createElement('div');

        error.className = 'paper-error';
        error.textContent = message;
        reader.replaceChildren(error);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeAttribute(value) {
        return String(value).replace(/[^a-zA-Z0-9_-]/g, '');
    }
})();
