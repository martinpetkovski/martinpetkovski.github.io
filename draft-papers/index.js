(() => {
    'use strict';

    let activePaper = '';
    const section = window.najjakSection || {};

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        const status = document.querySelector('#paperStatus');
        const list = document.querySelector('#paperList');
        const search = document.querySelector('#paperSearch');
        const timeline = document.querySelector('#paperTimeline');
        const detail = document.createElement('li');
        detail.id = 'paperDetail';
        detail.className = 'sec-detail';
        detail.setAttribute('aria-live', 'polite');

        try {
            const response = await fetch('/draft-papers/papers.json');

            if (!response.ok) {
                throw new Error('The paper list could not be loaded.');
            }

            const manifest = await response.json();
            const papers = Array.isArray(manifest.papers) ? [...manifest.papers] : [];
            papers.sort((a, b) => Number(getYear(a.updated)) - Number(getYear(b.updated)));

            const papersWithAbstracts = await Promise.all(papers.map(async (paper, index) => ({
                ...paper,
                number: index + 1,
                abstract: await loadAbstract(paper.slug)
            })));
            buildTimeline(timeline, papersWithAbstracts, list);
            renderList(papersWithAbstracts, 'No papers have been published yet.', true);
            search.addEventListener('input', () => {
                const filtered = filterPapers(papersWithAbstracts, search.value);
                renderList(filtered, 'No papers match your search.', !search.value.trim());
            });

            function renderList(items, emptyMessage, isComplete) {
                list.replaceChildren(...items.map(paper => renderPaperSummary(paper, list, detail)));
                if (!items.length) status.textContent = emptyMessage;
                else if (isComplete) status.textContent = '';
                else status.textContent = `${items.length} of ${papersWithAbstracts.length} papers shown.`;
                section.dimTimeline(timeline, new Set(items.map(item => String(item.number))), !isComplete);
                if (!items.some(paper => paper.slug === activePaper)) {
                    activePaper = '';
                    detail.replaceChildren();
                } else {
                    const activeItem = [...list.querySelectorAll('.sec-row')]
                        .find(item => item.dataset.slug === activePaper);
                    if (activeItem) activeItem.after(detail);
                }
            }
        } catch (error) {
            status.classList.add('is-error');
            status.textContent = error.message;
        }
    }

    function buildTimeline(timeline, papers, list) {
        if (!timeline || !section.renderTimeline) return;
        const years = papers.map(paper => Number(getYear(paper.updated))).filter(Boolean);
        if (!years.length) return;
        const first = Math.min(...years);
        const last = Math.max(...years);
        const columns = last - first + 1;
        const ranges = papers.map(paper => {
            const year = Number(getYear(paper.updated)) || first;
            return { start: year - first + 1, end: year - first + 2 };
        });
        const lanes = section.packLanes(ranges);
        section.renderTimeline(timeline, {
            columns,
            axis: Array.from({ length: columns }, (unused, index) => `’${String(first + index).slice(2)}`),
            bars: papers.map((paper, index) => ({
                key: String(paper.number),
                label: paper.number,
                title: `${paper.title}, ${paper.updated}`,
                start: ranges[index].start,
                end: ranges[index].end,
                lane: lanes[index]
            })),
            onSelect: key => {
                const row = [...list.querySelectorAll('li[data-i]')].find(item => item.dataset.i === key);
                if (!row) return;
                row.scrollIntoView({ block: 'nearest' });
                section.flash(row);
            }
        });
    }

    function renderPaperSummary(paper, list, detail) {
        const item = document.createElement('li');
        const text = document.createElement('span');
        const title = document.createElement('span');
        const metadata = document.createElement('small');
        const year = document.createElement('span');

        item.className = 'sec-row';
        item.tabIndex = 0;
        item.dataset.i = paper.number;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-controls', 'paperDetail');
        item.dataset.slug = paper.slug;
        title.className = 'sec-title';
        title.textContent = paper.title;
        metadata.textContent = [paper.author, paper.language].filter(Boolean).join(' · ');
        year.className = 'lang';
        year.textContent = getYear(paper.updated);
        text.append(title, metadata);
        item.append(text, year);

        const select = () => {
            if (activePaper === paper.slug) {
                activePaper = '';
                detail.replaceChildren();
            } else {
                activePaper = paper.slug;
                detail.replaceChildren(renderPaper(paper));
                item.after(detail);
            }
            list.querySelectorAll('.sec-row').forEach(updatePaperState);
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
