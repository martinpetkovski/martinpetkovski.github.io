(() => {
    'use strict';

    let activePrototype = '';

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        const status = document.querySelector('#prototypeStatus');
        const list = document.querySelector('#prototypeList');
        const search = document.querySelector('#prototypeSearch');
        const detail = document.querySelector('#prototypeDetail');

        try {
            const response = await fetch('/game-prototypes/prototypes.json');
            if (!response.ok) throw new Error('The prototype list could not be loaded.');

            const manifest = await response.json();
            const prototypes = Array.isArray(manifest.prototypes) ? [...manifest.prototypes] : [];
            prototypes.sort((a, b) => parseYear(b.year) - parseYear(a.year));
            renderList(prototypes, 'No prototypes have been added yet.');
            search.addEventListener('input', () => {
                const filtered = filterPrototypes(prototypes, search.value);
                renderList(filtered, 'No prototypes match your search.');
            });

            function renderList(items, emptyMessage) {
                list.replaceChildren(...items.map(prototype => renderPrototypeSummary(prototype, list, detail)));
                status.textContent = items.length ? '' : emptyMessage;
                if (!items.some(prototype => prototype.title === activePrototype)) {
                    activePrototype = '';
                    detail.replaceChildren();
                } else {
                    const activeItem = [...list.querySelectorAll('.prototype-summary')]
                        .find(item => item.dataset.title === activePrototype);
                    if (activeItem) activeItem.after(detail);
                }
            }
        } catch (error) {
            status.classList.add('is-error');
            status.textContent = error.message;
        }
    }

    function renderPrototypeSummary(prototype, list, detail) {
        const item = document.createElement('article');
        const thumbnail = document.createElement('div');
        const text = document.createElement('div');
        const title = document.createElement('h3');
        const metadata = document.createElement('p');

        item.className = 'prototype-summary';
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-controls', 'prototypeDetail');
        item.dataset.title = prototype.title;
        thumbnail.className = 'prototype-thumbnail';
        text.className = 'prototype-summary-text';
        if (prototype.image) {
            const image = document.createElement('img');
            image.src = prototype.image;
            image.alt = '';
            image.loading = 'lazy';
            thumbnail.append(image);
        } else {
            thumbnail.textContent = 'NO IMAGE';
        }
        title.textContent = prototype.year ? `${prototype.title} (${prototype.year})` : prototype.title;
        metadata.className = 'prototype-meta';
        metadata.textContent = [prototype.event, prototype.engine].filter(Boolean).join(' · ');
        text.append(title, metadata);
        item.append(thumbnail, text);

        const select = () => {
            if (activePrototype === prototype.title) {
                activePrototype = '';
                detail.replaceChildren();
            } else {
                activePrototype = prototype.title;
                detail.replaceChildren(renderPrototype(prototype));
                item.after(detail);
            }
            list.querySelectorAll('.prototype-summary').forEach(updatePrototypeState);
        };

        item.addEventListener('click', select);
        item.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                select();
            }
        });
        updatePrototypeState(item);
        return item;
    }

    function updatePrototypeState(item) {
        const isActive = item.dataset.title === activePrototype;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    }

    function parseYear(value) {
        const match = String(value || '').match(/\d{4}/);
        return match ? Number(match[0]) : 0;
    }

    function filterPrototypes(prototypes, query) {
        const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (!tokens.length) return prototypes;

        return prototypes.filter(prototype => {
            const searchText = [
                prototype.title,
                prototype.year,
                prototype.event,
                prototype.engine,
                prototype.description,
                ...(Array.isArray(prototype.credits) ? prototype.credits : []),
                ...(Array.isArray(prototype.links) ? prototype.links.flatMap(link => [link.label, link.url]) : [])
            ].filter(Boolean).join(' ').toLowerCase();
            return tokens.every(token => searchText.includes(token));
        });
    }

    function renderPrototype(prototype) {
        const article = document.createElement('article');
        article.className = 'prototype-card';

        const imageFrame = document.createElement('div');
        imageFrame.className = 'prototype-media prototype-image';
        if (prototype.image) {
            const image = document.createElement('img');
            image.src = prototype.image;
            image.alt = `${prototype.title} screenshot`;
            image.loading = 'lazy';
            imageFrame.append(image);
        } else {
            imageFrame.textContent = 'IMAGE COMING SOON';
        }

        const videoFrame = document.createElement('div');
        videoFrame.className = 'prototype-media prototype-video';
        if (prototype.video) {
            const video = document.createElement('video');
            video.controls = true;
            video.preload = 'metadata';
            video.src = prototype.video;
            videoFrame.append(video);
        } else {
            videoFrame.textContent = 'GAMEPLAY VIDEO COMING SOON';
        }

        const details = document.createElement('div');
        details.className = 'prototype-card-details';
        const title = document.createElement('h3');
        title.textContent = prototype.year ? `${prototype.title} (${prototype.year})` : prototype.title;
        const metadata = document.createElement('p');
        metadata.className = 'prototype-meta';
        metadata.textContent = [prototype.event, prototype.engine].filter(Boolean).join(' · ');
        const credits = document.createElement('p');
        credits.className = 'prototype-credits';
        const collaborators = Array.isArray(prototype.credits) ? prototype.credits.filter(Boolean) : [];
        credits.textContent = collaborators.join(' · ');
        credits.hidden = collaborators.length === 0;
        const description = document.createElement('p');
        description.textContent = prototype.description;
        const actions = document.createElement('p');
        actions.className = 'prototype-actions';

        const links = Array.isArray(prototype.links)
            ? prototype.links.filter(link => link && link.label && link.url)
            : [];

        links.forEach(({ label, url }, index) => {
            if (index > 0) actions.append(' · ');
            const link = document.createElement('a');
            link.href = url;
            link.textContent = label;
            actions.append(link);
        });

        if (!links.length) actions.textContent = 'Links coming soon';

        details.append(title, actions, metadata, credits, description);
        article.append(imageFrame, details, videoFrame);
        return article;
    }
})();
