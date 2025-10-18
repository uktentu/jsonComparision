// JSON Comparison Tool - Main Application Logic

class JSONComparator {
    constructor() {
        this.currentView = 'compare';
        this.viewMode = 'tree';
        this.apiResponses = { api1: null, api2: null };
        this.options = {
            mode: 'exact',
            arrayMatching: 'id',
            normalizeStrings: false,
            ignoreTimestamps: false,
            ignoreKeyOrder: true,
            numericTolerance: 0,
            includePaths: [],
            excludePaths: [],
            caseSensitive: true,
            ignoreExtraKeys: false
        };
        
        // Initialize the application
        this.initializeApp();
        this.init();

    compareValues(value1, value2, path) {
        // Handle null and undefined
        if (value1 === null && value2 === null) return null;
        if (value1 === undefined && value2 === undefined) return null;
        
        if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) {
            return {
                type: 'modified',
                path,
                oldValue: value1,
                newValue: value2
            };
        }
        
        // Apply transformations if enabled
        let processedValue1 = value1;
        let processedValue2 = value2;
        
        if (this.options && this.options.normalizeStrings && typeof value1 === 'string' && typeof value2 === 'string') {
            processedValue1 = value1.trim().toLowerCase();
            processedValue2 = value2.trim().toLowerCase();
        }
        
        if (this.options && this.options.ignoreTimestamps && this.isTimestamp(path)) {
            return null; // Ignore timestamp differences
        }
        
        if (this.options && this.options.numericTolerance > 0 && typeof value1 === 'number' && typeof value2 === 'number') {
            if (Math.abs(value1 - value2) <= this.options.numericTolerance) {
                return null; // Within tolerance
            }
        }
        
        // Type comparison mode
        if (this.options && this.options.mode === 'type') {
            if (typeof processedValue1 !== typeof processedValue2) {
                return {
                    type: 'modified',
                    path,
                    oldValue: `${typeof value1}: ${value1}`,
                    newValue: `${typeof value2}: ${value2}`
                };
            }
            return null; // Types match, consider equal in type-only mode
        }
        
        // Handle arrays with advanced matching
        if (Array.isArray(value1) && Array.isArray(value2)) {
            return this.compareArraysAdvanced(value1, value2, path);
        }
        
        // Handle objects
        if (typeof value1 === 'object' && typeof value2 === 'object') {
            const nestedDiffs = this.compareObjects(value1, value2, path);
            return nestedDiffs && nestedDiffs.length > 0 ? nestedDiffs : null;
        }
        
        // Handle primitives
        const caseSensitive = this.options ? this.options.caseSensitive : true;
        const equal = caseSensitive ? 
            processedValue1 === processedValue2 : 
            String(processedValue1).toLowerCase() === String(processedValue2).toLowerCase();
            
        if (equal) {
            return null;
        }
        
        return {
            type: 'modified',
            path,
            oldValue: value1,
            newValue: value2
        };
    }
    
    compareArraysAdvanced(arr1, arr2, path) {
        const arrayMatching = this.options ? this.options.arrayMatching : 'index';
        switch (arrayMatching) {
            case 'id':
                return this.compareArraysByID(arr1, arr2, path);
            case 'hash':
                return this.compareArraysByHash(arr1, arr2, path);
            case 'best_match':
                return this.compareArraysByBestMatch(arr1, arr2, path);
            default: // 'index'
                return this.compareArraysByIndex(arr1, arr2, path);
        }
    }
    
    compareArraysByID(arr1, arr2, path) {
        // Implementation for ID-based array comparison
        if (this.options && this.options.mode === 'ignore-order') {
            const set1 = new Set(arr1.map(item => this.getItemID(item)));
            const set2 = new Set(arr2.map(item => this.getItemID(item)));
            
            if (set1.size === set2.size && [...set1].every(id => set2.has(id))) {
                return null;
            }
        }
        
        return this.compareArraysByIndex(arr1, arr2, path);
    }
    
    compareArraysByHash(arr1, arr2, path) {
        // Simple hash-based comparison
        const hash1 = this.hashArray(arr1);
        const hash2 = this.hashArray(arr2);
        
        if (hash1 === hash2) return null;
        
        return {
            type: 'modified',
            path,
            oldValue: arr1,
            newValue: arr2
        };
    }
    
    compareArraysByBestMatch(arr1, arr2, path) {
        // Simplified best match algorithm
        if (arr1.length !== arr2.length) {
            return {
                type: 'modified',
                path,
                oldValue: arr1,
                newValue: arr2
            };
        }
        
        // For now, fall back to index comparison
        return this.compareArraysByIndex(arr1, arr2, path);
    }
    
    compareArraysByIndex(arr1, arr2, path) {
        if (this.options && this.options.mode === 'ignore-order') {
            const set1 = new Set(arr1.map(item => JSON.stringify(item)));
            const set2 = new Set(arr2.map(item => JSON.stringify(item)));
            
            if (set1.size === set2.size && [...set1].every(item => set2.has(item))) {
                return null;
            }
        }
        
        if (JSON.stringify(arr1) === JSON.stringify(arr2)) {
            return null;
        }
        
        return {
            type: 'modified',
            path,
            oldValue: arr1,
            newValue: arr2
        };
    }
    
    getItemID(item) {
        if (typeof item === 'object' && item !== null) {
            return item.id || item._id || item.key || JSON.stringify(item);
        }
        return item;
    }
    
    hashArray(arr) {
        return JSON.stringify(arr.map(item => 
            typeof item === 'object' ? JSON.stringify(item) : item
        ).sort());
    }
    
    isTimestamp(path) {
        const timestampPatterns = [
            /timestamp/i,
            /created.*at/i,
            /updated.*at/i,
            /modified.*at/i,
            /date/i,
            /time/i
        ];
        
        return timestampPatterns.some(pattern => pattern.test(path));
    }
    
    shouldIncludePath(path) {
        // Check include/exclude patterns
        if (this.options && this.options.includePaths && this.options.includePaths.length > 0) {
            return this.options.includePaths.some(pattern => 
                this.matchesPattern(path, pattern)
            );
        }
        
        if (this.options && this.options.excludePaths && this.options.excludePaths.length > 0) {
            return !this.options.excludePaths.some(pattern => 
                this.matchesPattern(path, pattern)
            );
        }
        
        return true;
    }
    
    matchesPattern(path, pattern) {
        // Simple pattern matching (in real implementation, would use JSONPath library)
        return path.includes(pattern.replace(/\*|\[\]|\$/g, ''));
    }

    // Initialize additional properties
    initializeApp() {
        this.lastComparison = null;
        this.currentDiffIndex = 0;
        this.filteredDiffs = [];
        this.savedRequests = [];
        this.lineByLineData = null;
        
        this.exampleData = {
            json1: {
                "timestamp": "2025-10-18T10:00:00Z",
                "version": "1.0",
                "users": [
                    {
                        "id": 101,
                        "name": "Alice Johnson",
                        "email": "alice@company.com",
                        "age": 28,
                        "department": "Engineering",
                        "salary": 95000,
                        "skills": ["Python", "JavaScript", "React"],
                        "metadata": {
                            "created": "2023-01-15",
                            "lastLogin": "2025-10-17"
                        }
                    },
                    {
                        "id": 102,
                        "name": "Bob Smith",
                        "email": "bob@company.com",
                        "age": 35,
                        "department": "Marketing",
                        "salary": 78000,
                        "skills": ["SEO", "Content Marketing"],
                        "metadata": {
                            "created": "2022-06-20",
                            "lastLogin": "2025-10-16"
                        }
                    },
                    {
                        "id": 103,
                        "name": "Carol White",
                        "email": "carol@company.com",
                        "age": 42,
                        "department": "Sales",
                        "salary": 88000,
                        "skills": ["Negotiation", "CRM"],
                        "metadata": {
                            "created": "2021-03-10",
                            "lastLogin": "2025-10-15"
                        }
                    }
                ],
                "totalCount": 3
            },
            json2: {
                "timestamp": "2025-10-18T12:00:00Z",
                "version": "1.1",
                "users": [
                    {
                        "id": 101,
                        "name": "Alice Johnson",
                        "email": "alice@company.com",
                        "age": 29,
                        "department": "Engineering",
                        "salary": 98000,
                        "skills": ["Python", "JavaScript", "React", "Node.js"],
                        "metadata": {
                            "created": "2023-01-15",
                            "lastLogin": "2025-10-18"
                        }
                    },
                    {
                        "id": 102,
                        "name": "Bob Smith",
                        "email": "bob@company.com",
                        "age": 35,
                        "department": "Marketing",
                        "salary": 78000,
                        "skills": ["SEO", "Content Marketing"],
                        "metadata": {
                            "created": "2022-06-20",
                            "lastLogin": "2025-10-16"
                        }
                    },
                    {
                        "id": 104,
                        "name": "David Brown",
                        "email": "david@company.com",
                        "age": 31,
                        "department": "Engineering",
                        "salary": 92000,
                        "skills": ["Java", "Spring Boot", "Microservices"],
                        "metadata": {
                            "created": "2025-10-01",
                            "lastLogin": "2025-10-18"
                        }
                    }
                ],
                "totalCount": 3
            },
            idPath: 'users[].id'
        };
        
        return this;
    }

