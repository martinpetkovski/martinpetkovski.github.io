(() => {
    'use strict';

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        const status = document.querySelector('#prototypeStatus');
        const list = document.querySelector('#prototypeList');

        try {
            const response = await fetch('/game-prototypes/prototypes.json');
            if (!response.ok) throw new Error('The prototype list could not be loaded.');

            const manifest = await response.json();
            const prototypes = Array.isArray(manifest.prototypes) ? manifest.prototypes : [];
            list.replaceChildren(...prototypes.map(renderPrototype));
            status.textContent = prototypes.length ? '' : 'No prototypes have been added yet.';
        } catch (error) {
            status.classList.add('is-error');
            status.textContent = error.message;
        }
    }

    function renderPrototype(prototype) {
        const article = document.createElement('article');
        article.className = 'prototype-card';

        const media = document.createElement('div');
        media.className = 'prototype-media';
        if (prototype.video) {
            const video = document.createElement('video');
            video.controls = true;
            video.preload = 'metadata';
            video.src = prototype.video;
            media.append(video);
        } else {
            media.textContent = 'GAMEPLAY VIDEO COMING SOON';
        }

        const details = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = prototype.title;
        const metadata = document.createElement('p');
        metadata.className = 'prototype-meta';
        metadata.textContent = [prototype.year, prototype.engine].filter(Boolean).join(' · ');
        const description = document.createElement('p');
        description.textContent = prototype.description;
        const actions = document.createElement('p');
        actions.className = 'prototype-actions';

        const links = [
            prototype.build && ['Download Windows build', prototype.build],
            prototype.source && ['Source code', prototype.source],
            prototype.document && ['Project PDF', prototype.document]
        ].filter(Boolean);

        links.forEach(([label, href], index) => {
            if (index > 0) actions.append(' · ');
            const link = document.createElement('a');
            link.href = href;
            link.textContent = label;
            actions.append(link);
        });

        if (!prototype.build) {
            if (links.length) actions.prepend('Windows build coming soon · ');
            else actions.textContent = 'Windows build coming soon';
        }

        details.append(title, metadata, description, actions);
        article.append(media, details);
        return article;
    }
})();
