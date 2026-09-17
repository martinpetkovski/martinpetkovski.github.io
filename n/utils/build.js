const INDEX = `${__dirname}/../index.html`;
const PAGES = `${__dirname}/../pages/`;
const BUILD = `${__dirname}/../docs/`;

const fs = require('fs');
const marked = require('./lib/marked-node');
const highlight = require('./lib/highlight-node');
const checkBox = require('./lib/checkBox');

marked.setOptions({
    langPrefix: '',
    highlight: function(code) {
        return highlight.highlightAuto(code).value;
    },
});

// Get index.html text
const indexTemplate = fs.readFileSync(INDEX, 'utf8');

// Helper to extract opinions
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
    return opinions.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Pre-load opinions
let opinionsEn = [];
let opinionsMk = [];

try {
    if (fs.existsSync(PAGES + 'principles.md')) {
        const principlesEn = fs.readFileSync(PAGES + 'principles.md', 'utf8');
        opinionsEn = extractOpinions(principlesEn);
    }
} catch (e) {}

try {
    if (fs.existsSync(PAGES + 'principles.mk.md')) {
        const principlesMk = fs.readFileSync(PAGES + 'principles.mk.md', 'utf8');
        opinionsMk = extractOpinions(principlesMk);
    }
} catch (e) {}

// scrape pages folder for markdown files
const markdown = fs.readdirSync(PAGES);
markdown.forEach(file => {
    if (!file.endsWith('.md')) return;

    checkBox(`building ${file}...`);

    // Determine language
    const isMk = file.endsWith('.mk.md');
    const lang = isMk ? 'mk' : 'en';
    const baseName = file.replace('.mk.md', '').replace('.md', '');

    // Get markdown text
    const markdownText = fs.readFileSync(PAGES + file, 'utf8');

    // Convert markdown to html
    const content = marked(markdownText);
    
    // Replace the development loader with the rendered article while retaining
    // the same shared header and page shell used during local development.
    let output = indexTemplate.replace('<script type="module" src="./utils/dev.js"></script>', content);

    // Update html lang attribute
    if (lang === 'mk') {
        output = output.replace('<html lang="en">', '<html lang="mk">');
    }

    // Inject Opinions if it's the index page
    if (baseName === 'index') {
        const opinions = lang === 'mk' ? opinionsMk : opinionsEn;
        const listHtml = opinions.map(op => `<div><small>${op.date}</small> ${op.title}</div>`).join('');
        output = output.replace('<div id="opinions-list" style="display:none;"></div>', 
            `<div id="opinions-list" style="display:none;">${listHtml}</div>`);
            
        // Add script for hover behavior
        const opinionsScript = `
        <script>
            (function(){
                const hero = document.getElementById('hero-opinions');
                const list = document.getElementById('opinions-list');
                if (hero && list) {
                    hero.addEventListener('mouseenter', () => list.style.display = 'block');
                    hero.addEventListener('mouseleave', () => list.style.display = 'none');
                }
            })();
        </script>`;
        output = output.replace(/\s*<\/body>/, `${opinionsScript}\n    </body>`);
    }

    // Replace title with content of first <h1> tag
    const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const fallbackTitle = baseName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    const newTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : fallbackTitle;
    output = output.replace(/<title>(.*?)<\/title>/, `<title>${newTitle}</title>`);

    // Replace 'docs/assets' links with 'assets'
    output = output.replace(/docs\/assets/g, 'assets');

    // Replace local '?' dev links with built '.html'
    output = output.replace(/href="\?(.*?)"/g, (match, p1) => {
        if (lang === 'mk') {
            return `href="${p1}.mk.html"`;
        } else {
            return `href="${p1}.html"`;
        }
    });
    
    // Output built html to build folder
    const outputFile = file.replace('.md', '.html');
    fs.writeFileSync(BUILD + outputFile, output);

    checkBox(`${outputFile} built`, true);
});
