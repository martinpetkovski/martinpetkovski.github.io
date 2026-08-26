(() => {
    'use strict';

    let activeProject = '';

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        const status = document.querySelector('#vaultStatus');
        const list = document.querySelector('#vaultList');
        const search = document.querySelector('#vaultSearch');
        const detail = document.querySelector('#vaultDetail');
        const timeline = document.querySelector('#vaultTimeline');
        const timelineRow = document.querySelector('#vaultTimelineRow');
        const timelineAxis = document.querySelector('#vaultTimelineAxis');

        try {
            const response = await fetch('/vault/vault.json');
            if (!response.ok) throw new Error('The vault could not be loaded.');

            const manifest = await response.json();
            const projects = Array.isArray(manifest.projects) ? [...manifest.projects] : [];
            const axis = Array.isArray(manifest.axis) ? manifest.axis : [];

            renderTimeline(projects, axis);
            renderList(projects, 'Nothing is stored in the vault yet.');

            search.addEventListener('input', () => {
                const filtered = filterProjects(projects, search.value);
                renderList(filtered, 'No projects match your search.');
                highlightTimeline(filtered.map(project => project.title), filtered.length !== projects.length);
            });

            function renderTimeline(items, years) {
                if (!items.length || !years.length) {
                    timeline.hidden = true;
                    return;
                }
                timeline.style.setProperty('--c', years.length);
                timelineRow.replaceChildren(...items.map((project, index) => {
                    const block = document.createElement('i');
                    const span = project.span || {};
                    block.className = 'vault-bar' + (project.kind === 'vibecrafted' ? ' tl-i' : '');
                    block.style.setProperty('--s', span.start || 1);
                    block.style.setProperty('--e', span.end || (span.start || 1) + 1);
                    block.style.setProperty('--l', span.lane || 1);
                    block.title = project.year ? `${project.title}, ${project.year}` : project.title;
                    block.dataset.title = project.title;
                    block.textContent = String(index + 1);
                    block.addEventListener('click', () => {
                        const item = [...list.querySelectorAll('.vault-summary')]
                            .find(entry => entry.dataset.title === project.title);
                        if (item) {
                            item.click();
                            item.scrollIntoView({ block: 'nearest' });
                        }
                    });
                    return block;
                }));
                timelineAxis.replaceChildren(...years.map(year => {
                    const label = document.createElement('span');
                    label.textContent = year;
                    return label;
                }));
            }

            function highlightTimeline(titles, isFiltering) {
                const visible = new Set(titles);
                timelineRow.querySelectorAll('.vault-bar').forEach(block => {
                    block.classList.toggle('is-dimmed', isFiltering && !visible.has(block.dataset.title));
                });
            }

            function renderList(items, emptyMessage) {
                list.replaceChildren(...items.map(project => renderSummary(project, list, detail)));
                status.textContent = items.length ? '' : emptyMessage;
                if (!items.some(project => project.title === activeProject)) {
                    activeProject = '';
                    detail.replaceChildren();
                } else {
                    const activeItem = [...list.querySelectorAll('.vault-summary')]
                        .find(item => item.dataset.title === activeProject);
                    if (activeItem) activeItem.after(detail);
                }
            }
        } catch (error) {
            status.classList.add('is-error');
            status.textContent = error.message;
        }
    }

    function renderSummary(project, list, detail) {
        const item = document.createElement('article');
        const badge = document.createElement('div');
        const text = document.createElement('div');
        const title = document.createElement('h3');
        const actions = renderLinks(project, '', true);
        const metadata = document.createElement('p');

        item.className = 'vault-summary';
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-controls', 'vaultDetail');
        item.dataset.title = project.title;
        badge.className = 'vault-badge' + (project.kind === 'vibecrafted' ? ' is-vibecrafted' : '');
        badge.textContent = project.year || '';
        text.className = 'vault-summary-text';
        title.textContent = project.title;
        actions.classList.add('vault-summary-actions');
        metadata.className = 'vault-summary-desc';
        metadata.textContent = project.description || '';
        text.append(title, metadata);
        item.append(badge, text, actions);

        const select = () => {
            if (activeProject === project.title) {
                activeProject = '';
                detail.replaceChildren();
            } else {
                activeProject = project.title;
                detail.replaceChildren(renderProject(project));
                item.after(detail);
            }
            list.querySelectorAll('.vault-summary').forEach(updateSummaryState);
        };

        item.addEventListener('click', select);
        actions.addEventListener('click', event => event.stopPropagation());
        actions.addEventListener('keydown', event => event.stopPropagation());
        item.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                select();
            }
        });
        updateSummaryState(item);
        return item;
    }

    function updateSummaryState(item) {
        const isActive = item.dataset.title === activeProject;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    }

    function filterProjects(projects, query) {
        const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (!tokens.length) return projects;

        return projects.filter(project => {
            const searchText = [
                project.title,
                project.year,
                project.kind,
                project.description,
                ...(Array.isArray(project.links) ? project.links.flatMap(link => [link.label, link.url]) : [])
            ].filter(Boolean).join(' ').toLowerCase();
            return tokens.every(token => searchText.includes(token));
        });
    }

    function renderLinks(project, emptyText = '', iconsOnly = false) {
        const actions = document.createElement('p');
        actions.className = 'vault-actions';
        const links = Array.isArray(project.links)
            ? project.links.filter(link => link && link.label && link.url)
            : [];

        links.forEach(({ label, url }, index) => {
            if (index > 0 && !iconsOnly) actions.append(' · ');
            const link = document.createElement('a');
            link.href = url;
            if (/^https?:/i.test(url)) {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }
            if (iconsOnly) {
                link.className = 'vault-icon-link';
                link.setAttribute('aria-label', label);
                link.title = label;
                link.append(renderLinkIcon(label));
            } else {
                link.textContent = label;
            }
            actions.append(link);
        });

        if (!links.length) actions.textContent = emptyText;
        return actions;
    }

    function renderLinkIcon(label) {
        const normalizedLabel = label.toLowerCase();
        const type = normalizedLabel.includes('download') ? 'download'
            : normalizedLabel.includes('youtube') ? 'play'
                : normalizedLabel.includes('source') ? 'source'
                    : normalizedLabel.includes('pdf') ? 'file'
                        : 'external';
        const paths = {
            download: 'M12 3v12m0 0 4-4m-4 4-4-4M5 20h14',
            external: 'M14 5h5v5m0-5-9 9M19 13v6H5V5h6',
            file: 'M6 2h9l5 5v15H6zM14 2v6h6',
            play: 'M8 5v14l11-7z',
            source: 'm9 18-6-6 6-6m6 0 6 6-6 6'
        };
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svg.classList.add('vault-link-icon');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('viewBox', '0 0 24 24');
        path.setAttribute('d', paths[type]);
        if (type === 'play') {
            path.setAttribute('fill', 'currentColor');
        } else {
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'currentColor');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            path.setAttribute('stroke-width', '2');
        }
        svg.append(path);
        return svg;
    }

    function renderProject(project) {
        const article = document.createElement('article');
        article.className = 'vault-card';

        const title = document.createElement('h3');
        title.textContent = project.year ? `${project.title} (${project.year})` : project.title;

        const metadata = document.createElement('p');
        metadata.className = 'vault-meta';
        metadata.textContent = project.kind === 'vibecrafted' ? 'Vibecrafted' : 'Handcrafted';

        const description = document.createElement('p');
        description.textContent = project.description || '';

        const actions = renderLinks(project, 'Links coming soon');

        article.append(title, actions, metadata, description);
        return article;
    }
})();
