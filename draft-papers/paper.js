(() => {
    'use strict';

    const supportedPaperPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const minimumContentsHeadings = 8;
    const minimumContentsWords = 4500;
    const localizedText = {
        en: {
            untitled: 'Untitled paper',
            unknownAuthor: 'Unknown author',
            defaultStatus: 'Preprint · This paper has not been peer reviewed',
            collectionTitle: 'Draft Papers',
            reference: 'Reference',
            authorSeparator: 'and',
            abstract: 'Abstract',
            references: 'References',
            contents: 'Contents',
            contentsContinuation: 'Contents — continued',
            page: 'Page'
        },
        mk: {
            untitled: 'Неименуван труд',
            unknownAuthor: 'Непознат автор',
            defaultStatus: 'Предобјава · Трудот не е рецензиран',
            collectionTitle: 'Научни трудови',
            reference: 'Референца',
            authorSeparator: 'и',
            abstract: 'Апстракт',
            references: 'Литература',
            contents: 'Содржина',
            contentsContinuation: 'Содржина — продолжение',
            page: 'Страница'
        }
    };
    let text = localizedText.en;

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        const reader = document.querySelector('#paperReader');
        const parameters = new URLSearchParams(window.location.search);
        const slug = parameters.get('paper') || '';

        if (!supportedPaperPattern.test(slug)) {
            renderError(reader, 'The paper was not found.');
            return;
        }

        const sourcePath = `/draft-papers/papers/${slug}.tex`;

        try {
            const response = await fetch(sourcePath);

            if (!response.ok) {
                throw new Error('The source LaTeX document could not be loaded.');
            }

            const source = await response.text();
            const paper = parseLatexPaper(source);
            const stagingPaper = renderStagingPaper(paper);

            document.documentElement.lang = paper.language;
            document.title = `${paper.title} — ${text.collectionTitle}`;
            reader.replaceChildren(stagingPaper);

            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }

            if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
                await window.MathJax.typesetPromise([stagingPaper]);
            }

            await nextLayoutFrame();
            paginatePaper(paper, stagingPaper, reader);
        } catch (error) {
            renderError(reader, error.message);
        }
    }

    function nextLayoutFrame() {
        return new Promise(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
    }

    function parseLatexPaper(source) {
        const normalized = source.replace(/\r\n?/g, '\n');
        const cleanSource = stripComments(normalized);
        const bodyMatch = cleanSource.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
        const language = readCommand(cleanSource, 'paperlanguage') === 'mk' ? 'mk' : 'en';
        text = localizedText[language];
        const title = readCommand(cleanSource, 'title') || text.untitled;
        const author = readCommand(cleanSource, 'author') || text.unknownAuthor;
        const date = readCommand(cleanSource, 'date') || '';
        const status = readCommand(cleanSource, 'paperstatus') || text.defaultStatus;
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
            language,
            status,
            abstract,
            content: renderDocumentBody(body, bibliography.citations),
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
        const citations = new Map();

        if (!environment) {
            return { items, citations };
        }

        const itemPattern = /\\bibitem\{([^}]+)\}([\s\S]*?)(?=\\bibitem\{|$)/g;
        let match;

        while ((match = itemPattern.exec(environment[1])) !== null) {
            const number = items.length + 1;
            const key = match[1].trim();
            const item = {
                key,
                number,
                content: match[2].trim()
            };

            citations.set(key, item);
            items.push(item);
        }

        return { items, citations };
    }

    function renderDocumentBody(body, citations) {
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
            renderList(content, false, citations)
        ), protectedBlocks);
        workingBody = protectEnvironment(workingBody, 'enumerate', content => (
            renderList(content, true, citations)
        ), protectedBlocks);

        workingBody = workingBody
            .replace(/\\section\{([^}]+)\}/g, (_, title) => protectBlock(
                `<h2>${renderInline(title, citations)}</h2>`,
                protectedBlocks
            ))
            .replace(/\\subsection\{([^}]+)\}/g, (_, title) => protectBlock(
                `<h3>${renderInline(title, citations)}</h3>`,
                protectedBlocks
            ))
            .replace(/\\subsubsection\{([^}]+)\}/g, (_, title) => protectBlock(
                `<h4>${renderInline(title, citations)}</h4>`,
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

                return `<p>${renderInline(block.replace(/\s*\n\s*/g, ' '), citations)}</p>`;
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

    function renderList(content, ordered, citations) {
        const tag = ordered ? 'ol' : 'ul';
        const items = content
            .split(/\\item\s+/)
            .map(item => item.trim())
            .filter(Boolean)
            .map(item => `<li>${renderInline(item.replace(/\s*\n\s*/g, ' '), citations)}</li>`)
            .join('');

        return `<${tag}>${items}</${tag}>`;
    }

    function renderInline(source, citations) {
        const math = [];
        let value = source
            .replace(/\\\(([\s\S]*?)\\\)/g, (_, expression) => protectMath(`\\(${expression}\\)`, math))
            .replace(/\$([^$\n]+)\$/g, (_, expression) => protectMath(`\\(${expression}\\)`, math));

        value = escapeHtml(value)
            .replace(/\\textbf\{([^{}]*)\}/g, '<strong>$1</strong>')
            .replace(/\\(?:textit|emph)\{([^{}]*)\}/g, '<span>$1</span>')
            .replace(/\\texttt\{([^{}]*)\}/g, '<code>$1</code>')
            .replace(/\\cite\{([^}]+)\}/g, (_, keys) => renderCitation(keys, citations))
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

    function renderCitation(keys, citations) {
        const renderedCitations = keys.split(',').map(key => {
            const cleanKey = key.trim();
            const reference = citations.get(cleanKey);

            if (!reference) {
                return '?';
            }

            const referenceText = escapeHtml(toPlainReferenceText(reference.content));

            return [
                `<a class="paper-citation" href="#ref-${escapeAttribute(cleanKey)}"`,
                ` data-reference="${referenceText}"`,
                ` title="${referenceText}"`,
                ` aria-label="${text.reference} ${reference.number}: ${referenceText}">`,
                `${reference.number}</a>`
            ].join('');
        });

        return `[${renderedCitations.join(', ')}]`;
    }

    function toPlainReferenceText(value) {
        return String(value)
            .replace(/\\(?:textbf|textit|emph|texttt)\{([^{}]*)\}/g, '$1')
            .replace(/\\([_%&#])/g, '$1')
            .replace(/[{}]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function renderStagingPaper(paper) {
        const article = document.createElement('article');
        const flow = document.createElement('div');

        article.className = 'paper-staging paper-style-ieee';
        flow.className = 'paper-flow-source';
        flow.innerHTML = paper.content;

        appendReferenceBlocks(flow, paper.references);
        assignHeadingIds(flow);

        article.append(
            createTitleBlock(paper),
            createAbstract(paper.abstract),
            flow
        );

        return article;
    }

    function createTitleBlock(paper) {
        const header = document.createElement('header');
        const manuscriptStatus = document.createElement('p');
        const title = document.createElement('h1');
        const authors = document.createElement('div');
        const date = document.createElement('div');

        header.className = 'paper-title-block';
        manuscriptStatus.className = 'paper-manuscript-status';
        manuscriptStatus.textContent = paper.status;
        title.textContent = paper.title;
        authors.className = 'paper-authors';
        authors.innerHTML = renderInline(paper.author, new Map())
            .replace(/\\and/g, `<span class="author-separator">${text.authorSeparator}</span>`);
        date.className = 'paper-date';
        date.textContent = paper.date;
        header.append(manuscriptStatus, title, authors, date);
        return header;
    }

    function createAbstract(abstractText) {
        const abstract = document.createElement('section');
        const abstractTitle = document.createElement('strong');
        const abstractBody = document.createElement('p');

        abstract.className = 'paper-abstract';
        abstractTitle.textContent = text.abstract;
        abstractBody.innerHTML = renderInline(abstractText, new Map());
        abstract.append(abstractTitle, abstractBody);
        return abstract;
    }

    function appendReferenceBlocks(flow, references) {
        if (references.length === 0) {
            return;
        }

        const title = document.createElement('h2');
        title.className = 'paper-references-title';
        title.textContent = text.references;
        flow.appendChild(title);

        references.forEach(reference => {
            const item = document.createElement('p');
            const marker = document.createElement('span');

            item.className = 'paper-reference-entry';
            item.id = `ref-${reference.key}`;
            marker.className = 'paper-reference-number';
            marker.textContent = `[${reference.number}]`;
            item.append(marker, document.createTextNode(' '));
            item.insertAdjacentHTML('beforeend', renderInline(reference.content, new Map()));
            flow.appendChild(item);
        });
    }

    function assignHeadingIds(flow) {
        flow.querySelectorAll('h2, h3, h4').forEach((heading, index) => {
            if (!heading.id) {
                heading.id = `naslov-${index + 1}`;
            }
        });
    }

    function paginatePaper(paper, stagingPaper, reader) {
        const documentView = document.createElement('div');
        const sourceFlow = stagingPaper.querySelector('.paper-flow-source');
        const headings = Array.from(sourceFlow.querySelectorAll('h2, h3, h4'));
        const showContents = shouldShowContents(sourceFlow, headings);
        const pages = [];
        let nextPageNumber = 1;

        documentView.className = 'paper-document';
        documentView.setAttribute('role', 'document');
        documentView.setAttribute('aria-label', paper.title);
        reader.appendChild(documentView);

        const firstPage = createPage(paper, nextPageNumber++, 'paper-first-page');
        const firstMain = firstPage.querySelector('.paper-page-main');
        firstMain.append(
            stagingPaper.querySelector('.paper-title-block'),
            stagingPaper.querySelector('.paper-abstract')
        );
        pages.push(firstPage);
        documentView.appendChild(firstPage);

        if (showContents) {
            const contentsResult = paginateContents(
                documentView,
                paper,
                headings,
                nextPageNumber
            );

            pages.push(...contentsResult.pages);
            nextPageNumber = contentsResult.nextPageNumber;
        }

        const contentResult = paginateFlow(
            documentView,
            paper,
            Array.from(sourceFlow.children),
            nextPageNumber,
            showContents ? null : firstPage
        );

        pages.push(...contentResult.pages);
        updateContentsPageNumbers(documentView);
        stagingPaper.remove();
        return documentView;
    }

    function shouldShowContents(flow, headings) {
        const wordCount = flow.textContent.trim().split(/\s+/).filter(Boolean).length;
        return headings.length >= minimumContentsHeadings && wordCount >= minimumContentsWords;
    }

    function paginateContents(documentView, paper, headings, startingPageNumber) {
        const pages = [];
        let pageNumber = startingPageNumber;
        let page = createContentsPage(paper, pageNumber++, false);
        let flow = page.querySelector('.paper-toc-flow');

        documentView.appendChild(page);
        pages.push(page);

        headings.forEach(heading => {
            const entry = createContentsEntry(heading);
            flow.appendChild(entry);

            if (isVerticallyOverflowing(flow)) {
                flow.removeChild(entry);
                page = createContentsPage(paper, pageNumber++, true);
                flow = page.querySelector('.paper-toc-flow');
                flow.appendChild(entry);
                documentView.appendChild(page);
                pages.push(page);
            }
        });

        return { pages, nextPageNumber: pageNumber };
    }

    function createContentsPage(paper, pageNumber, continuation) {
        const page = createPage(paper, pageNumber, 'paper-contents-page');
        const flow = document.createElement('nav');
        const title = document.createElement('h2');

        flow.className = 'paper-toc-flow';
        flow.setAttribute('aria-label', text.contents);
        title.className = 'paper-toc-title';
        title.textContent = continuation ? text.contentsContinuation : text.contents;
        flow.appendChild(title);
        page.querySelector('.paper-page-main').appendChild(flow);
        return page;
    }

    function createContentsEntry(heading) {
        const link = document.createElement('a');
        const label = document.createElement('span');
        const leader = document.createElement('span');
        const pageNumber = document.createElement('span');
        const level = Number(heading.tagName.slice(1));

        link.className = `paper-toc-entry paper-toc-level-${level}`;
        link.href = `#${heading.id}`;
        link.dataset.target = heading.id;
        label.className = 'paper-toc-label';
        label.textContent = heading.textContent;
        leader.className = 'paper-toc-leader';
        pageNumber.className = 'paper-toc-page-number';
        pageNumber.textContent = '—';
        link.append(label, leader, pageNumber);
        return link;
    }

    function paginateFlow(documentView, paper, nodes, startingPageNumber, existingPage) {
        const pages = [];
        const queue = [...nodes];
        let pageNumber = startingPageNumber;
        let page = existingPage || createContentPage(paper, pageNumber++);
        let flow = page.querySelector('.paper-page-flow');

        if (!flow) {
            flow = document.createElement('div');
            flow.className = 'paper-page-flow';
            page.querySelector('.paper-page-main').appendChild(flow);
        }

        if (!existingPage) {
            documentView.appendChild(page);
            pages.push(page);
        }

        while (queue.length > 0) {
            const node = queue.shift();
            flow.appendChild(node);

            if (!isColumnOverflowing(flow)) {
                continue;
            }

            flow.removeChild(node);
            const continuation = splitNodeToFit(node, flow);

            if (continuation) {
                queue.unshift(continuation);
                page = createContentPage(paper, pageNumber++);
                flow = page.querySelector('.paper-page-flow');
                documentView.appendChild(page);
                pages.push(page);
                continue;
            }

            if (flow.children.length === 0) {
                flow.appendChild(node);
                page = createContentPage(paper, pageNumber++);
                flow = page.querySelector('.paper-page-flow');
                documentView.appendChild(page);
                pages.push(page);
                continue;
            }

            const possibleOrphan = flow.lastElementChild;

            if (possibleOrphan && /^H[2-4]$/.test(possibleOrphan.tagName)) {
                flow.removeChild(possibleOrphan);
                queue.unshift(possibleOrphan, node);
            } else {
                queue.unshift(node);
            }

            page = createContentPage(paper, pageNumber++);
            flow = page.querySelector('.paper-page-flow');
            documentView.appendChild(page);
            pages.push(page);
        }

        if (pages.length > 1 && pages.at(-1).querySelector('.paper-page-flow').children.length === 0) {
            const emptyPage = pages.pop();
            emptyPage.remove();
        }

        const lastContentPage = pages.length > 0 ? pages.at(-1) : existingPage;

        if (lastContentPage) {
            lastContentPage.classList.add('paper-last-content-page');
        }

        return { pages, nextPageNumber: pageNumber };
    }

    function splitNodeToFit(node, flow) {
        if (node.tagName === 'P') {
            return splitParagraphToFit(node, flow);
        }

        if (node.tagName === 'UL' || node.tagName === 'OL') {
            return splitListToFit(node, flow);
        }

        return null;
    }

    function splitParagraphToFit(paragraph, flow) {
        const boundaries = collectSafeSplitPositions(paragraph);

        if (boundaries.length < 2) {
            return null;
        }

        let low = 0;
        let high = boundaries.length - 1;
        let bestSplit = null;

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            const split = splitElementAtTextOffset(paragraph, boundaries[middle]);

            flow.appendChild(split.head);
            const fits = !isColumnOverflowing(flow);
            split.head.remove();

            if (fits) {
                bestSplit = split;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }

        if (!bestSplit || !hasSubstantialText(bestSplit.head) || !hasSubstantialText(bestSplit.tail)) {
            return null;
        }

        bestSplit.head.classList.add('paper-fragment');
        bestSplit.tail.classList.add('paper-continuation');
        flow.appendChild(bestSplit.head);
        return bestSplit.tail;
    }

    function splitListToFit(list, flow) {
        const items = Array.from(list.children);

        if (items.length < 2) {
            return null;
        }

        let low = 1;
        let high = items.length - 1;
        let bestCount = 0;

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            const head = list.cloneNode(false);

            items.slice(0, middle).forEach(item => head.appendChild(item.cloneNode(true)));
            flow.appendChild(head);
            const fits = !isColumnOverflowing(flow);
            head.remove();

            if (fits) {
                bestCount = middle;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }

        if (bestCount === 0) {
            return null;
        }

        const head = list.cloneNode(false);
        const tail = list.cloneNode(false);

        items.slice(0, bestCount).forEach(item => head.appendChild(item.cloneNode(true)));
        items.slice(bestCount).forEach(item => tail.appendChild(item.cloneNode(true)));

        if (list.tagName === 'OL') {
            const initialStart = Number(list.getAttribute('start')) || 1;
            tail.setAttribute('start', String(initialStart + bestCount));
        }

        tail.removeAttribute('id');
        tail.classList.add('paper-continuation');
        flow.appendChild(head);
        return tail;
    }

    function collectSafeSplitPositions(root) {
        const positions = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let cumulativeOffset = 0;
        let textNode;

        while ((textNode = walker.nextNode())) {
            const value = textNode.nodeValue || '';
            const protectedInline = textNode.parentElement
                && textNode.parentElement.closest('a, code, mjx-container');

            if (!protectedInline) {
                for (const match of value.matchAll(/\s+/g)) {
                    const position = cumulativeOffset + match.index + match[0].length;

                    if (position >= 45 && root.textContent.length - position >= 35) {
                        positions.push(position);
                    }
                }
            }

            cumulativeOffset += value.length;
        }

        return positions;
    }

    function splitElementAtTextOffset(element, offset) {
        const position = resolveTextPosition(element, offset);
        const headRange = document.createRange();
        const tailRange = document.createRange();
        const head = element.cloneNode(false);
        const tail = element.cloneNode(false);

        headRange.selectNodeContents(element);
        headRange.setEnd(position.node, position.offset);
        tailRange.selectNodeContents(element);
        tailRange.setStart(position.node, position.offset);
        head.appendChild(headRange.cloneContents());
        tail.appendChild(tailRange.cloneContents());
        tail.removeAttribute('id');
        return { head, tail };
    }

    function resolveTextPosition(root, offset) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let remaining = offset;
        let textNode;
        let lastTextNode = null;

        while ((textNode = walker.nextNode())) {
            lastTextNode = textNode;

            if (remaining <= textNode.nodeValue.length) {
                return { node: textNode, offset: remaining };
            }

            remaining -= textNode.nodeValue.length;
        }

        return {
            node: lastTextNode || root,
            offset: lastTextNode ? lastTextNode.nodeValue.length : root.childNodes.length
        };
    }

    function hasSubstantialText(element) {
        return element.textContent.trim().length >= 30;
    }

    function createContentPage(paper, pageNumber) {
        const page = createPage(paper, pageNumber, 'paper-content-page');
        const flow = document.createElement('div');

        flow.className = 'paper-page-flow';
        page.querySelector('.paper-page-main').appendChild(flow);
        return page;
    }

    function createPage(paper, pageNumber, extraClass) {
        const page = document.createElement('article');
        const main = document.createElement('div');

        page.className = `paper-sheet paper-page paper-style-ieee ${extraClass}`;
        page.dataset.pageNumber = String(pageNumber);
        page.setAttribute('aria-label', `${text.page} ${pageNumber}`);

        main.className = 'paper-page-main';
        page.appendChild(main);
        return page;
    }

    function isColumnOverflowing(flow) {
        const flowBoundary = flow.getBoundingClientRect().right + 1;

        return Array.from(flow.children).some(child => (
            Array.from(child.getClientRects()).some(rect => (
                rect.width > 0 && rect.height > 0 && rect.left >= flowBoundary
            ))
        ));
    }

    function isVerticallyOverflowing(flow) {
        return flow.scrollHeight > flow.clientHeight + 2;
    }

    function updateContentsPageNumbers(documentView) {
        documentView.querySelectorAll('.paper-toc-entry').forEach(entry => {
            const target = documentView.querySelector(`#${entry.dataset.target}`);
            const page = target ? target.closest('.paper-page') : null;
            const pageNumber = entry.querySelector('.paper-toc-page-number');

            pageNumber.textContent = page ? page.dataset.pageNumber : '—';
        });
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
