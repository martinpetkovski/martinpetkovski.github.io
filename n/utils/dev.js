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
    const params = new URLSearchParams(location.search);
    // Handle the old style ?page format if URLSearchParams doesn't pick it up correctly
    // URLSearchParams expects ?key=value. ?page works as key='page', value=''.
    // But ?sloboda-na-govor results in key='sloboda-na-govor', value=''.
    
    let page = null;
    let lang = 'en';

    // Check for lang param
    if (location.search.includes('lang=mk')) lang = 'mk';
    
    // Extract page name
    // Remove ? and lang param to get the page name
    let query = location.search.substring(1);
    query = query.replace(/&?lang=(en|mk)/, '').replace(/&$/, '');
    page = query || 'index';

    // Try to load pages's markdown
    let filename = page;
    if (lang === 'mk') {
        filename = `${page}.mk`;
    }

    let response = await fetch(`./pages/${filename}.md`, {method: 'GET'});

    // If not found, fallback
    if (!response.ok) {
        // If MK page not found, try EN page? Or Index?
        if (lang === 'mk') {
             // Try English version of the page
             response = await fetch(`./pages/${page}.md`, {method: 'GET'});
        }
        
        if (!response.ok) {
             // Fallback to index
             filename = lang === 'mk' ? 'index.mk' : 'index';
             response = await fetch(`./pages/${filename}.md`, {method: 'GET'});
             if (!response.ok && lang === 'mk') {
                 response = await fetch(`./pages/index.md`, {method: 'GET'});
             }
        }
    }

    // Get text from response
    const text = await response.text();

    // Replace this page's content with the converted markdown to html
    document.body.innerHTML = marked(text);

    // Update html lang attribute
    document.documentElement.lang = lang;

    // Update internal links to preserve language
    if (lang === 'mk') {
        const links = document.querySelectorAll('a[href^="?"]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href.includes('lang=')) {
                link.setAttribute('href', href + '&lang=mk');
            }
        });
    }

    // Add Language Switcher
    const switcher = document.createElement('div');
    Object.assign(switcher.style, {
        position: 'fixed', top: '10px', right: '10px',
        background: '#fff', padding: '5px', border: '1px solid #ccc', zIndex: '1000'
    });
    
    const mkLink = location.search.includes('lang=mk') ? location.search : (location.search ? location.search + '&lang=mk' : '?lang=mk');
    const enLink = location.search.replace(/&?lang=mk/, '').replace(/\?$/, '');
    
    switcher.innerHTML = `
        <a href="${enLink || '?'}" style="${lang==='en'?'font-weight:bold':''}">EN</a> | 
        <a href="${mkLink}" style="${lang==='mk'?'font-weight:bold':''}">MK</a>
    `;
    document.body.appendChild(switcher);

    // Hero Opinions Logic
    const opinionsList = document.getElementById('opinions-list');
    if (opinionsList) {
        // Fetch principles to get opinions
        let principlesFile = lang === 'mk' ? 'principles.mk' : 'principles';
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