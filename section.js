/* Shared search + timeline behaviour for the section pages.

   Static pages (My Code Has Powered, The Vault, Opinions) mark up their rows
   by hand: every filterable row is a <li> inside [data-section-list] and each
   timeline block carries the same data-i value as the row it belongs to.

   Data driven pages (Game Prototypes, Draft Papers) build their rows in their
   own script and use window.najjakSection to draw and dim the same timeline. */
(() => {
    'use strict';

    const flash = element => {
        if (!element) return;
        element.classList.remove('is-flash');
        void element.offsetWidth;
        element.classList.add('is-flash');
        setTimeout(() => element.classList.remove('is-flash'), 1000);
    };

    /* Greedy packing: each bar drops into the first row where it does not
       overlap anything already placed. Feed it chronological ranges. */
    const packLanes = ranges => {
        const lanes = [];
        return ranges.map(({ start, end }) => {
            for (let lane = 0; ; lane += 1) {
                const used = lanes[lane] || (lanes[lane] = []);
                if (used.every(([from, to]) => end <= from || start >= to)) {
                    used.push([start, end]);
                    return lane + 1;
                }
            }
        });
    };

    const renderTimeline = (root, { columns, axis, bars, onSelect }) => {
        if (!root) return;
        const row = root.querySelector('.tl-r');
        const scale = root.querySelector('.tl-x');
        if (!row || !scale || !bars.length) {
            root.hidden = true;
            return;
        }
        root.hidden = false;
        root.style.setProperty('--c', columns);
        row.replaceChildren(...bars.map(bar => {
            const block = document.createElement('i');
            if (bar.className) block.className = bar.className;
            block.dataset.i = bar.key;
            block.style.setProperty('--s', bar.start);
            block.style.setProperty('--e', bar.end);
            block.style.setProperty('--l', bar.lane);
            block.title = bar.title || '';
            block.textContent = bar.label == null ? '' : String(bar.label);
            if (onSelect) block.addEventListener('click', () => onSelect(bar.key, block));
            return block;
        }));
        scale.replaceChildren(...axis.map(label => {
            const cell = document.createElement('span');
            cell.textContent = label;
            return cell;
        }));
    };

    const dimTimeline = (root, visibleKeys, isFiltering) => {
        if (!root) return;
        root.querySelectorAll('.tl-r i').forEach(block => {
            block.classList.toggle('is-dimmed', isFiltering && !visibleKeys.has(block.dataset.i));
        });
    };

    window.najjakSection = { flash, packLanes, renderTimeline, dimTimeline };

    document.addEventListener('DOMContentLoaded', () => {
        /* Row cascade runs on the first paint only - once the intro is
           over the class goes, so filtering never replays it. */
        document.body.classList.add('anim');
        setTimeout(() => document.body.classList.remove('anim'), 1400);

        const search = document.querySelector('[data-section-search]');
        const list = document.querySelector('[data-section-list]');
        if (!search || !list) return;

        const status = document.querySelector('[data-section-status]');
        const timeline = document.querySelector('[data-section-timeline]');
        const bars = [...document.querySelectorAll('[data-section-timeline] i')];
        const noun = list.dataset.sectionNoun || 'entries';
        const rows = [...list.querySelectorAll('li')]
            .filter(row => !row.classList.contains('sec-detail'))
            .map(row => ({
                row,
                key: row.dataset.i || '',
                text: (row.textContent + ' ' + (row.dataset.tags || '')).toLowerCase().replace(/\s+/g, ' ')
            }));

        const apply = () => {
            const tokens = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
            const visible = new Set();
            let shown = 0;

            rows.forEach(({ row, key, text }) => {
                const match = tokens.every(token => text.includes(token));
                row.classList.toggle('sec-hidden', !match);
                if (match) {
                    shown += 1;
                    if (key) visible.add(key);
                }
            });

            dimTimeline(timeline, visible, tokens.length > 0);

            if (!status) return;
            if (!tokens.length) status.textContent = '';
            else if (!shown) status.textContent = `No ${noun} match your search.`;
            else status.textContent = `${shown} of ${rows.length} ${noun} shown.`;
        };

        search.addEventListener('input', apply);
        search.addEventListener('search', apply);

        bars.forEach(bar => {
            if (!bar.dataset.i) return;
            bar.addEventListener('click', () => {
                const entry = rows.find(item => item.key === bar.dataset.i && !item.row.classList.contains('sec-hidden'));
                if (!entry) return;
                entry.row.scrollIntoView({ block: 'nearest' });
                flash(entry.row);
                bars.filter(other => other.dataset.i === bar.dataset.i).forEach(flash);
            });
        });

        apply();
    });
})();
