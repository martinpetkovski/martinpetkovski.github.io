(function () {
    const manifestPath = 'solutions.json';
    const requiredFields = ['title', 'leetcode', 'difficulty', 'approach', 'time', 'space'];
    const fieldAliases = {
        'problem': 'title',
        'leetcode url': 'leetcode',
        'url': 'leetcode',
        'time complexity': 'time',
        'space complexity': 'space'
    };
    let activeSolutionPath = '';

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        const refs = {
            statusElement: document.querySelector('#solutionStatus'),
            searchElement: document.querySelector('#solutionSearch'),
            tableWrapElement: document.querySelector('#solutionTableWrap'),
            tableBodyElement: document.querySelector('#solutionRows'),
            detailElement: document.querySelector('#solutionDetail')
        };

        try {
            const solutionPaths = await loadSolutionPaths();

            if (solutionPaths.length === 0) {
                setStatus(refs.statusElement, 'No solutions listed yet.');
                return;
            }

            const solutions = await Promise.all(solutionPaths.map(loadSolution));
            renderSolutionTable(refs, solutions);
            refs.searchElement.addEventListener('input', () => {
                renderSolutionTable(refs, filterSolutions(solutions, refs.searchElement.value));
            });
        } catch (error) {
            setStatus(refs.statusElement, error.message, true);
        }
    }

    async function loadSolutionPaths() {
        const response = await fetch(manifestPath);

        if (!response.ok) {
            throw new Error(`Could not load ${manifestPath}.`);
        }

        const manifest = await response.json();
        const entries = Array.isArray(manifest) ? manifest : manifest.solutions;

        if (!Array.isArray(entries)) {
            throw new Error(`${manifestPath} must contain a solutions array.`);
        }

        return entries.map(resolveSolutionPath).filter(Boolean);
    }

    function resolveSolutionPath(entry) {
        if (typeof entry === 'string') {
            return entry;
        }

        if (entry && typeof entry.path === 'string') {
            return entry.path;
        }

        return '';
    }

    async function loadSolution(solutionPath) {
        const response = await fetch(solutionPath);

        if (!response.ok) {
            throw new Error(`Could not load ${solutionPath}.`);
        }

        const source = await response.text();
        return parseSolution(source, solutionPath);
    }

    function parseSolution(source, solutionPath) {
        const normalizedSource = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
        const commentMatch = normalizedSource.match(/^\s*\/\*([\s\S]*?)\*\//);
        const metadata = {};
        let code = normalizedSource;

        if (commentMatch) {
            Object.assign(metadata, parseMetadata(commentMatch[1]));
            code = normalizedSource.slice(commentMatch[0].length).replace(/^\s*\n/, '');
        }

        const warnings = requiredFields
            .filter(fieldName => !metadata[fieldName])
            .map(fieldName => `Missing ${fieldName} metadata.`);

        return {
            code,
            metadata,
            path: solutionPath,
            warnings
        };
    }

    function parseMetadata(metadataBlock) {
        const values = {};
        let activeField = '';

        metadataBlock.split('\n').forEach(line => {
            const cleanLine = line.replace(/^\s*\*\s?/, '').trimEnd();
            const fieldMatch = cleanLine.match(/^([A-Za-z][A-Za-z0-9/+ .-]*):\s*(.*)$/);

            if (fieldMatch) {
                activeField = normalizeFieldName(fieldMatch[1]);
                values[activeField] = values[activeField] || [];

                if (fieldMatch[2]) {
                    values[activeField].push(fieldMatch[2]);
                }

                return;
            }

            if (activeField) {
                values[activeField].push(cleanLine);
            }
        });

        return Object.fromEntries(
            Object.entries(values).map(([fieldName, fieldValues]) => [fieldName, trimBlankLines(fieldValues).join('\n')])
        );
    }

    function normalizeFieldName(fieldName) {
        const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
        return fieldAliases[normalized] || normalized;
    }

    function trimBlankLines(lines) {
        const trimmedLines = [...lines];

        while (trimmedLines.length > 0 && trimmedLines[0].trim() === '') {
            trimmedLines.shift();
        }

        while (trimmedLines.length > 0 && trimmedLines[trimmedLines.length - 1].trim() === '') {
            trimmedLines.pop();
        }

        return trimmedLines;
    }

    function filterSolutions(solutions, query) {
        const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

        if (tokens.length === 0) {
            return solutions;
        }

        return solutions.filter(solution => {
            const searchText = getSolutionSearchText(solution);
            return tokens.every(token => searchText.includes(token));
        });
    }

    function getSolutionSearchText(solution) {
        const metadata = solution.metadata;
        return [
            metadata.title,
            metadata.difficulty,
            metadata.tags,
            metadata.time,
            metadata.space,
            solution.path
        ].filter(Boolean).join(' ').toLowerCase();
    }

    function renderSolutionTable(refs, solutions) {
        refs.tableBodyElement.replaceChildren(...solutions.map(solution => renderSolutionRow(refs, solution)));
        refs.tableWrapElement.hidden = solutions.length === 0;

        if (solutions.length === 0) {
            activeSolutionPath = '';
            refs.detailElement.replaceChildren();
            setStatus(refs.statusElement, 'No matching solutions.');
            return;
        }

        setStatus(refs.statusElement, '');

        if (!solutions.some(solution => solution.path === activeSolutionPath)) {
            activeSolutionPath = '';
            refs.detailElement.replaceChildren();
        }
    }

    function renderSolutionRow(refs, solution) {
        const metadata = solution.metadata;
        const row = document.createElement('tr');

        row.className = 'solution-row';
        row.dataset.path = solution.path;
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.setAttribute('aria-controls', 'solutionDetail');
        row.setAttribute('aria-label', `Open ${metadata.title || solution.path}`);
        row.addEventListener('click', () => selectSolution(refs, solution));
        row.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectSolution(refs, solution);
            }
        });

        row.append(
            renderTableCell('Problem', metadata.title || solution.path, 'solution-title-cell'),
            renderTableCell('Difficulty', metadata.difficulty || 'unknown', `difficulty difficulty-${(metadata.difficulty || '').toLowerCase()}`),
            renderTableCell('Tags', metadata.tags || ''),
            renderTableCell('Time', metadata.time || ''),
            renderTableCell('Space', metadata.space || ''),
            renderTableCell('Open', 'View', 'solution-open-cell')
        );
        updateRowState(row);

        return row;
    }

    function renderTableCell(label, text, className) {
        const cell = document.createElement('td');
        cell.dataset.label = label;
        cell.textContent = text;

        if (className) {
            cell.className = className;
        }

        return cell;
    }

    function selectSolution(refs, solution) {
        if (activeSolutionPath === solution.path) {
            activeSolutionPath = '';
            refs.detailElement.replaceChildren();
        } else {
            activeSolutionPath = solution.path;
            refs.detailElement.replaceChildren(renderSolution(solution));
            highlightCodeBlocks(refs.detailElement);
        }

        refs.tableBodyElement.querySelectorAll('.solution-row').forEach(updateRowState);
    }

    function updateRowState(row) {
        const isActive = row.dataset.path === activeSolutionPath;
        const openCell = row.querySelector('.solution-open-cell');

        row.classList.toggle('is-active', isActive);
        row.setAttribute('aria-expanded', isActive ? 'true' : 'false');

        if (openCell) {
            openCell.textContent = isActive ? 'Close' : 'View';
        }
    }

    function renderSolution(solution) {
        const wrapper = createElement('section', 'solution-detail-panel');
        const article = createElement('article', 'solution-entry');
        const metadata = solution.metadata;

        article.appendChild(renderTitle(metadata, solution.path));
        article.appendChild(renderMetadata(metadata, solution.path));

        if (solution.warnings.length > 0) {
            article.appendChild(createElement('div', 'solution-warning', solution.warnings.join(' ')));
        }

        appendTextSection(article, 'Approach', metadata.approach);
        appendComplexity(article, metadata.time, metadata.space);
        appendTextSection(article, 'Notes', metadata.notes);
        article.appendChild(renderCodePanel(solution));

        wrapper.appendChild(article);
        return wrapper;
    }

    function renderTitle(metadata, solutionPath) {
        const titleElement = createElement('h3', 'solution-title');
        const title = metadata.title || solutionPath;
        const leetcodeUrl = getSafeHttpUrl(metadata.leetcode);

        if (leetcodeUrl) {
            const link = document.createElement('a');
            link.href = leetcodeUrl;
            link.textContent = title;
            titleElement.appendChild(link);
        } else {
            titleElement.textContent = title;
        }

        return titleElement;
    }

    function renderMetadata(metadata, solutionPath) {
        const metaElement = createElement('p', 'solution-meta');
        const difficulty = metadata.difficulty || 'unknown';
        const difficultyElement = createElement('span', `difficulty difficulty-${difficulty.toLowerCase()}`, difficulty);
        const sourceElement = document.createElement('span');
        const sourceLink = document.createElement('a');

        sourceLink.className = 'source-link';
        sourceLink.href = solutionPath;
        sourceLink.textContent = solutionPath;
        sourceElement.append('Source: ', sourceLink);

        metaElement.append('Difficulty: ', difficultyElement, ' ', sourceElement);

        if (metadata.tags) {
            metaElement.append(' ', createElement('span', 'solution-tags', `Tags: ${metadata.tags}`));
        }

        return metaElement;
    }

    function appendTextSection(parent, title, body) {
        if (!body) {
            return;
        }

        const section = createElement('div', 'solution-section');
        section.appendChild(createElement('h4', '', title));
        section.appendChild(createElement('p', '', body));
        parent.appendChild(section);
    }

    function appendComplexity(parent, timeComplexity, spaceComplexity) {
        if (!timeComplexity && !spaceComplexity) {
            return;
        }

        const wrapper = createElement('div', 'solution-complexity');
        wrapper.appendChild(renderComplexityItem('Time', timeComplexity || '?'));
        wrapper.appendChild(renderComplexityItem('Space', spaceComplexity || '?'));
        parent.appendChild(wrapper);
    }

    function renderComplexityItem(label, value) {
        const item = createElement('div', 'complexity-item');
        item.appendChild(createElement('span', 'complexity-label', label));
        item.appendChild(createElement('span', 'complexity-value', value));
        return item;
    }

    function renderCodePanel(solution) {
        const wrapper = createElement('div', 'code-panel');
        const pre = createElement('pre', 'solution-code');
        const code = document.createElement('code');

        code.className = 'language-cpp';
        code.textContent = solution.code;

        pre.appendChild(code);
        wrapper.appendChild(pre);
        return wrapper;
    }

    function highlightCodeBlocks(parent) {
        if (!window.hljs) {
            return;
        }

        parent.querySelectorAll('pre code').forEach(codeBlock => {
            window.hljs.highlightElement(codeBlock);
        });
    }

    function getSafeHttpUrl(url) {
        if (!url) {
            return '';
        }

        try {
            const parsedUrl = new URL(url, window.location.href);
            return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:' ? parsedUrl.href : '';
        } catch (error) {
            return '';
        }
    }

    function setStatus(statusElement, message, isError) {
        statusElement.textContent = message;
        statusElement.classList.toggle('is-error', Boolean(isError));
    }

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);

        if (className) {
            element.className = className;
        }

        if (typeof text === 'string') {
            element.textContent = text;
        }

        return element;
    }
})();
