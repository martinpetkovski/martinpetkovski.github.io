(() => {
    'use strict';

    let activePaper = '';

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        const status = document.querySelector('#paperStatus');
        const list = document.querySelector('#paperList');
        const search = document.querySelector('#paperSearch');
        const detail = document.querySelector('#paperDetail');

        try {
            const response = await fetch('/draft-papers/papers.json');

            if (!response.ok) {
                throw new Error('The paper list could not be loaded.');
            }

            const manifest = await response.json();
            const papers = Array.isArray(manifest.papers) ? manifest.papers : [];

            const papersWithAbstracts = await Promise.all(papers.map(async paper => ({
                ...paper,
                abstract: await loadAbstract(paper.slug)
            })));
            renderList(papersWithAbstracts, 'No papers have been published yet.');
            search.addEventListener('input', () => {
                const filtered = filterPapers(papersWithAbstracts, search.value);
                renderList(filtered, 'No papers match your search.');
            });

            function renderList(items, emptyMessage) {
                list.replaceChildren(...items.map(paper => renderPaperSummary(paper, list, detail)));
                status.textContent = items.length ? '' : emptyMessage;
                if (!items.some(paper => paper.slug === activePaper)) {
                    activePaper = '';
                    detail.replaceChildren();
                } else {
                    const activeItem = [...list.querySelectorAll('.draft-summary')]
                        .find(item => item.dataset.slug === activePaper);
                    if (activeItem) activeItem.after(detail);
                }
            }
        } catch (error) {
            status.classList.add('is-error');
            status.textContent = error.message;
        }
    }

    function renderPaperSummary(paper, list, detail) {
        const item = document.createElement('article');
        const title = document.createElement('h3');
        const metadata = document.createElement('p');

        item.className = 'draft-summary';
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-controls', 'paperDetail');
        item.dataset.slug = paper.slug;
        title.textContent = paper.title;
        metadata.className = 'draft-card-meta';
        metadata.textContent = [paper.author, getYear(paper.updated)]
            .filter(Boolean)
            .join(' · ');
        item.append(title, metadata);

        const select = () => {
            if (activePaper === paper.slug) {
                activePaper = '';
                detail.replaceChildren();
            } else {
                activePaper = paper.slug;
                detail.replaceChildren(renderPaper(paper));
                item.after(detail);
            }
            list.querySelectorAll('.draft-summary').forEach(updatePaperState);
        };

        item.addEventListener('click', select);
        item.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                select();
            }
        });
        updatePaperState(item);
        return item;
    }

    function updatePaperState(item) {
        const isActive = item.dataset.slug === activePaper;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    }

    function getYear(value) {
        const match = String(value || '').match(/\d{4}/);
        return match ? match[0] : value || '';
    }

    function renderPaper(paper) {
        const article = document.createElement('article');
        const title = document.createElement('h3');
        const link = document.createElement('a');
        const metadata = document.createElement('p');
        const abstract = document.createElement('p');
        const actions = document.createElement('p');
        const readLink = document.createElement('a');
        const sourceLink = document.createElement('a');
        const pdfLink = document.createElement('a');

        article.className = 'draft-card';
        link.href = `/draft-papers/paper.html?paper=${encodeURIComponent(paper.slug)}`;
        link.textContent = paper.title;
        title.appendChild(link);

        metadata.className = 'draft-card-meta';
        metadata.textContent = `${paper.author} · ${paper.updated} · ${paper.status || 'Working paper'} · ${paper.format || 'Research paper'}`;
        abstract.className = 'draft-card-abstract';
        abstract.textContent = paper.abstract;

        actions.className = 'draft-card-actions';
        readLink.href = link.href;
        readLink.textContent = 'Read the paper';
        sourceLink.href = `/draft-papers/papers/${encodeURIComponent(paper.slug)}.tex`;
        sourceLink.textContent = 'View LaTeX source';
        actions.append(readLink, ' · ', sourceLink);

        if (paper.pdf) {
            pdfLink.href = paper.pdf;
            pdfLink.textContent = 'Original PDF';
            actions.append(' · ', pdfLink);
        }

        article.append(title, metadata, abstract, actions);
        return article;
    }

    function filterPapers(papers, query) {
        const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (!tokens.length) return papers;

        return papers.filter(paper => {
            const searchText = [
                paper.title,
                paper.author,
                paper.updated,
                paper.status,
                paper.format,
                paper.language,
                paper.abstract
            ].filter(Boolean).join(' ').toLowerCase();
            return tokens.every(token => searchText.includes(token));
        });
    }

    async function loadAbstract(slug) {
        const response = await fetch(`/draft-papers/papers/${encodeURIComponent(slug)}.tex`);

        if (!response.ok) {
            throw new Error(`The abstract for ${slug} could not be loaded.`);
        }

        const source = await response.text();
        const match = source.match(/\\begin\{abstractenglish\}([\s\S]*?)\\end\{abstractenglish\}/) ||
            source.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);

        if (!match) {
            return 'No abstract is available for this paper.';
        }

        return match[1]
            .replace(/%.*$/gm, '')
            .replace(/\\(?:emph|textit|textbf|texttt)\{([^{}]*)\}/g, '$1')
            .replace(/\\(?:LaTeX|TeX)\b/g, 'LaTeX')
            .replace(/``|''/g, '"')
            .replace(/--/g, '–')
            .replace(/\s+/g, ' ')
            .trim();
    }
})();