    init() {
        console.log('Initializing JSONComparator...');
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.loadSettings();
        this.updateCharCounts();
        console.log('JSONComparator initialization complete');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        // Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });
        
        // View Mode Toggle
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchViewMode(e.target.dataset.view);
            });
        });
        
        // Header Actions
        document.getElementById('dark-mode-toggle').addEventListener('click', () => this.toggleDarkMode());
        document.getElementById('help-btn').addEventListener('click', () => this.showHelp());

        // JSON Input Events
        const jsonInput1 = document.getElementById('json-input-1');
        const jsonInput2 = document.getElementById('json-input-2');
        
        jsonInput1.addEventListener('input', () => this.handleJSONInput(1));
        jsonInput2.addEventListener('input', () => this.handleJSONInput(2));

        // Control buttons - Compare view
        const pasteBtn1 = document.getElementById('paste-json-1');
        const pasteBtn2 = document.getElementById('paste-json-2');
        const clearBtn1 = document.getElementById('clear-json-1');
        const clearBtn2 = document.getElementById('clear-json-2');
        const formatBtn1 = document.getElementById('format-json-1');
        const formatBtn2 = document.getElementById('format-json-2');
        const uploadBtn1 = document.getElementById('upload-json-1');
        const uploadBtn2 = document.getElementById('upload-json-2');
        
        console.log('Button elements found:');
        console.log('clearBtn1:', !!clearBtn1);
        console.log('clearBtn2:', !!clearBtn2);
        console.log('formatBtn1:', !!formatBtn1);
        console.log('formatBtn2:', !!formatBtn2);
        console.log('pasteBtn1:', !!pasteBtn1);
        console.log('pasteBtn2:', !!pasteBtn2);
        
        if (pasteBtn1) pasteBtn1.addEventListener('click', () => this.pasteJSON(1));
        if (pasteBtn2) pasteBtn2.addEventListener('click', () => this.pasteJSON(2));
        if (clearBtn1) {
            clearBtn1.addEventListener('click', () => {
                console.log('Clear JSON 1 clicked');
                this.clearJSON(1);
            });
            console.log('Clear JSON 1 button event listener added');
        } else {
            console.error('Clear JSON 1 button not found!');
        }
        if (clearBtn2) {
            clearBtn2.addEventListener('click', () => {
                console.log('Clear JSON 2 clicked');
                this.clearJSON(2);
            });
            console.log('Clear JSON 2 button event listener added');
        } else {
            console.error('Clear JSON 2 button not found!');
        }
        if (formatBtn1) {
            formatBtn1.addEventListener('click', () => {
                console.log('Format JSON 1 clicked');
                this.formatJSON(1);
            });
            console.log('Format JSON 1 button event listener added');
        } else {
            console.error('Format JSON 1 button not found!');
        }
        if (formatBtn2) {
            formatBtn2.addEventListener('click', () => {
                console.log('Format JSON 2 clicked');
                this.formatJSON(2);
            });
            console.log('Format JSON 2 button event listener added');
        } else {
            console.error('Format JSON 2 button not found!');
        }
        if (uploadBtn1) uploadBtn1.addEventListener('change', (e) => this.uploadJSON(1, e));
        if (uploadBtn2) uploadBtn2.addEventListener('change', (e) => this.uploadJSON(2, e));
        
        const compareBtn = document.getElementById('compare-btn');
        const swapBtn = document.getElementById('swap-btn');
        const loadExampleBtn = document.getElementById('load-example');
        
        console.log('Main control buttons found:');
        console.log('compareBtn:', !!compareBtn);
        console.log('swapBtn:', !!swapBtn);
        console.log('loadExampleBtn:', !!loadExampleBtn);
        
        if (compareBtn) {
            compareBtn.addEventListener('click', () => {
                console.log('Compare JSONs clicked');
                this.compareJSONs();
            });
            console.log('Compare button event listener added');
        } else {
            console.error('Compare button not found!');
        }
        if (swapBtn) {
            swapBtn.addEventListener('click', () => {
                console.log('Swap JSONs clicked');
                this.swapJSONs();
            });
            console.log('Swap button event listener added');
        } else {
            console.error('Swap button not found!');
        }
        if (loadExampleBtn) {
            loadExampleBtn.addEventListener('click', () => {
                console.log('Load Example clicked');
                this.loadExample();
            });
            console.log('Load Example button event listener added');
        } else {
            console.error('Load Example button not found!');
        }
        
        // Results controls
        const exportJsonBtn = document.getElementById('export-json');
        const exportHtmlBtn = document.getElementById('export-html');
        const collapseResultsBtn = document.getElementById('collapse-results');
        
        if (exportJsonBtn) exportJsonBtn.addEventListener('click', () => this.exportResults('json'));
        if (exportHtmlBtn) exportHtmlBtn.addEventListener('click', () => this.exportResults('html'));
        if (collapseResultsBtn) collapseResultsBtn.addEventListener('click', () => this.collapseResults());
        
        // Results tabs
        document.querySelectorAll('.results-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchResultsTab(e.target.dataset.tab);
            });
        });

        // API Fetch Events
        const fetchApi1Btn = document.getElementById('fetch-api-1');
        const fetchApi2Btn = document.getElementById('fetch-api-2');
        const useResponse1Btn = document.getElementById('use-response-1');
        const useResponse2Btn = document.getElementById('use-response-2');
        const compareResponsesBtn = document.getElementById('compare-responses');
        
        if (fetchApi1Btn) fetchApi1Btn.addEventListener('click', () => this.fetchAPI(1));
        if (fetchApi2Btn) fetchApi2Btn.addEventListener('click', () => this.fetchAPI(2));
        if (useResponse1Btn) useResponse1Btn.addEventListener('click', () => this.useAPIResponse(1));
        if (useResponse2Btn) useResponse2Btn.addEventListener('click', () => this.useAPIResponse(2));
        if (compareResponsesBtn) compareResponsesBtn.addEventListener('click', () => this.compareAPIResponses());
        
        // Header management
        const addHeader1Btn = document.getElementById('add-header-1');
        const addHeader2Btn = document.getElementById('add-header-2');
        
        if (addHeader1Btn) addHeader1Btn.addEventListener('click', () => this.addHeader(1));
        if (addHeader2Btn) addHeader2Btn.addEventListener('click', () => this.addHeader(2));
        
        // Advanced settings
        const pathExamplesBtn = document.getElementById('path-examples');
        if (pathExamplesBtn) pathExamplesBtn.addEventListener('click', () => this.showPathExamples());
        
        // Report generation
        const generateReportBtn = document.getElementById('generate-report-btn');
        const generateReportMainBtn = document.getElementById('generate-report-main');
        const generateReportFinalBtn = document.getElementById('generate-report-final');
        const cancelReportBtn = document.getElementById('cancel-report');
        const closeReportModalBtn = document.getElementById('close-report-modal');
        
        if (generateReportBtn) generateReportBtn.addEventListener('click', () => this.showReportModal());
        if (generateReportMainBtn) generateReportMainBtn.addEventListener('click', () => this.showReportModal());
        if (generateReportFinalBtn) generateReportFinalBtn.addEventListener('click', () => this.generateReport());
        if (cancelReportBtn) cancelReportBtn.addEventListener('click', () => this.hideReportModal());
        if (closeReportModalBtn) closeReportModalBtn.addEventListener('click', () => this.hideReportModal());
        
        // Diff navigation
        const prevDiffBtn = document.getElementById('prev-diff');
        const nextDiffBtn = document.getElementById('next-diff');
        const searchDiffsInput = document.getElementById('search-diffs');
        
        if (prevDiffBtn) prevDiffBtn.addEventListener('click', () => this.navigateDiff(-1));
        if (nextDiffBtn) nextDiffBtn.addEventListener('click', () => this.navigateDiff(1));
        if (searchDiffsInput) searchDiffsInput.addEventListener('input', (e) => this.searchDiffs(e.target.value));
        
        // Filter controls
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterDiffs(e.target.dataset.filter);
            });
        });
        
        // Report format change
        document.addEventListener('change', (e) => {
            if (e.target.name === 'report-format') {
                this.updateReportPreview();
            }
        });
        
        // Settings events
        const defaultIdKeyInput = document.getElementById('default-id-key');
        const themeSelectorSelect = document.getElementById('theme-selector');
        const fontSizeSelect = document.getElementById('font-size');
        const maxSizeInput = document.getElementById('max-size');
        
        if (defaultIdKeyInput) {
            defaultIdKeyInput.addEventListener('input', (e) => {
                const idKeyInput = document.getElementById('id-key-input');
                if (idKeyInput) idKeyInput.value = e.target.value;
            });
        }
        
        if (themeSelectorSelect) {
            themeSelectorSelect.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
            });
        }
        
        if (fontSizeSelect) {
            fontSizeSelect.addEventListener('change', (e) => {
                this.setFontSize(e.target.value);
            });
        }
        
        if (maxSizeInput) {
            maxSizeInput.addEventListener('input', (e) => {
                const maxSizeValue = document.getElementById('max-size-value');
                if (maxSizeValue) maxSizeValue.textContent = e.target.value + ' KB';
            });
        }
        
        // Remove header buttons (delegated)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-header')) {
                e.target.parentElement.remove();
            }
        });
        
        // Line-by-line synchronized scrolling
        this.setupSynchronizedScrolling();
        
        console.log('Event listeners setup complete');
        console.log('Total buttons checked:', document.querySelectorAll('button').length);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey)) {
                switch(e.key) {
                    case 'Enter':
                        e.preventDefault();
                        this.compareJSONs();
                        break;
                    case 'k':
                        e.preventDefault();
                        this.clearAllJSON();
                        break;
                    case 'f':
                        e.preventDefault();
                        if (e.shiftKey) {
                            // Ctrl/Cmd + Shift + F for search in results
                            const searchInput = document.getElementById('search-diffs');
                            if (searchInput) searchInput.focus();
                        } else {
                            this.formatAllJSON();
                        }
                        break;
                    case 's':
                        e.preventDefault();
                        this.swapJSONs();
                        break;
                    case 'e':
                        e.preventDefault();
                        this.loadExample();
                        break;
                    case 'r':
                        e.preventDefault();
                        if (this.lastComparison) {
                            this.showReportModal();
                        }
                        break;
                }
            } else if (e.altKey) {
                switch(e.key) {
                    case 'ArrowUp':
                        e.preventDefault();
                        this.navigateDiff(-1);
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        this.navigateDiff(1);
                        break;
                }
            } else if (e.key === 'F1') {
                e.preventDefault();
                this.showHelp();
            }
        }
    }

    switchView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Hide all nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show selected view
        document.getElementById(`${viewName}-view`).classList.add('active');
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
        
        this.currentView = viewName;
    }
    switchViewMode(mode) {
        // Update view mode buttons
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${mode}"]`).classList.add('active');
        
        this.viewMode = mode;
        
        // If we have comparison results, update the display
        if (this.lastComparison) {
            this.displayResults(this.lastComparison);
        }
    }
    toggleDarkMode() {
        const currentScheme = document.documentElement.getAttribute('data-color-scheme');
        const newScheme = currentScheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newScheme);
        
        const btn = document.getElementById('dark-mode-toggle');
        btn.textContent = newScheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
    }
    showHelp() {
        document.getElementById('help-modal').classList.add('show');
    }
    setupSynchronizedScrolling() {
        // Will be implemented when line-by-line view is created
        this.syncScrolling = false;
    }

    handleJSONInput(inputNumber) {
        const input = document.getElementById(`json-input-${inputNumber}`);
        const validation = document.getElementById(`validation-${inputNumber}`);
        const charCount = document.getElementById(`char-count-${inputNumber}`);
        
        const content = input.value;
        charCount.textContent = `${content.length} characters`;
        
        if (content.trim()) {
            try {
                JSON.parse(content);
                validation.textContent = '✓ Valid JSON';
                validation.className = 'validation-status valid';
            } catch (e) {
                validation.textContent = '✗ Invalid JSON';
                validation.className = 'validation-status invalid';
            }
        } else {
            validation.textContent = '';
            validation.className = 'validation-status';
        }
    }

    updateCharCounts() {
        [1, 2].forEach(num => {
            const input = document.getElementById(`json-input-${num}`);
            const charCount = document.getElementById(`char-count-${num}`);
            charCount.textContent = `${input.value.length} characters`;
        });
    }

    async pasteJSON(inputNumber) {
        try {
            const text = await navigator.clipboard.readText();
            const input = document.getElementById(`json-input-${inputNumber}`);
            input.value = text;
            this.handleJSONInput(inputNumber);
            
            // Auto-format if setting is enabled
            if (document.getElementById('auto-format').checked) {
                this.formatJSON(inputNumber);
            }
        } catch (err) {
            alert('Failed to paste from clipboard. Please paste manually.');
        }
    }

    clearJSON(inputNumber) {
        console.log(`Clearing JSON ${inputNumber}`);
        const input = document.getElementById(`json-input-${inputNumber}`);
        if (input) {
            input.value = '';
            this.handleJSONInput(inputNumber);
            console.log(`JSON ${inputNumber} cleared successfully`);
        } else {
            console.error(`Could not find input element json-input-${inputNumber}`);
        }
    }

    clearAllJSON() {
        this.clearJSON(1);
        this.clearJSON(2);
    }

    formatJSON(inputNumber) {
        console.log(`Formatting JSON ${inputNumber}`);
        const input = document.getElementById(`json-input-${inputNumber}`);
        if (!input) {
            console.error(`Could not find input element json-input-${inputNumber}`);
            return;
        }
        try {
            const parsed = JSON.parse(input.value);
            input.value = JSON.stringify(parsed, null, 2);
            this.handleJSONInput(inputNumber);
            console.log(`JSON ${inputNumber} formatted successfully`);
        } catch (e) {
            console.error(`Failed to format JSON ${inputNumber}:`, e);
            alert('Cannot format invalid JSON: ' + e.message);
        }
    }

    formatAllJSON() {
        this.formatJSON(1);
        this.formatJSON(2);
    }

    uploadJSON(inputNumber, event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const input = document.getElementById(`json-input-${inputNumber}`);
            input.value = e.target.result;
            this.handleJSONInput(inputNumber);
            
            if (document.getElementById('auto-format').checked) {
                this.formatJSON(inputNumber);
            }
        };
        reader.readAsText(file);
    }

    swapJSONs() {
        console.log('Swapping JSONs');
        const input1 = document.getElementById('json-input-1');
        const input2 = document.getElementById('json-input-2');
        
        if (!input1 || !input2) {
            console.error('Could not find JSON input elements');
            return;
        }
        
        const temp = input1.value;
        input1.value = input2.value;
        input2.value = temp;
        
        this.handleJSONInput(1);
        this.handleJSONInput(2);
        console.log('JSONs swapped successfully');
    }

    loadExample() {
        console.log('Loading example data');
        const input1 = document.getElementById('json-input-1');
        const input2 = document.getElementById('json-input-2');
        const idKeyInput = document.getElementById('id-key-input');
        
        if (!input1 || !input2) {
            console.error('Could not find JSON input elements');
            return;
        }
        
        input1.value = JSON.stringify(this.exampleData.json1, null, 2);
        input2.value = JSON.stringify(this.exampleData.json2, null, 2);
        
        if (idKeyInput) {
            idKeyInput.value = this.exampleData.idPath;
        }
        
        this.handleJSONInput(1);
        this.handleJSONInput(2);
        console.log('Example data loaded successfully');
    }

    compareJSONs() {
        console.log('Starting JSON comparison...');
        
        const input1 = document.getElementById('json-input-1');
        const input2 = document.getElementById('json-input-2');
        const idKeyInput = document.getElementById('id-key-input');
        
        if (!input1 || !input2) {
            console.error('JSON input elements not found');
            alert('JSON input elements not found');
            return;
        }
        
        const json1Text = input1.value;
        const json2Text = input2.value;
        const idKey = idKeyInput ? idKeyInput.value : '';
        const comparisonMode = document.getElementById('comparison-mode')?.value || 'exact';
        const ignoreExtraKeys = document.getElementById('ignore-extra-keys')?.checked || false;
        const caseSensitive = document.getElementById('case-sensitive')?.checked || true;
        
        if (!json1Text.trim()) {
            alert('Please provide JSON 1 input');
            return;
        }
        
        if (!json2Text.trim()) {
            alert('Please provide JSON 2 input');
            return;
        }
        
        console.log('Both JSON inputs provided, parsing...');
        
        try {
            const json1 = JSON.parse(json1Text);
            const json2 = JSON.parse(json2Text);
            console.log('JSON parsing successful');
            
            this.showLoading(true);
            
            setTimeout(() => {
                try {
                    console.log('Starting comparison with options:', {
                        idKey,
                        mode: comparisonMode,
                        ignoreExtraKeys,
                        caseSensitive
                    });
                    
                    const comparison = this.performComparison(json1, json2, {
                        idKey,
                        mode: comparisonMode,
                        ignoreExtraKeys,
                        caseSensitive
                    });
                    
                    console.log('Comparison result:', comparison);
                    this.lastComparison = comparison;
                    this.displayResults(comparison);
                    console.log('Results displayed successfully');
                } catch (error) {
                    console.error('Comparison failed:', error);
                    alert('Comparison failed: ' + error.message);
                } finally {
                    this.showLoading(false);
                }
            }, 100);
            
        } catch (e) {
            console.error('JSON parsing failed:', e);
            alert('Please ensure both inputs contain valid JSON: ' + e.message);
        }
    }

    performComparison(json1, json2, options) {
        const startTime = performance.now();
        
        // Get advanced settings with fallbacks
        const arrayMatching = document.getElementById('array-matching')?.value || 'id';
        const normalizeStrings = document.getElementById('normalize-strings')?.checked || false;
        const ignoreTimestamps = document.getElementById('ignore-timestamps')?.checked || false;
        const ignoreKeyOrder = document.getElementById('ignore-key-order')?.checked || true;
        const numericTolerance = parseFloat(document.getElementById('numeric-tolerance')?.value || '0') || 0;
        const includePaths = document.getElementById('include-paths')?.value?.trim() || '';
        const excludePaths = document.getElementById('exclude-paths')?.value?.trim() || '';
        
        const enhancedOptions = {
            ...options,
            arrayMatching,
            normalizeStrings,
            ignoreTimestamps,
            ignoreKeyOrder,
            numericTolerance,
            includePaths: includePaths ? includePaths.split('\n').filter(p => p.trim()) : [],
            excludePaths: excludePaths ? excludePaths.split('\n').filter(p => p.trim()) : []
        };
        
        // Update instance options
        this.options = { ...this.options, ...enhancedOptions };
        
        const extractor = new JSONPathExtractor();
        const differ = new JSONDiffer(enhancedOptions);
        
        let objects1, objects2;
        
        try {
            if (enhancedOptions.idKey && enhancedOptions.idKey.trim()) {
                objects1 = extractor.extractByPath(json1, enhancedOptions.idKey);
                objects2 = extractor.extractByPath(json2, enhancedOptions.idKey);
            } else {
                // Direct comparison without ID matching
                objects1 = [{ id: 'root', data: json1 }];
                objects2 = [{ id: 'root', data: json2 }];
            }
        } catch (error) {
            console.warn('Path extraction failed, using direct comparison:', error.message);
            // If path extraction fails, compare the entire objects
            objects1 = [{ id: 'root', data: json1 }];
            objects2 = [{ id: 'root', data: json2 }];
        }
        
        const comparison = differ.compare(objects1, objects2);
        const endTime = performance.now();
        
        return {
            ...comparison,
            options: enhancedOptions,
            originalData: { json1, json2 },
            timing: {
                duration: Math.round(endTime - startTime),
                objectsCompared: objects1.length + objects2.length
            }
        };
    }

    displayResults(comparison) {
        const resultsPanel = document.getElementById('results-panel');
        if (resultsPanel) {
            resultsPanel.style.display = 'block';
            resultsPanel.scrollIntoView({ behavior: 'smooth' });
        }
        
        // Enable report generation
        const reportBtn = document.getElementById('generate-report-btn');
        const reportMainBtn = document.getElementById('generate-report-main');
        if (reportBtn) reportBtn.disabled = false;
        if (reportMainBtn) reportMainBtn.disabled = false;
        
        // Update statistics panel
        this.updateStatisticsPanel(comparison.summary, comparison.timing);
        
        // Always display differences first
        this.displayDifferences(comparison.differences);
        this.displaySummary(comparison.summary);
        this.displaySideBySide(comparison.matched || [], comparison.onlyInFirst || [], comparison.onlyInSecond || []);
        this.displayDetailedStats(comparison);
        
        // Display based on current view mode
        switch(this.viewMode) {
            case 'line':
                this.displayLineByLine(comparison);
                break;
            case 'split':
            case 'unified':
                this.displaySplitView(comparison);
                break;
            default: // tree
                this.displayTreeView(comparison);
        }
        
        // Initialize diff navigation
        this.filteredDiffs = comparison.differences || [];
        this.currentDiffIndex = 0;
        this.updateDiffNavigation();
    }
    updateStatisticsPanel(summary, timing) {
        const statsPanel = document.getElementById('stats-panel');
        if (statsPanel) {
            statsPanel.style.display = 'block';
            
            const totalDiffsEl = document.getElementById('total-diffs');
            const statAddedEl = document.getElementById('stat-added');
            const statDeletedEl = document.getElementById('stat-deleted');
            const statModifiedEl = document.getElementById('stat-modified');
            const matchPercentageEl = document.getElementById('match-percentage');
            const matchProgressEl = document.getElementById('match-progress');
            
            if (totalDiffsEl) totalDiffsEl.textContent = summary.totalDifferences;
            if (statAddedEl) statAddedEl.textContent = summary.added;
            if (statDeletedEl) statDeletedEl.textContent = summary.deleted;
            if (statModifiedEl) statModifiedEl.textContent = summary.modified;
            
            const totalItems = summary.added + summary.deleted + summary.modified + summary.equal;
            const matchPercentage = totalItems > 0 ? Math.round((summary.equal / totalItems) * 100) : 0;
            
            if (matchPercentageEl) matchPercentageEl.textContent = matchPercentage;
            if (matchProgressEl) matchProgressEl.style.width = matchPercentage + '%';
        }
    }
    displayTreeView(comparison) {
        // Default tree view display (existing functionality)
        // This maintains the current tree-like display
    }
    displayLineByLine(comparison) {
        this.generateLineByLineData(comparison);
        this.renderLineByLine();
        
        // Switch to line-by-line tab
        this.switchResultsTab('line-by-line');
    }
    displaySplitView(comparison) {
        // Split view implementation (similar to side-by-side but enhanced)
        this.displaySideBySide(comparison.matched, comparison.onlyInFirst, comparison.onlyInSecond);
        this.switchResultsTab('side-by-side');
    }

    displayDifferences(differences) {
        const container = document.getElementById('differences-list');
        container.innerHTML = '';
        
        if (differences.length === 0) {
            container.innerHTML = '<p>No differences found!</p>';
            return;
        }
        
        differences.forEach(diff => {
            const item = document.createElement('div');
            item.className = `diff-item diff-item--${diff.type}`;
            
            const path = document.createElement('div');
            path.className = 'diff-path';
            path.textContent = diff.path;
            
            const value = document.createElement('div');
            value.className = 'diff-value';
            
            switch (diff.type) {
                case 'added':
                    value.innerHTML = `<span class="diff-new">+ ${this.formatValue(diff.value)}</span>`;
                    break;
                case 'deleted':
                    value.innerHTML = `<span class="diff-old">- ${this.formatValue(diff.value)}</span>`;
                    break;
                case 'modified':
                    value.innerHTML = `<span class="diff-old">- ${this.formatValue(diff.oldValue)}</span><br><span class="diff-new">+ ${this.formatValue(diff.newValue)}</span>`;
                    break;
                case 'equal':
                    value.innerHTML = `<span>${this.formatValue(diff.value)}</span>`;
                    break;
            }
            
            item.appendChild(path);
            item.appendChild(value);
            container.appendChild(item);
        });
    }

    displaySummary(summary) {
        const container = document.getElementById('summary-stats');
        if (!container) return;
        
        const stats = [
            { label: 'Total Differences', value: summary.totalDifferences || 0, color: 'var(--color-info)' },
            { label: 'Added', value: summary.added || 0, color: 'var(--diff-added)' },
            { label: 'Deleted', value: summary.deleted || 0, color: 'var(--diff-deleted)' },
            { label: 'Modified', value: summary.modified || 0, color: 'var(--diff-modified)' },
            { label: 'Equal', value: summary.equal || 0, color: 'var(--diff-equal)' }
        ];
        
        container.innerHTML = stats.map(stat => `
            <div class="stat-item">
                <div class="stat-number" style="color: ${stat.color}">${stat.value}</div>
                <div class="stat-label">${stat.label}</div>
            </div>
        `).join('');
    }

    displaySideBySide(matched, onlyInFirst, onlyInSecond) {
        const container = document.getElementById('side-by-side-view');
        if (!container) return;
        
        container.innerHTML = `
            <div class="side-by-side">
                <div class="side-panel">
                    <div class="side-title">JSON 1</div>
                    <div class="side-content" id="side-content-1"></div>
                </div>
                <div class="side-panel">
                    <div class="side-title">JSON 2</div>
                    <div class="side-content" id="side-content-2"></div>
                </div>
            </div>
        `;
        
        // Get content containers (already created above)
        const content1 = document.getElementById('side-content-1');
        const content2 = document.getElementById('side-content-2');
        if (!content1 || !content2) return;
        
        // Clear existing content
        content1.innerHTML = '';
        content2.innerHTML = '';
    }
    
    // Diff Navigation and Filtering
    navigateDiff(direction) {
        if (this.filteredDiffs.length === 0) return;
        
        this.currentDiffIndex += direction;
        if (this.currentDiffIndex < 0) this.currentDiffIndex = this.filteredDiffs.length - 1;
        if (this.currentDiffIndex >= this.filteredDiffs.length) this.currentDiffIndex = 0;
        
        this.highlightDiff(this.currentDiffIndex);
        this.updateDiffNavigation();
    }
    
    filterDiffs(filter) {
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        // Filter differences
        if (filter === 'all') {
            this.filteredDiffs = this.lastComparison.differences;
        } else {
            this.filteredDiffs = this.lastComparison.differences.filter(diff => diff.type === filter);
        }
        
        this.currentDiffIndex = 0;
        this.updateDiffNavigation();
        this.refreshDiffDisplay();
    }
    
    searchDiffs(query) {
        if (!query.trim()) {
            this.filteredDiffs = this.lastComparison.differences;
        } else {
            const lowercaseQuery = query.toLowerCase();
            this.filteredDiffs = this.lastComparison.differences.filter(diff => {
                const path = (diff.path || '').toLowerCase();
                const value = JSON.stringify(diff.value || diff.newValue || diff.oldValue || '').toLowerCase();
                return path.includes(lowercaseQuery) || value.includes(lowercaseQuery);
            });
        }
        
        this.currentDiffIndex = 0;
        this.updateDiffNavigation();
        this.refreshDiffDisplay();
    }
    
    updateDiffNavigation() {
        const total = this.filteredDiffs.length;
        const current = total > 0 ? this.currentDiffIndex + 1 : 0;
        
        document.getElementById('diff-counter').textContent = `${current} of ${total}`;
        document.getElementById('prev-diff').disabled = total === 0;
        document.getElementById('next-diff').disabled = total === 0;
    }
    
    highlightDiff(index) {
        // Remove existing highlights
        document.querySelectorAll('.diff-item.highlighted').forEach(item => {
            item.classList.remove('highlighted');
        });
        
        // Highlight current diff
        const diffItems = document.querySelectorAll('.diff-item');
        if (diffItems[index]) {
            diffItems[index].classList.add('highlighted');
            diffItems[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    refreshDiffDisplay() {
        if (!this.lastComparison) return;
        
        const container = document.getElementById('differences-list');
        container.innerHTML = '';
        
        if (this.filteredDiffs.length === 0) {
            container.innerHTML = '<p>No differences found matching current filter.</p>';
            return;
        }
        
        this.filteredDiffs.forEach((diff, index) => {
            const item = this.createDiffElement(diff, index);
            container.appendChild(item);
        });
    }
    
    createDiffElement(diff, index) {
        const item = document.createElement('div');
        item.className = `diff-item diff-item--${diff.type}`;
        item.addEventListener('click', () => this.selectDiff(index));
        
        const path = document.createElement('div');
        path.className = 'diff-path';
        path.textContent = diff.path;
        
        const value = document.createElement('div');
        value.className = 'diff-value';
        
        switch (diff.type) {
            case 'added':
                value.innerHTML = `<span class="diff-new">+ ${this.formatValue(diff.value)}</span>`;
                break;
            case 'deleted':
                value.innerHTML = `<span class="diff-old">- ${this.formatValue(diff.value)}</span>`;
                break;
            case 'modified':
                value.innerHTML = `<span class="diff-old">- ${this.formatValue(diff.oldValue)}</span><br><span class="diff-new">+ ${this.formatValue(diff.newValue)}</span>`;
                break;
            case 'equal':
                value.innerHTML = `<span>${this.formatValue(diff.value)}</span>`;
                break;
        }
        
        item.appendChild(path);
        item.appendChild(value);
        return item;
    }
    
    selectDiff(index) {
        this.currentDiffIndex = index;
        this.highlightDiff(index);
        this.updateDiffNavigation();
    }
    
    displayDetailedStats(comparison) {
        const container = document.getElementById('detailed-stats');
        const timing = comparison.timing || {};
        
        const stats = [
            { label: 'Comparison Duration', value: `${timing.duration || 0}ms` },
            { label: 'Objects Compared', value: timing.objectsCompared || 0 },
            { label: 'Match Percentage', value: this.calculateMatchPercentage(comparison.summary) + '%' },
            { label: 'Accuracy Score', value: this.calculateAccuracyScore(comparison.summary) },
            { label: 'Data Integrity', value: this.calculateDataIntegrity(comparison.summary) },
            { label: 'Change Density', value: this.calculateChangeDensity(comparison.summary) }
        ];
        
        container.innerHTML = stats.map(stat => `
            <div class="detailed-stat-card">
                <h5>${stat.label}</h5>
                <div class="number">${stat.value}</div>
            </div>
        `).join('');
    }
    
    calculateMatchPercentage(summary) {
        const total = summary.added + summary.deleted + summary.modified + summary.equal;
        return total > 0 ? Math.round((summary.equal / total) * 100) : 0;
    }
    
    calculateAccuracyScore(summary) {
        const total = summary.totalDifferences + summary.equal;
        if (total === 0) return 'N/A';
        const score = ((summary.equal + (summary.modified * 0.5)) / total) * 100;
        return Math.round(score) + '%';
    }
    
    calculateDataIntegrity(summary) {
        const criticalChanges = summary.deleted + (summary.modified * 0.7);
        if (criticalChanges === 0) return 'Perfect';
        if (criticalChanges < 5) return 'High';
        if (criticalChanges < 20) return 'Medium';
        return 'Low';
    }
    
    calculateChangeDensity(summary) {
        const totalChanges = summary.added + summary.deleted + summary.modified;
        const totalItems = totalChanges + summary.equal;
        if (totalItems === 0) return 'N/A';
        const density = (totalChanges / totalItems) * 100;
        return Math.round(density) + '%';
    }
    
    // Path Examples Helper
    showPathExamples() {
        const examples = [
            '$.users[*].id',
            '$.data.items[*].userId', 
            '$.products[?(@.category == "electronics")].id',
            '$..id',
            '$.settings.security.*',
            '$.api.responses[*].timestamp'
        ];
        
        alert('Common JSONPath Examples:\n\n' + examples.join('\n'));
    }
        
        // Display matched pairs
        if (matched) {
            matched.forEach(pair => {
                const json1Formatted = JSON.stringify(pair.json1, null, 2);
                const json2Formatted = JSON.stringify(pair.json2, null, 2);
                
                content1.innerHTML += `<div class="match-pair">ID: ${pair.id}<pre>${json1Formatted}</pre></div>`;
                content2.innerHTML += `<div class="match-pair">ID: ${pair.id}<pre>${json2Formatted}</pre></div>`;
            });
        }
        
        // Display items only in first JSON
        if (onlyInFirst) {
            onlyInFirst.forEach(item => {
                const formatted = JSON.stringify(item.data, null, 2);
                content1.innerHTML += `<div class="unique-item" style="background: var(--diff-deleted-bg); border-left: 4px solid var(--diff-deleted); padding: 8px;">Only in JSON 1<br>ID: ${item.id}<pre>${formatted}</pre></div>`;
                content2.innerHTML += `<div class="unique-item" style="color: #999; padding: 8px;">---</div>`;
            });
        }
        
        // Display items only in second JSON
        if (onlyInSecond) {
            onlyInSecond.forEach(item => {
                const formatted = JSON.stringify(item.data, null, 2);
                content1.innerHTML += `<div class="unique-item" style="color: #999; padding: 8px;">---</div>`;
                content2.innerHTML += `<div class="unique-item" style="background: var(--diff-added-bg); border-left: 4px solid var(--diff-added); padding: 8px;">Only in JSON 2<br>ID: ${item.id}<pre>${formatted}</pre></div>`;
            });
        }
    }

    formatValue(value) {
        if (typeof value === 'string') {
            return `"${value}"`;
        } else if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return String(value);
    }

    switchResultsTab(tabName) {
        document.querySelectorAll('.results-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Handle view-specific logic
        if (tabName === 'line-by-line' && this.lineByLineData) {
            this.renderLineByLine();
        }
    }
    generateLineByLineData(comparison) {
        const json1Lines = JSON.stringify(comparison.originalData.json1, null, 2).split('\n');
        const json2Lines = JSON.stringify(comparison.originalData.json2, null, 2).split('\n');
        
        // Create unified diff-like structure
        this.lineByLineData = {
            lines1: json1Lines,
            lines2: json2Lines,
            diffs: this.createLineDiffs(json1Lines, json2Lines, comparison.differences)
        };
    }
    
    createLineDiffs(lines1, lines2, differences) {
        // Simple line-by-line diff algorithm
        const maxLines = Math.max(lines1.length, lines2.length);
        const lineDiffs = [];
        
        for (let i = 0; i < maxLines; i++) {
            const line1 = lines1[i] || '';
            const line2 = lines2[i] || '';
            
            let type = 'equal';
            if (i >= lines1.length) {
                type = 'added';
            } else if (i >= lines2.length) {
                type = 'deleted';
            } else if (line1 !== line2) {
                type = 'modified';
            }
            
            lineDiffs.push({
                line1: line1,
                line2: line2,
                type: type,
                lineNumber: i + 1
            });
        }
        
        return lineDiffs;
    }
    
    renderLineByLine() {
        if (!this.lineByLineData) return;
        
        const panel1 = document.getElementById('line-panel-1');
        const panel2 = document.getElementById('line-panel-2');
        
        panel1.innerHTML = '';
        panel2.innerHTML = '';
        
        this.lineByLineData.diffs.forEach((diff, index) => {
            const item1 = document.createElement('div');
            const item2 = document.createElement('div');
            
            item1.className = `line-item ${diff.type}`;
            item2.className = `line-item ${diff.type}`;
            
            item1.innerHTML = `
                <div class="line-number">${diff.line1 ? diff.lineNumber : ''}</div>
                <div class="line-code">${this.escapeHtml(diff.line1)}</div>
            `;
            
            item2.innerHTML = `
                <div class="line-number">${diff.line2 ? diff.lineNumber : ''}</div>
                <div class="line-code">${this.escapeHtml(diff.line2)}</div>
            `;
            
            panel1.appendChild(item1);
            panel2.appendChild(item2);
        });
        
        // Setup synchronized scrolling
        this.setupSyncScroll(panel1, panel2);
    }
    
    setupSyncScroll(panel1, panel2) {
        let syncing = false;
        
        const syncScroll = (source, target) => {
            if (syncing) return;
            syncing = true;
            target.scrollTop = source.scrollTop;
            target.scrollLeft = source.scrollLeft;
            setTimeout(() => syncing = false, 10);
        };
        
        panel1.addEventListener('scroll', () => syncScroll(panel1, panel2));
        panel2.addEventListener('scroll', () => syncScroll(panel2, panel1));
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    exportResults(format) {
        if (!this.lastComparison) {
            alert('No comparison results to export');
            return;
        }
        
        let content, filename, mimeType;
        
        if (format === 'json') {
            content = JSON.stringify(this.lastComparison, null, 2);
            filename = 'json-comparison-results.json';
            mimeType = 'application/json';
        } else if (format === 'html') {
            content = this.generateHTMLReport(this.lastComparison);
            filename = 'json-comparison-report.html';
            mimeType = 'text/html';
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Advanced Report Generation
    showReportModal() {
        if (!this.lastComparison) {
            alert('No comparison results to generate report from');
            return;
        }
        
        document.getElementById('report-modal').classList.add('show');
        this.updateReportPreview();
    }
    
    hideReportModal() {
        document.getElementById('report-modal').classList.remove('show');
    }
    
    updateReportPreview() {
        const format = document.querySelector('input[name="report-format"]:checked').value;
        const includeSummary = document.getElementById('include-summary').checked;
        const includeDetailed = document.getElementById('include-detailed-diffs').checked;
        const includeSideBySide = document.getElementById('include-side-by-side').checked;
        const includeMatched = document.getElementById('include-matched-items').checked;
        
        let sections = 1; // Title page
        if (includeSummary) sections++;
        if (includeDetailed) sections++;
        if (includeSideBySide) sections++;
        if (includeMatched) sections++;
        
        document.getElementById('preview-sections').textContent = sections;
        document.getElementById('preview-format').textContent = format.toUpperCase();
        
        // Estimate size based on format and content
        const baseSize = this.lastComparison.differences.length * 0.1;
        const multiplier = {
            'excel': 3.0,
            'pdf': 2.5,
            'html': 2.0,
            'csv': 0.5,
            'json': 1.0,
            'markdown': 1.2
        };
        
        const estimatedSize = (baseSize * multiplier[format] * sections).toFixed(1);
        document.getElementById('preview-size').textContent = `~${estimatedSize}MB`;
    }
    
    
    async generateReport() {
        if (!this.lastComparison) return;
        
        const format = document.querySelector('input[name="report-format"]:checked').value;
        const config = {
            title: document.getElementById('report-title').value,
            groupBy: document.getElementById('group-by').value,
            colorScheme: document.getElementById('color-scheme').value,
            includeSummary: document.getElementById('include-summary').checked,
            includeDetailed: document.getElementById('include-detailed-diffs').checked,
            includeSideBySide: document.getElementById('include-side-by-side').checked,
            includeMatched: document.getElementById('include-matched-items').checked
        };
        
        this.showReportProgress(0);
        
        try {
            let content, filename, mimeType;
            
            switch(format) {
                case 'excel':
                    content = await this.generateExcelReport(config);
                    filename = `${config.title.replace(/[^a-z0-9]/gi, '-')}-${this.getTimestamp()}.xlsx`;
                    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    break;
                case 'pdf':
                    content = await this.generatePDFReport(config);
                    filename = `${config.title.replace(/[^a-z0-9]/gi, '-')}-${this.getTimestamp()}.pdf`;
                    mimeType = 'application/pdf';
                    break;
                case 'html':
                    content = this.generateHTMLReport(config);
                    filename = `${config.title.replace(/[^a-z0-9]/gi, '-')}-${this.getTimestamp()}.html`;
                    mimeType = 'text/html';
                    break;
                case 'csv':
                    content = this.generateCSVReport(config);
                    filename = `${config.title.replace(/[^a-z0-9]/gi, '-')}-${this.getTimestamp()}.csv`;
                    mimeType = 'text/csv';
                    break;
                case 'json':
                    content = this.generateJSONReport(config);
                    filename = `${config.title.replace(/[^a-z0-9]/gi, '-')}-${this.getTimestamp()}.json`;
                    mimeType = 'application/json';
                    break;
                case 'markdown':
                    content = this.generateMarkdownReport(config);
                    filename = `${config.title.replace(/[^a-z0-9]/gi, '-')}-${this.getTimestamp()}.md`;
                    mimeType = 'text/markdown';
                    break;
            }
            
            this.showReportProgress(100);
            this.downloadFile(content, filename, mimeType);
            
            setTimeout(() => {
                this.hideReportProgress();
                alert(`Report "${filename}" generated successfully!`);
            }, 500);
            
        } catch (error) {
            this.hideReportProgress();
            alert('Error generating report: ' + error.message);
        }
    }
    
    showReportProgress(percentage) {
        const container = document.getElementById('report-progress');
        const bar = document.getElementById('report-progress-bar');
        const text = document.getElementById('report-progress-text');
        
        container.style.display = 'block';
        bar.style.width = percentage + '%';
        text.textContent = percentage === 100 ? 'Report generated!' : `Generating report... ${percentage}%`;
    }
    
    hideReportProgress() {
        document.getElementById('report-progress').style.display = 'none';
    }
    
    getTimestamp() {
        const now = new Date();
        return now.toISOString().slice(0, 19).replace(/[^0-9]/g, '');
    }
    
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Report generators
    
    async generateExcelReport(config) {
        // Simplified Excel generation (in real implementation, would use SheetJS)
        const data = this.prepareReportData(config);
        return JSON.stringify(data, null, 2); // Placeholder
    }
    
    async generatePDFReport(config) {
        // Simplified PDF generation (in real implementation, would use jsPDF)
        const html = this.generateHTMLReport(config);
        return html; // Placeholder
    }
    
    generateCSVReport(config) {
        const comparison = this.lastComparison;
        const rows = [['Path', 'Change Type', 'Old Value', 'New Value', 'Data Type', 'Timestamp']];
        
        comparison.differences.forEach(diff => {
            rows.push([
                diff.path || '',
                diff.type || '',
                this.formatValueForCSV(diff.oldValue || diff.value),
                this.formatValueForCSV(diff.newValue || diff.value),
                typeof (diff.newValue || diff.oldValue || diff.value),
                new Date().toISOString()
            ]);
        });
        
        return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }
    
    generateJSONReport(config) {
        const reportData = {
            metadata: {
                title: config.title,
                generatedAt: new Date().toISOString(),
                configuration: config
            },
            summary: this.lastComparison.summary,
            timing: this.lastComparison.timing,
            differences: this.lastComparison.differences,
            matched: config.includeMatched ? this.lastComparison.matched : undefined,
            onlyInFirst: this.lastComparison.onlyInFirst,
            onlyInSecond: this.lastComparison.onlyInSecond
        };
        
        return JSON.stringify(reportData, null, 2);
    }
    
    generateMarkdownReport(config) {
        const comparison = this.lastComparison;
        let markdown = `# ${config.title}\n\n`;
        markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
        
        if (config.includeSummary) {
            markdown += `## Summary Statistics\n\n`;
            markdown += `| Metric | Count |\n`;
            markdown += `|--------|-------|\n`;
            markdown += `| Total Differences | ${comparison.summary.totalDifferences} |\n`;
            markdown += `| Added | ${comparison.summary.added} |\n`;
            markdown += `| Deleted | ${comparison.summary.deleted} |\n`;
            markdown += `| Modified | ${comparison.summary.modified} |\n`;
            markdown += `| Equal | ${comparison.summary.equal} |\n\n`;
        }
        
        if (config.includeDetailed) {
            markdown += `## Detailed Differences\n\n`;
            comparison.differences.forEach(diff => {
                markdown += `### ${diff.path}\n\n`;
                markdown += `**Type:** ${diff.type}\n\n`;
                
                if (diff.type === 'modified') {
                    markdown += `**Old Value:**\n\`\`\`json\n${JSON.stringify(diff.oldValue, null, 2)}\n\`\`\`\n\n`;
                    markdown += `**New Value:**\n\`\`\`json\n${JSON.stringify(diff.newValue, null, 2)}\n\`\`\`\n\n`;
                } else {
                    markdown += `**Value:**\n\`\`\`json\n${JSON.stringify(diff.value, null, 2)}\n\`\`\`\n\n`;
                }
            });
        }
        
        return markdown;
    }
    
    formatValueForCSV(value) {
        if (typeof value === 'object') {
            return JSON.stringify(value).replace(/"/g, '""');
        }
        return String(value).replace(/"/g, '""');
    }
    
    prepareReportData(config) {
        return {
            summary: this.lastComparison.summary,
            differences: this.lastComparison.differences,
            config: config
        };
    }
    
    generateHTMLReport(config) {
        const comparison = this.lastComparison;
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JSON Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1, h2 { color: #333; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .stat { text-align: center; padding: 15px; border-radius: 6px; min-width: 100px; }
        .diff-item { margin: 10px 0; padding: 10px; border-left: 4px solid; border-radius: 4px; }
        .added { background: #f0fdf4; border-color: #22c55e; }
        .deleted { background: #fef2f2; border-color: #ef4444; }
        .modified { background: #fffbeb; border-color: #f59e0b; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
        .diff-old { color: #dc2626; text-decoration: line-through; }
        .diff-new { color: #16a34a; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${config.title || 'JSON Comparison Report'}</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        
        <h2>Summary</h2>
        <div class="summary">
            <div class="stat added">Added: ${comparison.summary.added}</div>
            <div class="stat deleted">Deleted: ${comparison.summary.deleted}</div>
            <div class="stat modified">Modified: ${comparison.summary.modified}</div>
            <div class="stat">Equal: ${comparison.summary.equal}</div>
        </div>
        
        <h2>Differences</h2>
        ${comparison.differences.map(diff => `
            <div class="diff-item ${diff.type}">
                <strong>${diff.path}</strong><br>
                ${diff.type === 'modified' ? 
                    `<span class="diff-old">- ${this.formatValue(diff.oldValue)}</span><br><span class="diff-new">+ ${this.formatValue(diff.newValue)}</span>` :
                    `${diff.type === 'added' ? '+' : diff.type === 'deleted' ? '-' : ''} ${this.formatValue(diff.value || diff.newValue || diff.oldValue)}`
                }
            </div>
        `).join('')}
    </div>
</body>
</html>
        `;
    }

    collapseResults() {
        document.getElementById('results-panel').style.display = 'none';
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }

    // API Methods
    
    async fetchAPI(apiNumber) {
        const url = document.getElementById(`api-${apiNumber}-url`).value;
        const method = document.getElementById(`api-${apiNumber}-method`).value;
        const body = document.getElementById(`api-${apiNumber}-body`).value;
        
        if (!url) {
            alert('Please enter a URL');
            return;
        }
        
        const headers = this.getHeaders(apiNumber);
        
        try {
            this.showLoading(true);
            const startTime = Date.now();
            
            const options = {
                method,
                headers
            };
            
            if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                options.body = body;
            }
            
            const response = await fetch(url, options);
            const endTime = Date.now();
            
            const responseText = await response.text();
            let responseData;
            
            try {
                responseData = JSON.parse(responseText);
            } catch {
                responseData = responseText;
            }
            
            this.apiResponses[`api${apiNumber}`] = responseData;
            
            this.displayAPIResponse(apiNumber, {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                data: responseData,
                timing: endTime - startTime
            });
            
            this.updateCompareResponsesButton();
            
        } catch (error) {
            alert(`API request failed: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    getHeaders(apiNumber) {
        const headers = {};
        const headerRows = document.querySelectorAll(`#api-${apiNumber}-headers .header-row`);
        
        headerRows.forEach(row => {
            const key = row.querySelector('.header-key').value.trim();
            const value = row.querySelector('.header-value').value.trim();
            if (key && value) {
                headers[key] = value;
            }
        });
        
        return headers;
    }

    displayAPIResponse(apiNumber, response) {
        const container = document.getElementById(`api-${apiNumber}-response`);
        const meta = document.getElementById(`api-${apiNumber}-meta`);
        const body = document.getElementById(`api-${apiNumber}-response-body`);
        
        meta.innerHTML = `
            <div>Status: ${response.status} ${response.statusText}</div>
            <div>Time: ${response.timing}ms</div>
        `;
        
        body.textContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
        container.style.display = 'block';
    }

    updateCompareResponsesButton() {
        const button = document.getElementById('compare-responses');
        const hasResponses = this.apiResponses.api1 && this.apiResponses.api2;
        button.style.display = hasResponses ? 'block' : 'none';
    }

    useAPIResponse(apiNumber) {
        const responseData = this.apiResponses[`api${apiNumber}`];
        if (!responseData) {
            alert('No API response to use');
            return;
        }
        
        this.switchView('compare');
        
        const input = document.getElementById(`json-input-${apiNumber}`);
        input.value = typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2);
        this.handleJSONInput(apiNumber);
    }

    compareAPIResponses() {
        if (!this.apiResponses.api1 || !this.apiResponses.api2) {
            alert('Both API responses are required');
            return;
        }
        
        this.switchView('compare');
        
        document.getElementById('json-input-1').value = JSON.stringify(this.apiResponses.api1, null, 2);
        document.getElementById('json-input-2').value = JSON.stringify(this.apiResponses.api2, null, 2);
        
        this.handleJSONInput(1);
        this.handleJSONInput(2);
        
        setTimeout(() => this.compareJSONs(), 100);
    }

    addHeader(apiNumber) {
        const container = document.getElementById(`api-${apiNumber}-headers`);
        const newRow = document.createElement('div');
        newRow.className = 'header-row';
        newRow.innerHTML = `
            <input type="text" placeholder="Key" class="form-control header-key">
            <input type="text" placeholder="Value" class="form-control header-value">
            <button class="btn btn--outline btn--sm remove-header">×</button>
        `;
        container.appendChild(newRow);
    }

    // Settings Methods
    loadSettings() {
        // Use default values since localStorage is not available in sandboxed environment
        const theme = 'auto';
        const fontSize = '14px';
        
        document.getElementById('theme-selector').value = theme;
        document.getElementById('font-size').value = fontSize;
        
        this.setTheme(theme);
        this.setFontSize(fontSize);
    }

    setTheme(theme) {
        if (theme === 'auto') {
            document.documentElement.removeAttribute('data-color-scheme');
        } else {
            document.documentElement.setAttribute('data-color-scheme', theme);
        }
        // Note: Settings are not persisted due to sandboxed environment
    }

    setFontSize(size) {
        document.documentElement.style.setProperty('--json-font-size', size);
        document.querySelectorAll('.json-input, .response-body').forEach(el => {
            el.style.fontSize = size;
        });
        // Note: Settings are not persisted due to sandboxed environment
    }
}

// JSON Path Extractor - Handles extracting objects by ID path

class JSONPathExtractor {
    extractByPath(data, path) {
        if (!path || path === 'id') {
            // Simple case: look for id at root level
            if (Array.isArray(data)) {
                return data.filter(item => item && typeof item === 'object' && item.id !== undefined)
                          .map(item => ({ id: item.id, data: item }));
            } else if (data && typeof data === 'object' && data.id !== undefined) {
                return [{ id: data.id, data }];
            }
            throw new Error('No objects with id field found');
        }
        
        // Handle array notation like "users[].id"
        if (path.includes('[]')) {
            return this.extractFromArrayPath(data, path);
        }
        
        // Handle nested paths like "user.profile.id"
        return this.extractFromNestedPath(data, path);
    }
    
    extractFromArrayPath(data, path) {
        const [arrayPath, idField] = path.split('[].');
        const arrayData = this.getNestedValue(data, arrayPath);
        
        if (!Array.isArray(arrayData)) {
            throw new Error(`Path ${arrayPath} does not point to an array`);
        }
        
        return arrayData.filter(item => item && typeof item === 'object')
                       .map(item => {
                           const id = idField ? this.getNestedValue(item, idField) : item.id;
                           return { id, data: item };
                       })
                       .filter(item => item.id !== undefined);
    }
    
    extractFromNestedPath(data, path) {
        const pathParts = path.split('.');
        const idField = pathParts.pop();
        const objectPath = pathParts.join('.');
        
        const targetData = objectPath ? this.getNestedValue(data, objectPath) : data;
        
        if (Array.isArray(targetData)) {
            return targetData.filter(item => item && typeof item === 'object')
                           .map(item => {
                               const id = this.getNestedValue(item, idField);
                               return { id, data: item };
                           })
                           .filter(item => item.id !== undefined);
        } else if (targetData && typeof targetData === 'object') {
            const id = this.getNestedValue(targetData, idField);
            if (id !== undefined) {
                return [{ id, data: targetData }];
            }
        }
        
        throw new Error(`No objects found with id field at path ${path}`);
    }
    
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

// JSON Differ - Performs deep comparison between JSON objects
class JSONDiffer {
    constructor(options = {}) {
        this.options = {
            mode: 'exact',
            ignoreExtraKeys: false,
            caseSensitive: true,
            ...options
        };
    }
    
    compare(objects1, objects2) {
        const matched = [];
        const onlyInFirst = [];
        const onlyInSecond = [];
        const differences = [];
        
        // Create maps for faster lookup
        const map1 = new Map(objects1.map(obj => [String(obj.id), obj]));
        const map2 = new Map(objects2.map(obj => [String(obj.id), obj]));
        
        // Find matched pairs and objects only in first
        for (const [id, obj1] of map1) {
            const obj2 = map2.get(id);
            if (obj2) {
                matched.push({ id, json1: obj1.data, json2: obj2.data });
                const objDiffs = this.compareObjects(obj1.data, obj2.data, id);
                if (Array.isArray(objDiffs)) {
                    differences.push(...objDiffs);
                } else if (objDiffs) {
                    differences.push(objDiffs);
                }
                map2.delete(id); // Remove from second map
            } else {
                onlyInFirst.push(obj1);
                differences.push({
                    type: 'deleted',
                    path: `ID: ${id}`,
                    value: obj1.data
                });
            }
        }
        
        // Objects only in second
        for (const [id, obj2] of map2) {
            onlyInSecond.push(obj2);
            differences.push({
                type: 'added',
                path: `ID: ${id}`,
                value: obj2.data
            });
        }
        
        const summary = this.calculateSummary(differences);
        
        return {
            matched,
            onlyInFirst,
            onlyInSecond,
            differences,
            summary
        };
    }
    
    compareObjects(obj1, obj2, basePath = '') {
        const differences = [];
        const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
        
        for (const key of allKeys) {
            const path = basePath ? `${basePath}.${key}` : key;
            const value1 = obj1[key];
            const value2 = obj2[key];
            
            if (!(key in obj1)) {
                differences.push({
                    type: 'added',
                    path,
                    value: value2
                });
            } else if (!(key in obj2)) {
                if (!this.options.ignoreExtraKeys) {
                    differences.push({
                        type: 'deleted',
                        path,
                        value: value1
                    });
                }
            } else {
                const comparison = this.compareValues(value1, value2, path);
                if (comparison) {
                    if (Array.isArray(comparison)) {
                        differences.push(...comparison);
                    } else {
                        differences.push(comparison);
                    }
                }
            }
        }
        
        return differences;
    }
    
    compareValues(value1, value2, path) {
        // Handle null and undefined
        if (value1 === null && value2 === null) return null;
        if (value1 === undefined && value2 === undefined) return null;
        
        if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) {
            return {
                type: 'modified',
                path,
                oldValue: value1,
                newValue: value2
            };
        }
        
        // Type comparison mode
        if (this.options.mode === 'type') {
            if (typeof value1 !== typeof value2) {
                return {
                    type: 'modified',
                    path,
                    oldValue: `${typeof value1}: ${value1}`,
                    newValue: `${typeof value2}: ${value2}`
                };
            }
            return null; // Types match, consider equal in type-only mode
        }
        
        // Handle arrays
        if (Array.isArray(value1) && Array.isArray(value2)) {
            return this.compareArrays(value1, value2, path);
        }
        
        // Handle objects
        if (typeof value1 === 'object' && typeof value2 === 'object') {
            const nestedDiffs = this.compareObjects(value1, value2, path);
            return nestedDiffs.length > 0 ? nestedDiffs : null;
        }
        
        // Handle primitives
        const equal = this.options.caseSensitive ? 
            value1 === value2 : 
            String(value1).toLowerCase() === String(value2).toLowerCase();
            
        if (equal) {
            return null;
        }
        
        return {
            type: 'modified',
            path,
            oldValue: value1,
            newValue: value2
        };
    }
    
    compareArrays(arr1, arr2, path) {
        if (this.options.mode === 'ignore-order') {
            // Compare as sets
            const set1 = new Set(arr1.map(item => JSON.stringify(item)));
            const set2 = new Set(arr2.map(item => JSON.stringify(item)));
            
            if (set1.size === set2.size && [...set1].every(item => set2.has(item))) {
                return null; // Arrays are equal when order is ignored
            }
        }
        
        if (JSON.stringify(arr1) === JSON.stringify(arr2)) {
            return null;
        }
        
        return {
            type: 'modified',
            path,
            oldValue: arr1,
            newValue: arr2
        };
    }
    
    calculateSummary(differences) {
        const summary = {
            totalDifferences: differences.length,
            added: 0,
            deleted: 0,
            modified: 0,
            equal: 0
        };
        
        differences.forEach(diff => {
            if (Array.isArray(diff)) {
                // Handle nested differences
                diff.forEach(nestedDiff => {
                    if (nestedDiff.type && summary[nestedDiff.type] !== undefined) {
                        summary[nestedDiff.type]++;
                    }
                });
            } else if (diff.type && summary[diff.type] !== undefined) {
                summary[diff.type]++;
            }
        });
        
        return summary;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing JSON Comparator...');
    try {
        window.jsonComparator = new JSONComparator();
        console.log('JSON Comparator initialized successfully');
    } catch (error) {
        console.error('Failed to initialize JSON Comparator:', error);
    }
    
    // Setup modal close handlers
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
        }
        if (e.target.classList.contains('modal-close')) {
            e.target.closest('.modal').classList.remove('show');
        }
    });
    
    // Setup keyboard navigation for modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.show').forEach(modal => {
                modal.classList.remove('show');
            });
        }
    });
});