(function () {
    const manifestPath = 'solutions.json';
    const testResultsPath = 'test-results.json';
    const executionTracesPath = 'execution-traces.json';
    const requiredFields = ['title', 'leetcode', 'difficulty', 'statement', 'time', 'space'];
    const fieldAliases = {
        'problem': 'title',
        'problem statement': 'statement',
        'leetcode url': 'leetcode',
        'url': 'leetcode',
        'notes': 'note',
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
            detailElement: document.querySelector('#solutionDetail'),
            footerElement: document.querySelector('footer'),
            debuggerResizeHandler: null
        };

        try {
            const solutionPaths = await loadSolutionPaths();

            if (solutionPaths.length === 0) {
                setStatus(refs.statusElement, 'No solutions listed yet.');
                return;
            }

            const [testResults, executionTraces] = await Promise.all([
                loadTestResults(),
                loadExecutionTraces()
            ]);
            const solutions = (await Promise.all(solutionPaths.map(loadSolution))).map(solution => ({
                ...solution,
                testResults: testResults.solutions[solution.path] || [],
                executionTraces: executionTraces.solutions[solution.path] || []
            }));
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

    async function loadTestResults() {
        const response = await fetch(testResultsPath);

        if (!response.ok) {
            return { solutions: {} };
        }

        const results = await response.json();
        return results && results.solutions ? results : { solutions: {} };
    }

    async function loadExecutionTraces() {
        const response = await fetch(executionTracesPath);

        if (!response.ok) {
            return { solutions: {} };
        }

        const traces = await response.json();
        return traces && traces.solutions ? traces : { solutions: {} };
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
        let codeStartLine = 1;

        if (commentMatch) {
            Object.assign(metadata, parseMetadata(commentMatch[1]));
            code = normalizedSource.slice(commentMatch[0].length).replace(/^\s*\n/, '');
            codeStartLine = normalizedSource.slice(0, normalizedSource.indexOf(code)).split('\n').length;
        }

        const warnings = requiredFields
            .filter(fieldName => !metadata[fieldName])
            .map(fieldName => `Missing ${fieldName} metadata.`);

        return {
            code,
            codeStartLine,
            metadata,
            path: solutionPath,
            warnings
        };
    }

    function parseMetadata(metadataBlock) {
        const values = {};
        let activeField = '';

        metadataBlock.split('\n').forEach(line => {
            const cleanLine = cleanMetadataLine(line);
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
            Object.entries(values).map(([fieldName, fieldValues]) => [fieldName, formatMetadataValue(fieldValues)])
        );
    }

    function cleanMetadataLine(line) {
        return line.replace(/^\s*\* ?/, '').trimEnd();
    }

    function formatMetadataValue(lines) {
        const paragraphs = [];
        let paragraphLines = [];

        trimBlankLines(lines).forEach(line => {
            if (line.trim() === '') {
                if (paragraphLines.length > 0) {
                    paragraphs.push(paragraphLines.join(' '));
                    paragraphLines = [];
                }

                return;
            }

            paragraphLines.push(line.trim());
        });

        if (paragraphLines.length > 0) {
            paragraphs.push(paragraphLines.join(' '));
        }

        return paragraphs.join('\n\n');
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
            solution.testResults.map(testResult => `${testResult.case} ${testResult.result}`).join(' '),
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
        const passedTests = solution.testResults.filter(testResult => testResult.status === 'pass').length;
        const totalTests = solution.testResults.length;
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
            renderTableCell('Passing', `${passedTests}/${totalTests}`, 'solution-passing-cell')
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
            refs.detailElement.replaceChildren(renderSolution(refs, solution));
            highlightCodeBlocks(refs.detailElement);
        }

        refs.tableBodyElement.querySelectorAll('.solution-row').forEach(updateRowState);
    }

    function updateRowState(row) {
        const isActive = row.dataset.path === activeSolutionPath;

        row.classList.toggle('is-active', isActive);
        row.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    }

    function renderSolution(refs, solution) {
        const wrapper = createElement('section', 'solution-detail-panel');
        const article = createElement('article', 'solution-entry');
        const metadata = solution.metadata;
        const codePanel = renderCodePanel(solution);

        article.appendChild(renderTitle(metadata, solution.path));
        appendTextSection(article, 'Problem statement', metadata.statement);
        article.appendChild(renderMetadata(metadata, solution.path));

        if (solution.warnings.length > 0) {
            article.appendChild(createElement('div', 'solution-warning', solution.warnings.join(' ')));
        }

        appendComplexity(article, metadata.time, metadata.space);
        article.appendChild(codePanel.element);
        article.appendChild(renderTestResults(
            solution.testResults,
            solution.executionTraces,
            (testResult, traceCase) => openDebugger(refs, solution, testResult, traceCase)
        ));
        appendTextSection(article, 'Note', metadata.note);

        wrapper.appendChild(article);
        return wrapper;
    }

    function openDebugger(refs, solution, testResult, traceCase) {
        const debuggerView = renderDebugger(refs, solution, testResult, traceCase);
        const controlsElement = refs.searchElement.closest('.solution-controls');

        refs.tableWrapElement.hidden = true;
        refs.detailElement.classList.add('is-debugging');

        if (controlsElement) {
            controlsElement.hidden = true;
        }

        if (refs.footerElement) {
            refs.footerElement.hidden = true;
        }

        refs.detailElement.replaceChildren(debuggerView);
        refs.detailElement.scrollIntoView({ block: 'start' });
        fitDebuggerToViewport(refs);
        refs.debuggerResizeHandler = () => fitDebuggerToViewport(refs);
        window.addEventListener('resize', refs.debuggerResizeHandler);
    }

    function closeDebugger(refs, solution) {
        const controlsElement = refs.searchElement.closest('.solution-controls');

        if (refs.debuggerResizeHandler) {
            window.removeEventListener('resize', refs.debuggerResizeHandler);
            refs.debuggerResizeHandler = null;
        }

        refs.tableWrapElement.hidden = false;
        refs.detailElement.classList.remove('is-debugging');

        if (controlsElement) {
            controlsElement.hidden = false;
        }

        if (refs.footerElement) {
            refs.footerElement.hidden = false;
        }

        refs.detailElement.replaceChildren(renderSolution(refs, solution));
        highlightCodeBlocks(refs.detailElement);
        refs.detailElement.scrollIntoView({ block: 'start' });
    }

    function fitDebuggerToViewport(refs) {
        const shell = refs.detailElement.querySelector('.solution-debugger-shell');

        if (!shell) {
            return;
        }

        const top = Math.max(0, shell.getBoundingClientRect().top);
        const availableHeight = Math.max(240, window.innerHeight - top - 8);
        shell.style.setProperty('--debugger-height', `${availableHeight}px`);
    }

    function renderDebugger(refs, solution, testResult, traceCase) {
        const shell = createElement('div', 'solution-debugger-shell');
        const wrapper = createElement('section', 'solution-detail-panel solution-debugger-view');
        const header = createElement('header', 'solution-debugger-header');
        const headingGroup = createElement('div', 'solution-debugger-heading');
        const backButton = createElement('button', 'solution-debugger-back', `Back to ${solution.metadata.title || 'problem'}`);
        const title = createElement('h3', '', `${solution.metadata.title || solution.path} debugger`);
        const caseLabel = createElement('p', 'solution-debugger-case', testResult.case);
        const result = createElement(
            'span',
            testResult.status === 'pass' ? 'solution-debugger-result is-pass' : 'solution-debugger-result is-fail',
            `${testResult.status === 'pass' ? 'Passing' : 'Failing'} · ${formatDuration(testResult.durationNs)}`
        );
        const codePanel = renderCodePanel(solution);

        backButton.type = 'button';
        backButton.addEventListener('click', () => closeDebugger(refs, solution));
        headingGroup.append(title, caseLabel);
        header.append(headingGroup, result);
        wrapper.append(header, codePanel.element);
        shell.append(backButton, wrapper);
        codePanel.selectTrace(testResult, traceCase);
        return shell;
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
        const toolbar = createElement('div', 'code-debug-toolbar');
        const debugInfo = createElement('div', 'code-debug-info');
        const selectedCase = createElement('strong', 'code-debug-case');
        const stepStatus = createElement('span', 'code-debug-status');
        const controls = createElement('div', 'code-debug-controls');
        const resetButton = createElement('button', '', 'Reset');
        const previousButton = createElement('button', '', 'Previous step');
        const nextButton = createElement('button', '', 'Next step');
        const allStepsButton = createElement('button', '', 'View all steps');
        const runtimePanel = createElement('section', 'code-debug-runtime');
        const stackPanel = createElement('div', 'code-debug-runtime-section');
        const heapPanel = createElement('div', 'code-debug-runtime-section');
        const allStepsPanel = createElement('section', 'code-debug-all-steps');
        const pre = createElement('pre', 'solution-code');
        const code = document.createElement('code');
        const sourceLines = solution.code.replace(/\n$/, '').split('\n');
        let activeSteps = [];
        let activeStepIndex = 0;

        code.className = 'language-cpp';
        code.textContent = solution.code;
        toolbar.hidden = true;
        resetButton.type = 'button';
        previousButton.type = 'button';
        nextButton.type = 'button';
        allStepsButton.type = 'button';
        allStepsButton.setAttribute('aria-expanded', 'false');
        runtimePanel.hidden = true;
        allStepsPanel.hidden = true;

        function updateAllStepSelection() {
            allStepsPanel.querySelectorAll('.code-debug-step').forEach((stepButton, index) => {
                const isCurrent = index === activeStepIndex;

                stepButton.classList.toggle('is-current', isCurrent);
                stepButton.setAttribute('aria-current', isCurrent ? 'step' : 'false');
            });
        }

        function renderAllSteps() {
            const list = createElement('ol', 'code-debug-step-list');

            activeSteps.forEach((step, index) => {
                const item = document.createElement('li');
                const stepButton = createElement('button', 'code-debug-step');
                const variables = Object.entries(step.variables || {})
                    .map(([name, value]) => `${name} = ${value}`)
                    .join(' · ');
                const metrics = `${formatDuration(step.durationNs)} · ${formatMemory(step.heapBytes)} heap (${formatSignedMemory(step.heapDeltaBytes)})`;

                stepButton.type = 'button';
                stepButton.setAttribute('aria-label', `Step ${index + 1}, line ${step.line}`);
                stepButton.append(
                    createElement('span', 'code-debug-step-number', String(index + 1)),
                    createElement('span', 'code-debug-step-line', String(step.line)),
                    createElement('span', 'code-debug-step-values', variables || 'No variables'),
                    createElement('span', 'code-debug-step-metrics', metrics)
                );
                stepButton.addEventListener('click', () => {
                    activeStepIndex = index;
                    renderActiveStep();
                });
                item.appendChild(stepButton);
                list.appendChild(item);
            });

            allStepsPanel.replaceChildren(list);
            updateAllStepSelection();
        }

        function renderRuntimeState(activeStep) {
            const stackValues = createElement('dl', 'code-debug-runtime-values');
            const variableEntries = Object.entries(activeStep.stackVariables || activeStep.variables || {});

            stackPanel.replaceChildren(createElement('h4', '', 'Stack'));
            if (variableEntries.length === 0) {
                stackPanel.appendChild(createElement('p', 'code-debug-runtime-empty', 'No variables'));
            } else {
                variableEntries.forEach(([name, value]) => {
                    const row = createElement('div', 'code-debug-runtime-row');

                    row.append(
                        createElement('dt', '', name),
                        createElement('dd', '', String(value))
                    );
                    stackValues.appendChild(row);
                });
                stackPanel.appendChild(stackValues);
            }

            const heapValues = createElement('dl', 'code-debug-runtime-values');
            const liveHeapRow = createElement('div', 'code-debug-runtime-row');
            const heapDeltaRow = createElement('div', 'code-debug-runtime-row');

            liveHeapRow.append(
                createElement('dt', '', 'Live'),
                createElement('dd', '', formatMemory(activeStep.heapBytes))
            );
            heapDeltaRow.append(
                createElement('dt', '', 'Change'),
                createElement('dd', '', formatSignedMemory(activeStep.heapDeltaBytes))
            );
            heapValues.append(liveHeapRow, heapDeltaRow);
            heapPanel.replaceChildren(
                createElement('h4', '', 'Heap'),
                heapValues
            );
        }

        function renderActiveStep() {
            const activeStep = activeSteps[activeStepIndex];
            const fragment = document.createDocumentFragment();

            sourceLines.forEach((sourceLine, index) => {
                const sourceLineNumber = solution.codeStartLine + index;
                const line = createElement('span', 'solution-code-line');
                const lineNumber = createElement('span', 'solution-code-line-number', String(sourceLineNumber));
                const lineText = createElement('span', 'solution-code-line-text', sourceLine || ' ');

                line.append(lineNumber, lineText);

                if (sourceLineNumber === Number(activeStep.line)) {
                    line.classList.add('is-active');
                }

                fragment.appendChild(line);
            });

            code.className = 'solution-code-debug';
            code.replaceChildren(fragment);
            stepStatus.textContent = `Step ${activeStepIndex + 1} of ${activeSteps.length} · line ${activeStep.line} · ${formatDuration(activeStep.durationNs)} · ${formatMemory(activeStep.heapBytes)} heap (${formatSignedMemory(activeStep.heapDeltaBytes)})`;
            renderRuntimeState(activeStep);
            resetButton.disabled = activeStepIndex === 0;
            previousButton.disabled = activeStepIndex === 0;
            nextButton.disabled = activeStepIndex === activeSteps.length - 1;
            updateAllStepSelection();

            const activeLine = code.querySelector('.solution-code-line.is-active');

            if (activeLine) {
                activeLine.scrollIntoView({ block: 'nearest' });
            }
        }

        function selectTrace(testResult, traceCase) {
            if (!traceCase || !Array.isArray(traceCase.steps) || traceCase.steps.length === 0) {
                return;
            }

            const stackVariables = {};
            activeSteps = traceCase.steps.map(step => {
                Object.assign(stackVariables, step.variables || {});
                return {
                    ...step,
                    stackVariables: { ...stackVariables }
                };
            });
            activeStepIndex = 0;
            selectedCase.textContent = testResult.case;
            toolbar.hidden = false;
            runtimePanel.hidden = false;
            allStepsPanel.hidden = true;
            allStepsButton.textContent = 'View all steps';
            allStepsButton.setAttribute('aria-expanded', 'false');
            pre.classList.add('is-debugging');
            renderAllSteps();
            renderActiveStep();
        }

        resetButton.addEventListener('click', () => {
            activeStepIndex = 0;
            renderActiveStep();
        });
        previousButton.addEventListener('click', () => {
            activeStepIndex = Math.max(0, activeStepIndex - 1);
            renderActiveStep();
        });
        nextButton.addEventListener('click', () => {
            activeStepIndex = Math.min(activeSteps.length - 1, activeStepIndex + 1);
            renderActiveStep();
        });
        allStepsButton.addEventListener('click', () => {
            const isOpening = allStepsPanel.hidden;

            allStepsPanel.hidden = !isOpening;
            allStepsButton.textContent = isOpening ? 'Hide all steps' : 'View all steps';
            allStepsButton.setAttribute('aria-expanded', isOpening ? 'true' : 'false');
        });

        debugInfo.append(selectedCase, stepStatus);
        controls.append(resetButton, previousButton, nextButton, allStepsButton);
        toolbar.append(debugInfo, controls);
        runtimePanel.append(stackPanel, heapPanel);
        pre.appendChild(code);
        wrapper.append(toolbar, runtimePanel, allStepsPanel, pre);
        return { element: wrapper, selectTrace };
    }

    function renderTestResults(testResults, executionTraces, openTrace) {
        const section = createElement('section', 'test-results-panel');
        const header = createElement('div', 'test-results-header');
        const passedCount = testResults.filter(testResult => testResult.status === 'pass').length;
        const failedCount = testResults.filter(testResult => testResult.status !== 'pass').length;
        const measuredDurations = testResults
            .map(testResult => Number(testResult.durationNs))
            .filter(Number.isFinite);
        const totalDurationNs = measuredDurations.reduce((sum, durationNs) => sum + durationNs, 0);
        const hasPlayableTrace = executionTraces.some(
            traceCase => Array.isArray(traceCase.steps) && traceCase.steps.length > 0
        );

        header.appendChild(createElement('h4', '', 'Verified Tests'));
        const summaryText = measuredDurations.length > 0
            ? `${passedCount}/${testResults.length} passing · ${formatDuration(totalDurationNs)} total`
            : `${passedCount}/${testResults.length} passing`;
        header.appendChild(createElement('span', failedCount === 0 ? 'test-summary is-pass' : 'test-summary is-fail', summaryText));
        section.appendChild(header);

        if (hasPlayableTrace) {
            section.appendChild(createElement(
                'p',
                'test-results-debug-hint',
                'Click any verified test to see how I would debug it.'
            ));
        }

        if (testResults.length === 0) {
            section.appendChild(createElement('p', 'test-results-empty', 'No local test results have been generated yet.'));
            return section;
        }

        const list = createElement('ul', 'test-results-list');
        const traceByCase = new Map(executionTraces.map(traceCase => [traceCase.case, traceCase]));
        let selectedTestItem = null;

        list.setAttribute('role', 'listbox');
        testResults.forEach(testResult => {
            const traceCase = traceByCase.get(testResult.case);
            const testItem = renderTestResult(testResult, traceCase, () => {
                if (selectedTestItem) {
                    selectedTestItem.classList.remove('is-selected');
                    selectedTestItem.setAttribute('aria-selected', 'false');
                }

                selectedTestItem = testItem;
                testItem.classList.add('is-selected');
                testItem.setAttribute('aria-selected', 'true');
                openTrace(testResult, traceCase);
            });

            list.appendChild(testItem);
        });
        section.appendChild(list);
        return section;
    }

    function renderTestResult(testResult, traceCase, selectTest) {
        const item = createElement('li', testResult.status === 'pass' ? 'test-result is-pass' : 'test-result is-fail');
        const summary = createElement('div', 'test-result-summary');
        const icon = document.createElement('i');
        const label = createElement('span', 'test-case-label', testResult.case);
        const result = createElement('span', 'test-case-result', testResult.status === 'pass' ? testResult.result : `expected ${testResult.expected}, got ${testResult.result}`);
        const duration = Number.isFinite(Number(testResult.durationNs))
            ? createElement('span', 'test-case-duration', formatDuration(Number(testResult.durationNs)))
            : null;

        icon.className = testResult.status === 'pass' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark';
        icon.setAttribute('aria-hidden', 'true');
        summary.append(icon, label);

        if (duration) {
            summary.appendChild(duration);
        }

        summary.appendChild(result);
        item.appendChild(summary);

        if (traceCase && Array.isArray(traceCase.steps) && traceCase.steps.length > 0) {
            item.classList.add('is-selectable');
            item.tabIndex = 0;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', 'false');
            item.addEventListener('click', selectTest);
            item.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectTest();
                }
            });
        }

        return item;
    }

    function formatDuration(durationNs) {
        return `${Math.round(Number(durationNs) || 0)} ns`;
    }

    function formatMemory(bytes) {
        return `${Math.round(Number(bytes) || 0)} B`;
    }

    function formatSignedMemory(bytes) {
        const value = Math.round(Number(bytes) || 0);
        return `${value > 0 ? '+' : ''}${value} B`;
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
