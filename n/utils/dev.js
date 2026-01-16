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
    document.body.innerHTML = marked(text);

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