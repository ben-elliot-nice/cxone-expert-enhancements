/**
 * CXone Expert Enhancements - HTML Editor App
 *
 * Manages custom HTML head and tail content.
 *
 * @version 1.0.0
 */

// ES Module - import dependencies from core
import { AppManager } from './core.js';
import { BaseEditor } from './base-editor.js';

console.log('[HTML Editor App] Loading...');

    // ============================================================================
    // State & Configuration
    // ============================================================================

    const FIELD_CONFIG = [
        { id: 'head', label: 'Page HTML Head' },
        { id: 'tail', label: 'Page HTML Tail' }
    ];

    // Max active editors will be fetched from config

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

        // Dependencies: Apps that must be loaded before this app can initialize
        dependencies: ['settings'],

        // App-specific constraints for overlay sizing
        constraints: {
            minWidth: 420,
            minHeight: 300
        },

        // BaseEditor instance for shared functionality
        _baseEditor: null,

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

            // Create BaseEditor instance with HTML-specific configuration
            this._baseEditor = new BaseEditor({
                editorType: 'html',
                itemsConfig: FIELD_CONFIG,
                maxActiveEditors: 2,
                apiEndpoint: '/deki/cp/custom_html.php?params=%2F',
                formFieldPrefix: 'html_template_',
                monacoLanguage: 'html',
                fileExtension: '.html',
                mimeType: 'text/html',
                commentStyle: '<!-- -->',
                formatterMethod: 'formatHTML',
                dataAttribute: 'field',
                itemLabel: 'field'
            });

            // Share state with BaseEditor
            this._baseEditor.id = this.id;
            this._baseEditor.context = ctx;
            this._baseEditor.editorState = editorState;
            this._baseEditor.originalContent = originalContent;
            this._baseEditor.monacoEditors = monacoEditors;
            this._baseEditor.isMobileView = isMobileView;

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
         * Get current state for persistence (delegated to BaseEditor)
         */
        getState() {
            return this._baseEditor.getState();
        },

        /**
         * Restore state (delegated to BaseEditor)
         */
        setState(state) {
            return this._baseEditor.setState(state);
        },

        /**
         * Check viewport width and switch between mobile/desktop view (delegated to BaseEditor)
         */
        checkViewportWidth() {
            const result = this._baseEditor.checkViewportWidth.call(this);
            // Sync back to module variable
            isMobileView = this._baseEditor.isMobileView;
            return result;
        },

        /**
         * Handle mobile dropdown editor change (delegated to BaseEditor)
         */
        handleMobileEditorChange(newFieldId) {
            return this._baseEditor.handleMobileEditorChange(newFieldId);
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

                if (skipContent) {
                    // Checkpoint protection: we have dirty edits, so don't fetch HTML content
                    // This prevents other people's changes from overwriting work-in-progress
                } else {
                    // No dirty edits - safe to fetch fresh HTML from server

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
            }

            if (discardBtn) {
                discardBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.discardAll();
                });
            }

            if (dropdownToggle && dropdownMenu && dropdown) {
                dropdownToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdownMenu.classList.toggle('show');
                    dropdown.classList.toggle('open');
                });
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
                    const maxEditors = context.Config.get('editor.maxActiveTabs');
                    if (activeCount >= maxEditors) {
                        context.UI.showToast(`Maximum ${maxEditors} editors can be open at once`, 'warning');
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
         * Save current state to storage (delegated to BaseEditor)
         */
        saveState() {
            return this._baseEditor.saveState();
        },

        /**
         * Update editors grid (delegated to BaseEditor)
         */
        updateGrid() {
            return this._baseEditor.updateGrid.call(this);
        },

        /**
         * Calculate and set explicit pixel heights for editors (delegated to BaseEditor)
         */
        updateHeights() {
            return this._baseEditor.updateHeights();
        },

        /**
         * Create editor pane for a field
         */
        createEditorPane(fieldId) {
            const field = editorState[fieldId];

            const pane = context.DOM.create('div', { className: 'editor-pane' });
            const header = context.DOM.create('div', { className: 'editor-pane-header' });

            // Left side: Title + Status only
            const headerLeft = context.DOM.create('div', {
                className: 'header-left',
                style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }
            });

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
            headerLeft.appendChild(titleGroup);

            // Right side: Save dropdown + Actions dropdown
            const headerRight = context.DOM.create('div', {
                className: 'header-right',
                style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }
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

            const actionsDropdown = context.DOM.create('div', {
                className: 'editor-actions-dropdown',
                style: { position: 'relative' }
            });

            const actionsBtn = context.DOM.create('button', {
                className: 'editor-actions-btn',
                'data-actions-field': fieldId
            }, ['Actions ▼']);
            actionsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleActionsDropdown(fieldId);
            });

            const actionsMenu = context.DOM.create('div', {
                className: 'editor-actions-menu',
                'data-actions-menu-field': fieldId
            });

            // Format option (if Prettier available)
            if (context.Formatter.isReady()) {
                const formatItem = context.DOM.create('button', {
                    className: 'editor-actions-item',
                    'data-format-field': fieldId
                }, ['Format']);
                formatItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.formatField(fieldId);
                    actionsMenu.classList.remove('show');
                });
                actionsMenu.appendChild(formatItem);
            }

            // Import option with hidden file input
            const fileInput = context.DOM.create('input', {
                type: 'file',
                accept: '.html',
                style: 'display: none;',
                id: `file-input-${fieldId}`
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.importField(fieldId, e.target.files[0]);
                    e.target.value = ''; // Reset input to allow re-importing same file
                }
            });

            const importItem = context.DOM.create('button', {
                className: 'editor-actions-item',
                'data-import-field': fieldId
            }, ['Import']);
            importItem.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.click();
                actionsMenu.classList.remove('show');
            });

            // Export option
            const exportItem = context.DOM.create('button', {
                className: 'editor-actions-item',
                'data-export-field': fieldId
            }, ['Export']);
            exportItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.exportField(fieldId);
                actionsMenu.classList.remove('show');
            });

            actionsMenu.appendChild(importItem);
            actionsMenu.appendChild(exportItem);

            actionsDropdown.appendChild(actionsBtn);
            actionsDropdown.appendChild(actionsMenu);

            // Add both dropdowns to right side
            headerRight.appendChild(saveDropdown);
            headerRight.appendChild(actionsDropdown);

            pane.appendChild(fileInput);

            header.appendChild(headerLeft);
            header.appendChild(headerRight);
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
         * Create Monaco editor instance (delegated to BaseEditor)
         */
        createMonacoEditor(fieldId, container) {
            return this._baseEditor.createMonacoEditor(fieldId, container);
        },

        /**
         * Initialize editors (activate default if none active) (delegated to BaseEditor)
         */
        initializeEditors(skipDefault = false) {
            return this._baseEditor.initializeEditors(skipDefault);
        },

        /**
         * Update toggle button states and pane status indicators (delegated to BaseEditor)
         */
        updateToggleButtons() {
            return this._baseEditor.updateToggleButtons();
        },

        /**
         * Export HTML for a field (delegated to BaseEditor)
         */
        exportField(fieldId) {
            return this._baseEditor.exportItem(fieldId);
        },

        /**
         * Import HTML file into a field (appends content) (delegated to BaseEditor)
         */
        importField(fieldId, file) {
            return this._baseEditor.importItem(fieldId, file);
        },

        /**
         * Import HTML file via drag & drop (with field selector) (delegated to BaseEditor)
         */
        async importFile(fileContent, fileName) {
            return this._baseEditor.importFile(fileContent, fileName);
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
            return this._baseEditor.formatItem(fieldId, silent);
        },

        /**
         * Format all active editors
         */
        async formatAllActive() {
            return this._baseEditor.formatAllActive();
        },

        /**
         * Discard all changes (with inline confirmation)
         */
        discardAll() {
            return this._baseEditor.discardAll();
        },

        /**
         * Execute discard all (after confirmation)
         */
        performDiscardAll() {
            return this._baseEditor.performDiscardAll();
        },

        /**
         * Revert changes for a specific field (with inline confirmation)
         */
        revertField(fieldId) {
            return this._baseEditor.revertItem(fieldId);
        },

        /**
         * Execute revert (after confirmation)
         */
        performRevert(fieldId) {
            return this._baseEditor.performRevert(fieldId);
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
         * Toggle actions dropdown menu
         */
        toggleActionsDropdown(fieldId) {
            const menu = document.querySelector(`[data-actions-menu-field="${fieldId}"]`);
            if (!menu) return;

            // Close all other actions dropdowns
            document.querySelectorAll('.editor-actions-menu.show').forEach(m => {
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

                // Capture content being saved (to detect edits during save)
                const contentBeingSaved = field.content;

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

                    // Update original content to what was actually saved
                    originalContent[fieldId] = contentBeingSaved;

                    // Only mark clean if content hasn't changed during save
                    const currentContent = editor ? editor.getValue() : field.content;
                    if (currentContent === contentBeingSaved) {
                        field.isDirty = false;
                    } else {
                        field.isDirty = true;
                        console.log(`[HTML Editor] ${fieldId} content changed during save, keeping dirty state`);
                    }

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

                // Capture content being saved for all fields (to detect edits during save)
                const contentBeingSaved = {};
                Object.keys(editorState).forEach(fieldId => {
                    contentBeingSaved[fieldId] = editorState[fieldId].content;
                });

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

                    // Update original content and dirty flags
                    Object.keys(editorState).forEach(fieldId => {
                        // Update original content to what was actually saved
                        originalContent[fieldId] = contentBeingSaved[fieldId];

                        // Only mark clean if content hasn't changed during save
                        const editor = monacoEditors[fieldId];
                        const currentContent = editor ? editor.getValue() : editorState[fieldId].content;
                        if (currentContent === contentBeingSaved[fieldId]) {
                            editorState[fieldId].isDirty = false;
                        } else {
                            editorState[fieldId].isDirty = true;
                            console.log(`[HTML Editor] ${fieldId} content changed during save, keeping dirty state`);
                        }
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

                // Capture content being saved for open tabs (to detect edits during save)
                const contentBeingSaved = {};
                openFields.forEach(fieldId => {
                    contentBeingSaved[fieldId] = editorState[fieldId].content;
                });

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

                    // Update original content and dirty flags for saved tabs
                    openFields.forEach(fieldId => {
                        // Update original content to what was actually saved
                        originalContent[fieldId] = contentBeingSaved[fieldId];

                        // Only mark clean if content hasn't changed during save
                        const editor = monacoEditors[fieldId];
                        const currentContent = editor ? editor.getValue() : editorState[fieldId].content;
                        if (currentContent === contentBeingSaved[fieldId]) {
                            editorState[fieldId].isDirty = false;
                        } else {
                            editorState[fieldId].isDirty = true;
                            console.log(`[HTML Editor] ${fieldId} content changed during save, keeping dirty state`);
                        }
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
// Register App & Export
// ============================================================================

// Register with AppManager (gracefully handles registration failures)
try {
    // Debug/Test: Allow URL parameter to force registration failure
    const urlParams = new URLSearchParams(window.location.search);
    const failApps = urlParams.getAll('failApp');

    if (failApps.includes('html-editor')) {
        console.warn('[HTML Editor App] ⚠ Simulating registration failure (failApp URL param)');
        throw new Error('Simulated failure for testing (URL param: failApp=html-editor)');
    }

    const registered = AppManager.register(HTMLEditorApp);
    if (registered) {
        console.log('[HTML Editor App] Successfully registered');
    } else {
        console.error('[HTML Editor App] Registration failed - check AppManager logs');
    }
} catch (error) {
    console.error('[HTML Editor App] Unexpected error during registration:', error);
}

// Export for potential external use
export { HTMLEditorApp };
