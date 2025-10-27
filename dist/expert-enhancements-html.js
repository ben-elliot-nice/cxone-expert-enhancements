/**
 * CXone Expert Enhancements - HTML Editor App
 *
 * Manages custom HTML head and tail content.
 *
 * @version 1.0.0
 */

(function() {
    'use strict';

    console.log('[HTML Editor App] Loading...');

    // ============================================================================
    // State & Configuration
    // ============================================================================

    const FIELD_CONFIG = [
        { id: 'head', label: 'Page HTML Head' },
        { id: 'tail', label: 'Page HTML Tail' }
    ];

    const MAX_ACTIVE_EDITORS = 2;

    let context = null;
    let editorState = {};
    let originalContent = {};
    let csrfToken = '';
    let monacoEditors = {};
    let keyboardHandler = null; // Keyboard shortcut handler
    let isMobileView = false; // Track mobile/desktop view mode

    // ============================================================================
    // App Interface Implementation
    // ============================================================================

    const HTMLEditorApp = {
        id: 'html-editor',
        name: 'HTML Editor',

        // App-specific constraints for overlay sizing
        constraints: {
            minWidth: 420,
            minHeight: 300
        },

        /**
         * Initialize the app with context
         */
        async init(ctx) {
            console.log('[HTML Editor] Initializing...');
            context = ctx;

            // Initialize editor state
            FIELD_CONFIG.forEach(field => {
                editorState[field.id] = {
                    active: false,
                    editor: null,
                    content: '',
                    label: field.label,
                    isDirty: false
                };
            });

            // Wait for Monaco to be ready
            await context.Monaco.init();

            console.log('[HTML Editor] Initialized');
        },

        /**
         * Mount the app into the container
         */
        async mount(container) {
            console.log('[HTML Editor] Mounting...');

            // Build UI
            container.innerHTML = `
                <div class="enhancements-app-container">
                    <div id="message-area"></div>
                    <div id="html-editor-container" style="display: none;">
                        <div class="toggle-bar" id="toggle-bar"></div>
                        <div id="editors-grid" class="editors-grid"></div>
                    </div>
                </div>
            `;

            // Show loading overlay
            context.LoadingOverlay.show('Loading HTML from system...', {
                timeout: 30000,
                showProgress: true
            });

            try {
                // Start loading Prettier in background (non-blocking)
                context.Formatter.init()
                    .then(() => {
                        console.log('[HTML Editor] Code formatter loaded successfully');
                        // Inject format buttons into all rendered panes
                        this.injectFormatButtons();
                    })
                    .catch((error) => {
                        console.warn('[HTML Editor] Code formatter unavailable:', error);
                        // Silent failure - editor already loaded without formatting
                    });

                // Restore state if available
                const savedState = context.Storage.getAppState(this.id);
                let hasDirtyEdits = false;

                if (savedState) {
                    console.log('[HTML Editor] Restoring state:', savedState);
                    context.LoadingOverlay.setMessage('Restoring saved state...');
                    this.setState(savedState);

                    // Check if any fields are dirty
                    hasDirtyEdits = savedState.isDirty && Object.values(savedState.isDirty).some(dirty => dirty);
                    console.log('[HTML Editor] Has dirty edits in saved state:', hasDirtyEdits);
                }

                // Load HTML data - skip full fetch if we have dirty edits (checkpoint protection)
                if (hasDirtyEdits) {
                    context.LoadingOverlay.setMessage('Loading saved edits...');
                } else {
                    context.LoadingOverlay.setMessage('Fetching HTML from server...');
                }
                await this.loadData(hasDirtyEdits);

                // Setup save dropdown structure (one-time)
                this.setupSaveDropdownStructure();

                // Build toggle bar (buttons or dropdown based on viewport)
                // Note: Don't check viewport width here - overlay dimensions aren't ready yet
                // onResize() will be called after mount and will properly detect viewport
                this.buildToggleBar();

                // Initialize editors - skip default if we have saved state
                context.LoadingOverlay.setMessage('Initializing Monaco editors...');
                const skipDefault = !!savedState;
                console.log('[HTML Editor] Initializing editors, skip default:', skipDefault);
                this.initializeEditors(skipDefault);

                // Setup keyboard shortcuts
                this.setupKeyboardShortcuts();

                // Setup click listener to close dropdowns when clicking outside
                document.addEventListener('click', (e) => {
                    // Close global dropdown
                    const dropdown = document.querySelector('.save-dropdown');
                    const dropdownMenu = document.getElementById('save-dropdown-menu');
                    if (dropdown && dropdownMenu && !dropdown.contains(e.target)) {
                        dropdownMenu.classList.remove('show');
                        dropdown.classList.remove('open');
                    }

                    // Close editor dropdowns
                    if (!e.target.closest('.editor-save-dropdown')) {
                        document.querySelectorAll('.editor-save-dropdown-menu.show').forEach(menu => {
                            menu.classList.remove('show');
                        });
                    }
                });

                // Hide loading overlay
                context.LoadingOverlay.hide();

                console.log('[HTML Editor] Mounted');

            } catch (error) {
                console.error('[HTML Editor] Mount failed:', error);
                context.LoadingOverlay.showError('Failed to load HTML Editor: ' + error.message);
                throw error;
            }
        },

        /**
         * Unmount the app (cleanup)
         */
        async unmount() {
            console.log('[HTML Editor] Unmounting...');

            // Remove keyboard shortcuts
            if (keyboardHandler) {
                document.removeEventListener('keydown', keyboardHandler);
                keyboardHandler = null;
            }

            // Dispose Monaco editors
            Object.values(monacoEditors).forEach(editor => {
                if (editor) {
                    editor.dispose();
                }
            });
            monacoEditors = {};

            console.log('[HTML Editor] Unmounted');
        },

        /**
         * Handle resize events
         */
        onResize() {
            // Check if view mode changed (mobile/desktop)
            this.checkViewportWidth();

            // Recalculate heights and re-layout
            this.updateHeights();
        },

        /**
         * Get current state for persistence
         */
        getState() {
            const state = {
                activeFields: Object.keys(editorState).filter(field => editorState[field].active),
                content: {},
                isDirty: {},
                originalContent: {}
            };

            Object.keys(editorState).forEach(field => {
                const fieldState = editorState[field];
                state.content[field] = fieldState.content;
                state.isDirty[field] = fieldState.isDirty;
                state.originalContent[field] = originalContent[field];
            });

            return state;
        },

        /**
         * Restore state
         */
        setState(state) {
            if (!state) return;

            // Restore active fields
            if (state.activeFields) {
                state.activeFields.forEach(field => {
                    if (editorState[field]) {
                        editorState[field].active = true;
                    }
                });
            }

            // Restore content
            if (state.content) {
                Object.keys(state.content).forEach(field => {
                    if (editorState[field]) {
                        editorState[field].content = state.content[field];
                    }
                });
            }

            // Restore dirty state
            if (state.isDirty) {
                Object.keys(state.isDirty).forEach(field => {
                    if (editorState[field]) {
                        editorState[field].isDirty = state.isDirty[field];
                    }
                });
            }

            // Restore original content (server baseline)
            if (state.originalContent) {
                Object.keys(state.originalContent).forEach(field => {
                    originalContent[field] = state.originalContent[field];
                });
            }
        },

        /**
         * Check viewport width and switch between mobile/desktop view
         */
        checkViewportWidth() {
            const wasMobileView = isMobileView;

            // Get overlay width to determine mobile/desktop view
            // Use overlay instead of editor container to avoid issues when container is hidden
            const overlay = document.getElementById('expert-enhancements-overlay');
            if (overlay) {
                const containerWidth = overlay.offsetWidth;
                isMobileView = containerWidth < 920;
                console.log(`[HTML Editor] checkViewportWidth: width=${containerWidth}px, mobile=${isMobileView}`);
            }

            // If view mode changed, rebuild the toggle bar
            if (wasMobileView !== isMobileView) {
                console.log(`[HTML Editor] View mode changed to ${isMobileView ? 'mobile' : 'desktop'}`);
                this.buildToggleBar();

                // If switching to mobile and multiple editors are active, keep only the first
                if (isMobileView) {
                    const activeFields = Object.keys(editorState).filter(field => editorState[field].active);
                    if (activeFields.length > 1) {
                        console.log(`[HTML Editor] Multiple editors active in mobile view, keeping only: ${activeFields[0]}`);
                        // Deactivate all except the first
                        activeFields.slice(1).forEach(fieldId => {
                            editorState[fieldId].active = false;
                        });
                        this.updateGrid();
                    }
                }
            }
        },

        /**
         * Handle mobile dropdown editor change
         */
        handleMobileEditorChange(newFieldId) {
            console.log(`[HTML Editor] handleMobileEditorChange to: ${newFieldId}`);

            const currentActiveField = Object.keys(editorState).find(field => editorState[field].active);

            // If selecting the same field, do nothing
            if (newFieldId === currentActiveField) {
                return;
            }

            // Deactivate all editors
            Object.keys(editorState).forEach(fieldId => {
                editorState[fieldId].active = false;
            });

            // Activate selected editor
            editorState[newFieldId].active = true;

            this.updateGrid();
            this.saveState();

            // Update option text to reflect current status icons
            const mobileSelect = document.getElementById('mobile-editor-select');
            if (mobileSelect) {
                this.updateToggleButtons();
            }
        },

        /**
         * Load HTML data from API
         * @param {boolean} skipContent - If true, only fetch CSRF token (checkpoint protection)
         */
        async loadData(skipContent = false) {
            try {
                const url = '/deki/cp/custom_html.php?params=%2F';
                const response = await context.API.fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const html = await response.text();
                const { doc, data } = context.API.parseFormHTML(html);

                // Always extract CSRF token
                csrfToken = data.csrf_token;
                console.log('[HTML Editor] CSRF token extracted');

                if (skipContent) {
                    // Checkpoint protection: we have dirty edits, so don't fetch HTML content
                    // This prevents other people's changes from overwriting work-in-progress
                    console.log('[HTML Editor] Skipping content fetch - using saved edits (checkpoint protection)');
                } else {
                    // No dirty edits - safe to fetch fresh HTML from server
                    console.log('[HTML Editor] Fetching fresh HTML content from server');

                    const textareas = {
                        'html_template_head': 'head',
                        'html_template_tail': 'tail'
                    };

                    Object.entries(textareas).forEach(([name, fieldId]) => {
                        const textarea = doc.querySelector(`textarea[name="${name}"]`);
                        if (textarea) {
                            const content = textarea.textContent;
                            editorState[fieldId].content = content;
                            originalContent[fieldId] = content;
                        }
                    });
                }

                // Show editor container
                document.getElementById('html-editor-container').style.display = 'block';

                console.log('[HTML Editor] Data loaded');

            } catch (error) {
                console.error('[HTML Editor] Failed to load data:', error);
                context.UI.showToast('Failed to load HTML: ' + error.message, 'error');
            }
        },

        /**
         * Build toggle bar with field buttons or mobile dropdown
         */
        buildToggleBar() {
            const toggleBar = document.getElementById('toggle-bar');
            if (!toggleBar) return;

            console.log(`[HTML Editor] buildToggleBar for ${isMobileView ? 'mobile' : 'desktop'} view`);

            // Clear existing buttons/selectors (but keep save dropdown)
            const existingButtons = toggleBar.querySelectorAll('.toggle-btn, .mobile-selector-wrapper');
            existingButtons.forEach(el => el.remove());

            if (isMobileView) {
                // Create mobile dropdown selector
                const wrapper = document.createElement('div');
                wrapper.className = 'mobile-selector-wrapper';

                const label = document.createElement('label');
                label.htmlFor = 'mobile-editor-select';
                label.textContent = 'Editor: ';
                label.className = 'mobile-selector-label';

                const select = document.createElement('select');
                select.id = 'mobile-editor-select';
                select.className = 'mobile-editor-select';

                // Add options for each field with status icons
                FIELD_CONFIG.forEach(({ id, label: fieldLabel }) => {
                    const field = editorState[id];
                    const option = document.createElement('option');
                    option.value = id;
                    const statusIcon = field.isDirty ? '● ' : '✓ ';
                    option.textContent = statusIcon + fieldLabel;
                    option.setAttribute('data-field', id);
                    select.appendChild(option);
                });

                // Set current selection - respect already active editor
                let activeField = Object.keys(editorState).find(field => editorState[field].active);

                // Only activate first editor if truly no active editors exist
                if (!activeField) {
                    const firstField = FIELD_CONFIG[0].id;
                    editorState[firstField].active = true;
                    activeField = firstField;
                    console.log(`[HTML Editor] No active editor found, activating first: ${activeField}`);
                    // Need to render the editor
                    setTimeout(() => {
                        this.updateGrid();
                        this.saveState();
                    }, 0);
                } else {
                    console.log(`[HTML Editor] Using existing active editor: ${activeField}`);
                }

                select.value = activeField;

                // Add change listener
                select.addEventListener('change', (e) => this.handleMobileEditorChange(e.target.value));

                wrapper.appendChild(label);
                wrapper.appendChild(select);

                // Insert at the beginning of toggle bar (before save dropdown)
                const firstChild = toggleBar.firstChild;
                toggleBar.insertBefore(wrapper, firstChild);
            } else {
                // Create desktop toggle buttons
                FIELD_CONFIG.forEach(({ id, label }) => {
                    const btn = document.createElement('button');
                    btn.className = 'toggle-btn';
                    btn.setAttribute('data-field', id);
                    btn.textContent = label;
                    btn.addEventListener('click', (e) => this.toggleEditor(id, e));

                    // Insert before the save dropdown
                    const saveDropdown = toggleBar.querySelector('.save-dropdown');
                    toggleBar.insertBefore(btn, saveDropdown);
                });
            }

            this.updateToggleButtons();
        },

        /**
         * Setup save dropdown (called once during initial build)
         */
        setupSaveDropdownStructure() {
            const toggleBar = document.getElementById('toggle-bar');
            if (!toggleBar) return;

            // Create save/discard dropdown (matching CSS editor structure)
            const saveDropdown = context.DOM.create('div', { className: 'save-dropdown' });

            const saveBtn = context.DOM.create('button', {
                className: 'btn btn-primary',
                id: 'save-btn'
            }, ['Save All']);

            const dropdownToggle = context.DOM.create('button', {
                className: 'btn btn-dropdown-toggle',
                id: 'save-dropdown-toggle'
            }, ['▼']);

            const dropdownMenu = context.DOM.create('div', {
                className: 'dropdown-menu',
                id: 'save-dropdown-menu'
            });

            const discardBtn = context.DOM.create('button', {
                className: 'dropdown-item',
                id: 'discard-btn'
            }, ['Discard All']);

            dropdownMenu.appendChild(discardBtn);
            saveDropdown.appendChild(saveBtn);
            saveDropdown.appendChild(dropdownToggle);
            saveDropdown.appendChild(dropdownMenu);
            toggleBar.appendChild(saveDropdown);

            // Setup dropdown event listeners
            this.setupSaveDropdown();

            this.updateToggleButtons();
        },

        /**
         * Setup save dropdown event listeners
         */
        setupSaveDropdown() {
            const saveBtn = document.getElementById('save-btn');
            const discardBtn = document.getElementById('discard-btn');
            const dropdownToggle = document.getElementById('save-dropdown-toggle');
            const dropdownMenu = document.getElementById('save-dropdown-menu');
            const dropdown = document.querySelector('.save-dropdown');

            if (saveBtn) {
                saveBtn.addEventListener('click', () => this.saveAll());
                console.log('[HTML Editor] Save button listener attached');
            }

            if (discardBtn) {
                discardBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.discardAll();
                });
                console.log('[HTML Editor] Discard button listener attached');
            }

            if (dropdownToggle && dropdownMenu && dropdown) {
                dropdownToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdownMenu.classList.toggle('show');
                    dropdown.classList.toggle('open');
                });
                console.log('[HTML Editor] Dropdown toggle listener attached');
            }
        },

        /**
         * Toggle editor for a field
         * Left click: Open only this editor (close others)
         * Shift+click: Toggle this editor alongside others
         */
        toggleEditor(fieldId, event) {
            const field = editorState[fieldId];
            if (!field) return;

            const activeCount = Object.values(editorState).filter(f => f.active).length;
            const isShiftClick = event && event.shiftKey;

            if (isShiftClick) {
                // Shift+click: Toggle this editor while keeping others
                if (field.active) {
                    field.active = false;
                } else {
                    if (activeCount >= MAX_ACTIVE_EDITORS) {
                        context.UI.showToast(`Maximum ${MAX_ACTIVE_EDITORS} editors can be open at once`, 'warning');
                        return;
                    }
                    field.active = true;
                }
            } else {
                // Regular click: Open only this editor
                if (field.active && activeCount === 1) {
                    // Don't close if it's the only one open
                    return;
                }

                // Close all others
                Object.keys(editorState).forEach(fid => {
                    editorState[fid].active = false;
                });

                // Open this one
                field.active = true;
            }

            this.updateGrid();
            this.updateToggleButtons();
            this.saveState();
        },

        /**
         * Save current state to storage
         */
        saveState() {
            const state = this.getState();
            context.Storage.setAppState(this.id, state);
            console.log('[HTML Editor] State saved:', state);
        },

        /**
         * Update editors grid
         */
        updateGrid() {
            const grid = document.getElementById('editors-grid');
            if (!grid) return;

            const activeFields = Object.keys(editorState).filter(field => editorState[field].active);

            grid.innerHTML = '';
            grid.className = 'editors-grid cols-' + activeFields.length;

            activeFields.forEach(fieldId => {
                const pane = this.createEditorPane(fieldId);
                grid.appendChild(pane);
            });

            // Calculate and set explicit heights
            setTimeout(() => {
                this.updateHeights();
            }, 50);
        },

        /**
         * Calculate and set explicit pixel heights for editors
         */
        updateHeights() {
            const container = document.getElementById('html-editor-container');
            const toggleBar = document.querySelector('.toggle-bar');
            const grid = document.getElementById('editors-grid');

            if (!container || !toggleBar || !grid) return;

            // Calculate available height
            const containerHeight = container.offsetHeight;
            const toggleBarHeight = toggleBar.offsetHeight;
            const availableHeight = containerHeight - toggleBarHeight;

            // Set grid height explicitly
            grid.style.height = availableHeight + 'px';

            // Set each pane height explicitly
            const panes = grid.querySelectorAll('.editor-pane');
            panes.forEach(pane => {
                pane.style.height = availableHeight + 'px';

                const paneHeader = pane.querySelector('.editor-pane-header');
                const editorInstance = pane.querySelector('.editor-instance');

                if (paneHeader && editorInstance) {
                    const paneHeaderHeight = paneHeader.offsetHeight;
                    const editorHeight = availableHeight - paneHeaderHeight;
                    editorInstance.style.height = editorHeight + 'px';
                }
            });

            // Force layout on all Monaco editors
            Object.values(monacoEditors).forEach(editor => {
                if (editor) {
                    editor.layout();
                }
            });
        },

        /**
         * Create editor pane for a field
         */
        createEditorPane(fieldId) {
            const field = editorState[fieldId];

            const pane = context.DOM.create('div', { className: 'editor-pane' });
            const header = context.DOM.create('div', { className: 'editor-pane-header' });

            const titleGroup = context.DOM.create('div', {
                style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }
            });
            const title = context.DOM.create('span', {}, [field.label]);
            const status = context.DOM.create('span', {
                className: 'editor-status',
                id: `status-${fieldId}`,
                style: { fontSize: '0.9rem' }
            }, [field.isDirty ? '●' : '✓']);

            titleGroup.appendChild(status);
            titleGroup.appendChild(title);

            // Action buttons
            const actions = context.DOM.create('div', {
                className: 'editor-pane-actions',
                style: { display: 'flex', gap: '0.5rem', alignItems: 'center' }
            });

            // Save dropdown group
            const saveDropdown = context.DOM.create('div', {
                className: 'editor-save-dropdown'
            });

            const saveBtn = context.DOM.create('button', {
                className: 'editor-pane-save',
                'data-save-field': fieldId
            }, ['Save']);
            saveBtn.addEventListener('click', () => this.saveField(fieldId));

            const dropdownToggle = context.DOM.create('button', {
                className: 'editor-save-dropdown-toggle',
                'data-dropdown-field': fieldId
            }, ['▼']);
            dropdownToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleEditorDropdown(fieldId);
            });

            const dropdownMenu = context.DOM.create('div', {
                className: 'editor-save-dropdown-menu',
                'data-menu-field': fieldId
            });

            const revertBtn = context.DOM.create('button', {
                className: 'editor-dropdown-item',
                'data-revert-field': fieldId
            }, ['Revert this']);
            revertBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.revertField(fieldId);
            });

            dropdownMenu.appendChild(revertBtn);
            saveDropdown.appendChild(saveBtn);
            saveDropdown.appendChild(dropdownToggle);
            saveDropdown.appendChild(dropdownMenu);

            // Only add format button if Prettier is available
            if (context.Formatter.isReady()) {
                const formatBtn = context.DOM.create('button', {
                    className: 'editor-pane-format',
                    'data-format-field': fieldId,
                    title: 'Format HTML (Ctrl+Shift+F)'
                }, ['Format']);
                formatBtn.addEventListener('click', () => this.formatField(fieldId));
                actions.appendChild(formatBtn);
            }

            const exportBtn = context.DOM.create('button', {
                className: 'editor-pane-export',
                'data-export-field': fieldId
            }, ['Export']);
            exportBtn.addEventListener('click', () => this.exportField(fieldId));

            // Import button with hidden file input
            const importBtn = context.DOM.create('button', {
                className: 'editor-pane-import',
                'data-import-field': fieldId
            }, ['Import']);

            const fileInput = context.DOM.create('input', {
                type: 'file',
                accept: '.html',
                style: 'display: none;',
                id: `file-input-${fieldId}`
            });

            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.importField(fieldId, e.target.files[0]);
                    e.target.value = ''; // Reset input to allow re-importing same file
                }
            });

            actions.appendChild(saveDropdown);
            actions.appendChild(exportBtn);
            actions.appendChild(importBtn);
            pane.appendChild(fileInput);

            header.appendChild(titleGroup);
            header.appendChild(actions);
            pane.appendChild(header);

            const editorContainer = context.DOM.create('div', {
                className: 'editor-instance',
                id: `editor-${fieldId}`
            });
            pane.appendChild(editorContainer);

            // Create Monaco editor (CSS now properly sizes containers)
            if (context.Monaco.isReady()) {
                this.createMonacoEditor(fieldId, editorContainer);
            }

            return pane;
        },

        /**
         * Create Monaco editor instance
         */
        createMonacoEditor(fieldId, container) {
            const field = editorState[fieldId];
            const monaco = context.Monaco.get();

            // Create editor immediately (CSS now properly sizes containers)
            const editor = monaco.editor.create(container, {
                value: field.content || '',
                language: 'html',
                theme: 'vs-dark',
                automaticLayout: false,
                minimap: { enabled: true },
                fontSize: 14,
                wordWrap: 'on',
                scrollBeyondLastLine: false
            });

            monacoEditors[fieldId] = editor;

            // Track changes
            editor.onDidChangeModelContent(() => {
                field.content = editor.getValue();
                field.isDirty = field.content !== originalContent[fieldId];
                this.updateToggleButtons();
            });

            console.log(`[HTML Editor] Created Monaco editor for: ${fieldId}`);
        },

        /**
         * Initialize editors (activate default if none active)
         */
        initializeEditors(skipDefault = false) {
            const hasActive = Object.values(editorState).some(f => f.active);

            // Only set default if we should not skip and nothing is active
            if (!skipDefault && !hasActive) {
                // Activate 'head' by default
                editorState.head.active = true;
                console.log('[HTML Editor] No saved state, activating default: head');
            } else {
                console.log('[HTML Editor] Skipping default activation, skipDefault:', skipDefault, 'hasActive:', hasActive);
            }

            this.updateGrid();
        },

        /**
         * Update toggle button states and pane status indicators
         */
        updateToggleButtons() {
            const buttons = document.querySelectorAll('.toggle-btn');

            buttons.forEach(btn => {
                const fieldId = btn.getAttribute('data-field');
                const field = editorState[fieldId];

                if (field && field.active) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }

                // Show dirty indicator
                if (field && field.isDirty) {
                    btn.style.fontWeight = 'bold';
                    btn.style.color = '#ff9800';
                } else {
                    btn.style.fontWeight = '';
                    btn.style.color = '';
                }
            });

            // Update mobile dropdown (if it exists)
            const mobileSelect = document.getElementById('mobile-editor-select');
            if (mobileSelect) {
                const options = mobileSelect.querySelectorAll('option[data-field]');
                options.forEach(option => {
                    const fieldId = option.getAttribute('data-field');
                    const field = editorState[fieldId];
                    if (field) {
                        const statusIcon = field.isDirty ? '● ' : '✓ ';
                        const fieldLabel = FIELD_CONFIG.find(f => f.id === fieldId)?.label || fieldId;
                        option.textContent = statusIcon + fieldLabel;
                    }
                });
            }

            // Update editor pane status indicators
            Object.keys(editorState).forEach(fieldId => {
                const status = document.getElementById(`status-${fieldId}`);
                if (status) {
                    const field = editorState[fieldId];
                    status.textContent = field.isDirty ? '●' : '✓';
                    status.style.color = field.isDirty ? '#ff9800' : '#4caf50';
                }
            });
        },

        /**
         * Export HTML for a field
         */
        exportField(fieldId) {
            const field = editorState[fieldId];
            if (!field) return;

            try {
                const content = field.content || '';
                const blob = new Blob([content], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `html_template_${fieldId}.html`;
                a.click();
                URL.revokeObjectURL(url);

                context.UI.showToast(`Exported ${field.label}`, 'success');
            } catch (error) {
                context.UI.showToast(`Failed to export: ${error.message}`, 'error');
            }
        },

        /**
         * Import HTML file into a field (appends content)
         */
        importField(fieldId, file) {
            const field = editorState[fieldId];
            if (!field) return;

            // Validate file type
            if (!file.name.endsWith('.html')) {
                context.UI.showToast('Please select an HTML file (.html)', 'error');
                return;
            }

            // Validate file size (max 5MB)
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                context.UI.showToast(`File too large. Maximum size is 5MB (file is ${(file.size / 1024 / 1024).toFixed(2)}MB)`, 'error');
                return;
            }

            // Check for empty files
            if (file.size === 0) {
                context.UI.showToast('Cannot import empty file', 'error');
                return;
            }

            // Show loading state
            context.LoadingOverlay.show(`Importing ${file.name}...`);

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const importedContent = e.target.result;

                    // Create separator comment
                    const separator = `\n\n<!-- ========================================\n     Imported from: ${file.name}\n     Date: ${new Date().toLocaleString()}\n     ======================================== -->\n`;

                    // Append content to existing
                    const currentContent = field.content || '';
                    const newContent = currentContent + separator + importedContent;

                    // Update state
                    field.content = newContent;
                    field.isDirty = true;

                    // Update Monaco editor using executeEdits for undo support
                    if (monacoEditors[fieldId]) {
                        const editor = monacoEditors[fieldId];
                        const model = editor.getModel();
                        const lineCount = model.getLineCount();
                        const lastLineLength = model.getLineLength(lineCount);

                        editor.executeEdits('import', [{
                            range: new monaco.Range(lineCount, lastLineLength + 1, lineCount, lastLineLength + 1),
                            text: separator + importedContent
                        }]);
                    }

                    // Save state and update UI
                    this.saveState();
                    this.updateToggleButtons();

                    context.LoadingOverlay.hide();
                    context.UI.showToast(`Content from ${file.name} appended to ${field.label}`, 'success', 5000);
                } catch (error) {
                    context.LoadingOverlay.hide();
                    context.UI.showToast(`Failed to import: ${error.message}`, 'error');
                }
            };

            reader.onerror = () => {
                context.LoadingOverlay.hide();
                context.UI.showToast('Failed to read file', 'error');
            };

            reader.readAsText(file);
        },

        /**
         * Import HTML file via drag & drop (with field selector)
         */
        async importFile(fileContent, fileName) {
            try {
                // Hide loading overlay before showing field selector (waiting for user input)
                context.LoadingOverlay.hide();

                // Prepare field list for selector
                const roles = Object.keys(editorState).map(fieldId => ({
                    id: fieldId,
                    label: editorState[fieldId].label
                }));

                // Show field selector dialog
                const selectedFieldId = await context.FileImport.showRoleSelector(roles, 'html');

                if (!selectedFieldId) {
                    context.LoadingOverlay.hide();
                    context.UI.showToast('Import cancelled', 'info');
                    return;
                }

                const field = editorState[selectedFieldId];
                if (!field) {
                    context.LoadingOverlay.hide();
                    context.UI.showToast('Selected field not found', 'error');
                    return;
                }

                // Create separator comment
                const separator = `\n\n<!-- ========================================\n     Imported from: ${fileName}\n     Date: ${new Date().toLocaleString()}\n     ======================================== -->\n`;

                // Append content to existing
                const currentContent = field.content || '';
                const newContent = currentContent + separator + fileContent;

                // Update state
                field.content = newContent;
                field.isDirty = true;

                // Update Monaco editor using executeEdits for undo support
                if (monacoEditors[selectedFieldId]) {
                    const editor = monacoEditors[selectedFieldId];
                    const model = editor.getModel();
                    const lineCount = model.getLineCount();
                    const lastLineLength = model.getLineLength(lineCount);

                    editor.executeEdits('import', [{
                        range: new monaco.Range(lineCount, lastLineLength + 1, lineCount, lastLineLength + 1),
                        text: separator + fileContent
                    }]);

                    // Focus editor and ensure proper layout after import
                    setTimeout(() => {
                        editor.layout();
                        editor.focus();

                        // Ensure editor captures scroll events
                        const editorDom = editor.getDomNode();
                        if (editorDom) {
                            editorDom.style.pointerEvents = 'auto';
                        }
                    }, 50);
                }

                // Save state and update UI
                this.saveState();
                this.updateToggleButtons();

                context.LoadingOverlay.hide();
                context.UI.showToast(`Content from ${fileName} appended to ${field.label}`, 'success', 5000);
            } catch (error) {
                context.LoadingOverlay.hide();
                context.UI.showToast(`Failed to import: ${error.message}`, 'error');
            }
        },

        /**
         * Inject format buttons into all rendered editor panes
         * Called when Prettier becomes available after editor is already mounted
         */
        injectFormatButtons() {
            console.log('[HTML Editor] Injecting format buttons into rendered panes');

            // Find all editor pane actions containers
            const panes = document.querySelectorAll('.editor-pane');

            panes.forEach(pane => {
                const actions = pane.querySelector('.editor-pane-actions');
                const exportBtn = pane.querySelector('.editor-pane-export');

                if (!actions || !exportBtn) return;

                // Check if format button already exists
                if (pane.querySelector('.editor-pane-format')) return;

                // Get fieldId from export button
                const fieldId = exportBtn.getAttribute('data-export-field');
                if (!fieldId) return;

                // Create and insert format button before export button
                const formatBtn = context.DOM.create('button', {
                    className: 'editor-pane-format',
                    'data-format-field': fieldId,
                    title: 'Format HTML (Ctrl+Shift+F)'
                }, ['Format']);
                formatBtn.addEventListener('click', () => this.formatField(fieldId));

                // Insert before export button
                actions.insertBefore(formatBtn, exportBtn);

                console.log(`[HTML Editor] Format button injected for: ${fieldId}`);
            });
        },

        /**
         * Format HTML for a specific field
         * @param {string} fieldId - Field identifier
         * @param {boolean} silent - If true, suppress success toast
         * @returns {Object|null} - { changed: boolean, label: string } or null on error/empty
         */
        async formatField(fieldId, silent = false) {
            if (!context.Formatter.isReady()) {
                context.UI.showToast('Code formatting is currently unavailable', 'warning');
                return null;
            }

            const field = editorState[fieldId];
            const editor = monacoEditors[fieldId];

            if (!field || !editor) return null;

            try {
                console.log(`[HTML Editor] Formatting ${fieldId}...`);

                // Get current content
                const content = editor.getValue();

                if (!content || content.trim() === '') {
                    context.UI.showToast('Nothing to format', 'warning');
                    return null;
                }

                // Format using Prettier
                const formatted = await context.Formatter.formatHTML(content);

                // Check if content actually changed
                const changed = content !== formatted;

                // Update editor with formatted content
                editor.setValue(formatted);

                // Mark as dirty if content changed
                field.content = formatted;
                field.isDirty = field.content !== originalContent[fieldId];
                this.updateToggleButtons();

                if (!silent) {
                    const message = changed ? `${field.label} formatted` : `${field.label} already formatted`;
                    context.UI.showToast(message, 'success');
                }

                return { changed, label: field.label };
            } catch (error) {
                console.error(`[HTML Editor] Format ${fieldId} failed:`, error);
                context.UI.showToast(`Formatting failed: ${error.message}`, 'error');
                return null;
            }
        },

        /**
         * Format all active editors
         */
        async formatAllActive() {
            if (!context.Formatter.isReady()) {
                context.UI.showToast('Code formatting is currently unavailable', 'warning');
                return;
            }

            const activeFields = Object.keys(editorState).filter(field => editorState[field].active);

            if (activeFields.length === 0) {
                context.UI.showToast('No editors open to format', 'warning');
                return;
            }

            try {
                console.log(`[HTML Editor] Formatting ${activeFields.length} active editor(s)...`);

                // Format each active editor (silent mode to avoid duplicate toasts)
                const results = [];
                for (const fieldId of activeFields) {
                    const result = await this.formatField(fieldId, true);
                    if (result) {
                        results.push(result);
                    }
                }

                // Build appropriate toast message based on what actually changed
                const changedResults = results.filter(r => r.changed);
                const changedCount = changedResults.length;

                let message;
                if (changedCount === 0) {
                    message = results.length === 1 ? `${results[0].label} already formatted` : 'Already formatted';
                } else if (changedCount === 1) {
                    message = `${changedResults[0].label} formatted`;
                } else {
                    message = `${changedCount} editors formatted`;
                }

                context.UI.showToast(message, 'success');
            } catch (error) {
                console.error('[HTML Editor] Format all active failed:', error);
                context.UI.showToast(`Formatting failed: ${error.message}`, 'error');
            }
        },

        /**
         * Discard all changes (with inline confirmation)
         */
        discardAll() {
            // Check if there are any unsaved changes
            const hasUnsavedChanges = Object.values(editorState).some(field => field.isDirty);
            const discardBtn = document.getElementById('discard-btn');

            if (hasUnsavedChanges) {
                // Show inline confirmation
                if (discardBtn && !discardBtn.classList.contains('confirming')) {
                    context.UI.showInlineConfirmation(discardBtn, () => {
                        this.performDiscardAll();
                    });
                }
                return;
            }

            // No changes - show "No changes" message
            if (discardBtn && !discardBtn.classList.contains('showing-no-changes')) {
                context.UI.showNoChangesMessage(discardBtn);
            }
        },

        /**
         * Execute discard all (after confirmation)
         */
        performDiscardAll() {
            Object.keys(editorState).forEach(fieldId => {
                editorState[fieldId].content = originalContent[fieldId] || '';
                editorState[fieldId].isDirty = false;

                const editor = monacoEditors[fieldId];
                if (editor) {
                    editor.setValue(editorState[fieldId].content);
                }
            });

            this.updateToggleButtons();

            // Check if all editors are now clean - if so, clear app state
            const allClean = Object.values(editorState).every(s => !s.isDirty);
            if (allClean) {
                console.log('[HTML Editor] All editors clean, clearing app state');
                context.Storage.clearAppState(this.id);
            } else {
                this.saveState();
            }

            context.UI.showToast('All changes discarded', 'success');
        },

        /**
         * Revert changes for a specific field (with inline confirmation)
         */
        revertField(fieldId) {
            const field = editorState[fieldId];
            if (!field) return;

            const revertBtn = document.querySelector(`[data-revert-field="${fieldId}"]`);
            if (!revertBtn) return;

            if (field.isDirty) {
                // Show inline confirmation
                if (!revertBtn.classList.contains('confirming')) {
                    context.UI.showInlineConfirmation(revertBtn, () => {
                        this.performRevert(fieldId);
                    });
                }
                return;
            }

            // No changes - show "No changes" message
            if (!revertBtn.classList.contains('showing-no-changes')) {
                context.UI.showNoChangesMessage(revertBtn);
            }
        },

        /**
         * Execute revert (after confirmation)
         */
        performRevert(fieldId) {
            const field = editorState[fieldId];
            if (!field) return;

            field.content = originalContent[fieldId] || '';
            field.isDirty = false;

            const editor = monacoEditors[fieldId];
            if (editor) {
                editor.setValue(field.content);
            }

            // Close the dropdown
            const menu = document.querySelector(`[data-menu-field="${fieldId}"]`);
            if (menu) {
                menu.classList.remove('show');
            }

            this.updateToggleButtons();

            // Check if all editors are now clean - if so, clear app state
            const allClean = Object.values(editorState).every(s => !s.isDirty);
            if (allClean) {
                console.log('[HTML Editor] All editors clean, clearing app state');
                context.Storage.clearAppState(this.id);
            } else {
                this.saveState();
            }

            context.UI.showToast(`${field.label} reverted`, 'success');
        },

        /**
         * Toggle editor dropdown menu
         */
        toggleEditorDropdown(fieldId) {
            const menu = document.querySelector(`[data-menu-field="${fieldId}"]`);
            if (!menu) return;

            // Close all other editor dropdowns
            document.querySelectorAll('.editor-save-dropdown-menu.show').forEach(m => {
                if (m !== menu) {
                    m.classList.remove('show');
                }
            });

            // Toggle this dropdown
            menu.classList.toggle('show');
        },

        /**
         * Save a single HTML field
         */
        async saveField(fieldId) {
            try {
                console.log(`[HTML Editor] Saving ${fieldId}...`);

                const field = editorState[fieldId];
                if (!field) {
                    throw new Error(`Field ${fieldId} not found`);
                }

                // Sync this editor's value to state
                const editor = monacoEditors[fieldId];
                if (editor) {
                    field.content = editor.getValue();
                }

                // Format on save if enabled and formatter available
                const settings = context.Storage.getFormatterSettings();
                if (settings.formatOnSave && context.Formatter.isReady() && field.content && field.content.trim() !== '') {
                    try {
                        console.log(`[HTML Editor] Auto-formatting ${fieldId} before save...`);
                        const formatted = await context.Formatter.formatHTML(field.content);
                        field.content = formatted;
                        if (editor) {
                            editor.setValue(formatted);
                        }
                    } catch (formatError) {
                        console.warn(`[HTML Editor] Auto-format failed for ${fieldId}:`, formatError);
                        // Continue with save even if formatting fails
                    }
                }

                // Check if this field has changes
                if (!field.isDirty && field.content === originalContent[fieldId]) {
                    context.UI.showToast(`${field.label} has no changes to save`, 'warning');
                    return;
                }

                // Build form data - send the edited field + original content for others
                // This ensures only the specific field is saved, not all edited fields
                const formData = {
                    csrf_token: csrfToken,
                    html_template_head: fieldId === 'head' ? editorState.head.content : originalContent.head,
                    html_template_tail: fieldId === 'tail' ? editorState.tail.content : originalContent.tail
                };

                const { body, boundary } = context.API.buildMultipartBody(formData);

                const url = '/deki/cp/custom_html.php?params=%2F';
                const response = await context.API.fetch(url, {
                    method: 'POST',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'max-age=0',
                        'Content-Type': `multipart/form-data; boundary=${boundary}`
                    },
                    credentials: 'include',
                    body: body,
                    redirect: 'follow'
                });

                if (response.ok || response.redirected) {
                    context.UI.showToast(`${field.label} saved successfully!`, 'success');

                    // Update original content for this field only
                    originalContent[fieldId] = field.content;
                    field.isDirty = false;

                    this.updateToggleButtons();

                    // Persist updated state to localStorage
                    this.saveState();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error(`[HTML Editor] Save ${fieldId} failed:`, error);
                context.UI.showToast(`Failed to save: ${error.message}`, 'error');
            }
        },

        /**
         * Save all HTML
         */
        async saveAll() {
            try {
                console.log('[HTML Editor] Saving all HTML...');

                // Sync editor values to state
                Object.keys(monacoEditors).forEach(fieldId => {
                    const editor = monacoEditors[fieldId];
                    if (editor) {
                        editorState[fieldId].content = editor.getValue();
                    }
                });

                // Format on save if enabled and formatter available
                const settings = context.Storage.getFormatterSettings();
                if (settings.formatOnSave && context.Formatter.isReady()) {
                    for (const fieldId of Object.keys(editorState)) {
                        const field = editorState[fieldId];
                        if (field.content && field.content.trim() !== '') {
                            try {
                                console.log(`[HTML Editor] Auto-formatting ${fieldId} before save...`);
                                const formatted = await context.Formatter.formatHTML(field.content);
                                field.content = formatted;
                                const editor = monacoEditors[fieldId];
                                if (editor) {
                                    editor.setValue(formatted);
                                }
                            } catch (formatError) {
                                console.warn(`[HTML Editor] Auto-format failed for ${fieldId}:`, formatError);
                                // Continue with save even if formatting fails
                            }
                        }
                    }
                }

                // Check if any field has changes
                const hasChanges = Object.keys(editorState).some(fieldId => {
                    return editorState[fieldId].isDirty || editorState[fieldId].content !== originalContent[fieldId];
                });

                if (!hasChanges) {
                    context.UI.showToast('No changes to save', 'warning');
                    return;
                }

                // Build form data
                const formData = {
                    csrf_token: csrfToken,
                    html_template_head: editorState.head.content,
                    html_template_tail: editorState.tail.content
                };

                const { body, boundary } = context.API.buildMultipartBody(formData);

                const url = '/deki/cp/custom_html.php?params=%2F';
                const response = await context.API.fetch(url, {
                    method: 'POST',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'max-age=0',
                        'Content-Type': `multipart/form-data; boundary=${boundary}`
                    },
                    credentials: 'include',
                    body: body,
                    redirect: 'follow'
                });

                if (response.ok || response.redirected) {
                    context.UI.showToast('HTML saved successfully!', 'success');

                    // Update original content
                    Object.keys(editorState).forEach(fieldId => {
                        originalContent[fieldId] = editorState[fieldId].content;
                        editorState[fieldId].isDirty = false;
                    });

                    this.updateToggleButtons();

                    // Persist updated state to localStorage
                    this.saveState();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error('[HTML Editor] Save failed:', error);
                context.UI.showToast('Failed to save HTML: ' + error.message, 'error');
            }
        },

        /**
         * Save only the currently open tabs
         */
        async saveOpenTabs() {
            try {
                const openFields = Object.keys(editorState).filter(field => editorState[field].active);

                if (openFields.length === 0) {
                    context.UI.showToast('No tabs open to save', 'warning');
                    return;
                }

                console.log(`[HTML Editor] Saving ${openFields.length} open tab(s):`, openFields);

                // Sync editor values to state for open tabs
                openFields.forEach(fieldId => {
                    const editor = monacoEditors[fieldId];
                    if (editor) {
                        editorState[fieldId].content = editor.getValue();
                    }
                });

                // Format on save if enabled and formatter available
                const settings = context.Storage.getFormatterSettings();
                if (settings.formatOnSave && context.Formatter.isReady()) {
                    for (const fieldId of openFields) {
                        const field = editorState[fieldId];
                        if (field.content && field.content.trim() !== '') {
                            try {
                                console.log(`[HTML Editor] Auto-formatting ${fieldId} before save...`);
                                const formatted = await context.Formatter.formatHTML(field.content);
                                field.content = formatted;
                                const editor = monacoEditors[fieldId];
                                if (editor) {
                                    editor.setValue(formatted);
                                }
                            } catch (formatError) {
                                console.warn(`[HTML Editor] Auto-format failed for ${fieldId}:`, formatError);
                                // Continue with save even if formatting fails
                            }
                        }
                    }
                }

                // Check if any open tab has changes
                const hasChanges = openFields.some(fieldId => {
                    return editorState[fieldId].isDirty || editorState[fieldId].content !== originalContent[fieldId];
                });

                if (!hasChanges) {
                    const tabLabel = openFields.length === 1 ? editorState[openFields[0]].label : `${openFields.length} tabs`;
                    context.UI.showToast(`${tabLabel} have no changes to save`, 'warning');
                    return;
                }

                // Build form data - send edited content for open tabs, original for closed tabs
                const formData = {
                    csrf_token: csrfToken,
                    html_template_head: openFields.includes('head') ? editorState.head.content : originalContent.head,
                    html_template_tail: openFields.includes('tail') ? editorState.tail.content : originalContent.tail
                };

                const { body, boundary } = context.API.buildMultipartBody(formData);

                const url = '/deki/cp/custom_html.php?params=%2F';
                const response = await context.API.fetch(url, {
                    method: 'POST',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'max-age=0',
                        'Content-Type': `multipart/form-data; boundary=${boundary}`
                    },
                    credentials: 'include',
                    body: body,
                    redirect: 'follow'
                });

                if (response.ok || response.redirected) {
                    const tabLabel = openFields.length === 1 ? editorState[openFields[0]].label : `${openFields.length} tabs`;
                    context.UI.showToast(`${tabLabel} saved successfully!`, 'success');

                    // Update original content for saved tabs
                    openFields.forEach(fieldId => {
                        originalContent[fieldId] = editorState[fieldId].content;
                        editorState[fieldId].isDirty = false;
                    });

                    this.updateToggleButtons();
                    this.saveState();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error('[HTML Editor] Save open tabs failed:', error);
                context.UI.showToast('Failed to save: ' + error.message, 'error');
            }
        },

        /**
         * Setup keyboard shortcuts
         */
        setupKeyboardShortcuts() {
            keyboardHandler = (e) => {
                // Ctrl+S or Cmd+S - Save open tabs
                if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
                    e.preventDefault();
                    this.saveOpenTabs();
                }
                // Ctrl+Shift+S or Cmd+Shift+S - Save all
                else if ((e.ctrlKey || e.metaKey) && e.key === 'S' && e.shiftKey) {
                    e.preventDefault();
                    this.saveAll();
                }
                // Ctrl+Shift+F or Cmd+Shift+F - Format active editors (only if available)
                else if ((e.ctrlKey || e.metaKey) && e.key === 'F' && e.shiftKey) {
                    e.preventDefault();
                    if (context.Formatter.isReady()) {
                        this.formatAllActive();
                    }
                    // Silent no-op if formatter not available
                }
            };

            document.addEventListener('keydown', keyboardHandler);
            console.log('[HTML Editor] Keyboard shortcuts registered: Ctrl+S (save open), Ctrl+Shift+S (save all), Ctrl+Shift+F (format)');
        }
    };

    // ============================================================================
    // Register App
    // ============================================================================

    // Wait for core to be ready
    const waitForCore = setInterval(() => {
        if (window.ExpertEnhancements && window.ExpertEnhancements.AppManager) {
            clearInterval(waitForCore);
            window.ExpertEnhancements.AppManager.register(HTMLEditorApp);
            console.log('[HTML Editor App] Registered');
        }
    }, 100);

})();
