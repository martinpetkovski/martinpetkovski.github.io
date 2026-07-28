(() => {
    'use strict';

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        const status = document.querySelector('#paperStatus');
        const list = document.querySelector('#paperList');

        try {
            const response = await fetch('/draft-papers/papers.json');

            if (!response.ok) {
                throw new Error('Could not load the draft paper list.');
            }

            const manifest = await response.json();
            const papers = Array.isArray(manifest.papers) ? manifest.papers : [];

            list.replaceChildren(...papers.map(renderPaper));
            status.textContent = papers.length === 0 ? 'No draft papers yet.' : '';
        } catch (error) {
            status.classList.add('is-error');
            status.textContent = error.message;
        }
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

        article.className = 'draft-card';
        link.href = `/draft-papers/paper.html?paper=${encodeURIComponent(paper.slug)}`;
        link.textContent = paper.title;
        title.appendChild(link);

        metadata.className = 'draft-card-meta';
        metadata.textContent = `${paper.author} · ${paper.updated} · ${paper.status || 'Draft'} · ${paper.format || 'Journal article'}`;
        abstract.className = 'draft-card-abstract';
        abstract.textContent = paper.abstract || '';

        actions.className = 'draft-card-actions';
        readLink.href = link.href;
        readLink.textContent = 'Read paper';
        sourceLink.href = `/draft-papers/papers/${encodeURIComponent(paper.slug)}.tex`;
        sourceLink.textContent = 'View LaTeX source';
        actions.append(readLink, ' · ', sourceLink);

        article.append(title, metadata, abstract, actions);
        return article;
    }
})();
