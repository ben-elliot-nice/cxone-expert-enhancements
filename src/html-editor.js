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

            // Set hooks for HTML-specific behavior
            this._baseEditor.onSaveAll = (btn) => this._baseEditor.saveAll(btn);
            this._baseEditor.onSaveOpenTabs = () => this.saveOpenTabs();
            this._baseEditor.onFormatAllActive = () => this.formatAllActive();
            this._baseEditor.onSaveItem = (fieldId, btn) => this._baseEditor.saveItem(fieldId, btn);
            this._baseEditor.onFormatItem = (fieldId) => this.formatField(fieldId);

            // Form data construction hooks
            this._baseEditor.buildFormDataForSave = (fieldId) => {
                return {
                    csrf_token: csrfToken,
                    html_template_head: fieldId === 'head' ? editorState.head.content : originalContent.head,
                    html_template_tail: fieldId === 'tail' ? editorState.tail.content : originalContent.tail
                };
            };

            this._baseEditor.buildFormDataForSaveAll = () => {
                return {
                    csrf_token: csrfToken,
                    html_template_head: editorState.head.content,
                    html_template_tail: editorState.tail.content
                };
            };

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
                // Load Prettier (blocking to prevent AMD race condition)
                try {
                    await context.Formatter.init();
                    console.log('[HTML Editor] Code formatter loaded successfully');
                    // Inject format buttons into all rendered panes
                    this._baseEditor.injectFormatButtons();
                } catch (formatterError) {
                    console.warn('[HTML Editor] Code formatter unavailable:', formatterError);
                    // Graceful degradation - editor works without formatting
                }

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
            const result = this._baseEditor.checkViewportWidth();
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
         * Load HTML data from API (delegated to BaseEditor)
         * @param {boolean} skipContent - If true, only fetch CSRF token (checkpoint protection)
         */
        async loadData(skipContent = false) {
            await this._baseEditor.loadData(skipContent);
            // Sync csrfToken to module variable for save operations
            csrfToken = this._baseEditor.csrfToken;
        },

        /**
         * Build toggle bar with field buttons or mobile dropdown
         * (delegated to BaseEditor)
         */
        buildToggleBar() {
            return this._baseEditor.buildToggleBar();
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
         * Setup save dropdown event listeners (delegated to BaseEditor)
         */
        setupSaveDropdown() {
            return this._baseEditor.setupSaveDropdown();
        },

        /**
         * Toggle editor for a field (delegated to BaseEditor)
         */
        toggleEditor(fieldId, event) {
            return this._baseEditor.toggleEditor(fieldId, event);
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
            return this._baseEditor.updateGrid();
        },

        /**
         * Calculate and set explicit pixel heights for editors (delegated to BaseEditor)
         */
        updateHeights() {
            return this._baseEditor.updateHeights();
        },

        /**
         * Create editor pane for a field (delegated to BaseEditor)
         */
        createEditorPane(fieldId) {
            return this._baseEditor.createEditorPane(fieldId);
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
            return this._baseEditor.toggleEditorDropdown(fieldId);
        },

        /**
         * Toggle actions dropdown menu (delegated to BaseEditor)
         */
        toggleActionsDropdown(fieldId) {
            return this._baseEditor.toggleActionsDropdown(fieldId);
        },

        /**
         * Setup keyboard shortcuts
         */
        setupKeyboardShortcuts() {
            this._baseEditor.setupKeyboardShortcuts();
            // Store reference to BaseEditor's handler in module-level variable for cleanup
            keyboardHandler = this._baseEditor.keyboardHandler;
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
