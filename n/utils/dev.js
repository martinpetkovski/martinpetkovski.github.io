import {marked} from './lib/marked-es6.js';
import {hljs} from './lib/highlight-es6.js';

marked.setOptions({
    langPrefix: '',
    highlight: function(code) {
        return hljs.highlightAuto(code).value;
    },
});

(async function() {

    // Parse query parameters
    // Handle the old style ?page format
    let query = location.search.substring(1);
    // Remove any potential lang params just in case they linger in URLs
    query = query.replace(/&?lang=(en|mk)/, '').replace(/&$/, '');
    let page = query || 'index';

    // Try to load pages's markdown
    let filename = page;
    let response = await fetch(`./pages/${filename}.md`, {method: 'GET'});

    // If not found, fallback to index
    if (!response.ok) {
         filename = 'index';
         response = await fetch(`./pages/${filename}.md`, {method: 'GET'});
    }

    // Get text from response
    const text = await response.text();

    // Replace this page's content with the converted markdown to html
    // Wrap in main-page-like containers for consistent styling/alignment
    // Add a persistent back-to-home button on every page
    document.body.innerHTML = `
        <div class="page">
            <div class="content">
                <div class="topbar">
                    <a class="home-btn" href="../">[ ← Back to NAJJAK.COM ]</a>
                </div>
                <div id="toc" class="toc" aria-label="Contents" hidden></div>
                ${marked(text)}
            </div>
        </div>
    `;

    buildContentsTable();

    // Hero Opinions Logic
    const opinionsList = document.getElementById('opinions-list');
    if (opinionsList) {
        // Fetch principles to get opinions
        let principlesFile = 'principles';
        const pRes = await fetch(`./pages/${principlesFile}.md`);
        if (pRes.ok) {
            const pText = await pRes.text();
            const opinions = extractOpinions(pText);
            
            // Sort by date descending
            opinions.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const listHtml = opinions.map(op => `<div><small>${op.date}</small> ${op.title}</div>`).join('');
            opinionsList.innerHTML = listHtml;
            
            const hero = document.getElementById('hero-opinions');
            hero.addEventListener('mouseenter', () => {
                opinionsList.style.display = 'block';
            });
            hero.addEventListener('mouseleave', () => {
                opinionsList.style.display = 'none';
            });
        }
    }
})();

function buildContentsTable() {
    const content = document.querySelector('.content');
    const toc = document.getElementById('toc');
    if (!content || !toc) return;

    const headings = Array.from(content.querySelectorAll('h1, h2'));
    if (headings.length === 0) return;

    const usedIds = new Set(Array.from(document.querySelectorAll('[id]')).map(el => el.id));

    function slugify(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    function ensureUniqueId(el) {
        let base = el.id && el.id.trim() ? el.id.trim() : slugify(el.textContent || 'section');
        if (!base) base = 'section';

        let candidate = base;
        let i = 2;
        while (usedIds.has(candidate)) {
            candidate = `${base}-${i}`;
            i++;
        }

        el.id = candidate;
        usedIds.add(candidate);
        return candidate;
    }

    const items = headings
        .map(h => ({
            level: h.tagName.toLowerCase(),
            id: ensureUniqueId(h),
            title: (h.textContent || '').trim(),
        }))
        .filter(x => x.title.length > 0);

    if (items.length === 0) return;

    const header = document.createElement('div');
    header.className = 'toc-header';

    const title = document.createElement('div');
    title.className = 'toc-title';
    title.textContent = 'Contents';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toc-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '[ + ]';

    header.append(title, toggle);

    const list = document.createElement('ul');
    for (const item of items) {
        const li = document.createElement('li');
        li.className = item.level === 'h2' ? 'toc-h2' : 'toc-h1';

        const a = document.createElement('a');
        a.href = `#${item.id}`;
        a.textContent = item.title;

        li.appendChild(a);
        list.appendChild(li);
    }

    // collapsed by default
    list.hidden = true;
    toc.classList.add('collapsed');

    toggle.addEventListener('click', () => {
        const isCollapsed = toc.classList.toggle('collapsed');
        list.hidden = isCollapsed;
        toggle.setAttribute('aria-expanded', String(!isCollapsed));
        toggle.textContent = isCollapsed ? '[ + ]' : '[ - ]';
    });

    toc.replaceChildren(header, list);
    toc.hidden = false;
}

function extractOpinions(markdown) {
    const lines = markdown.split('\n');
    const opinions = [];
    let currentDate = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const dateMatch = line.match(/<!-- date: (.*?) -->/);
        if (dateMatch) {
            currentDate = dateMatch[1];
        } else if (line.startsWith('## ') && currentDate) {
            opinions.push({
                title: line.substring(3).replace(/\*/g, ''),
                date: currentDate
            });
            currentDate = null; 
        }
    }
    return opinions;
}