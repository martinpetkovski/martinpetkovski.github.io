(() => {
    'use strict';

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        const status = document.querySelector('#paperStatus');
        const list = document.querySelector('#paperList');

        try {
            const response = await fetch('/draft-papers/papers.json');

            if (!response.ok) {
                throw new Error('The paper list could not be loaded.');
            }

            const manifest = await response.json();
            const papers = Array.isArray(manifest.papers) ? manifest.papers : [];

            const cards = await Promise.all(papers.map(renderPaper));
            list.replaceChildren(...cards);
            status.textContent = papers.length === 0 ? 'No papers have been published yet.' : '';
        } catch (error) {
            status.classList.add('is-error');
            status.textContent = error.message;
        }
    }

    async function renderPaper(paper) {
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
        abstract.textContent = await loadAbstract(paper.slug);

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

    async function loadAbstract(slug) {
        const response = await fetch(`/draft-papers/papers/${encodeURIComponent(slug)}.tex`);

        if (!response.ok) {
            throw new Error(`The abstract for ${slug} could not be loaded.`);
        }

        const source = await response.text();
        const match = source.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);

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
