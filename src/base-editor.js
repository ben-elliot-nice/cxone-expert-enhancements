/**
 * Base Editor - Shared functionality for CSS and HTML editors
 *
 * This class encapsulates all common editor logic to eliminate duplication
 * between CSS Editor (6 roles) and HTML Editor (2 fields).
 *
 * @version 1.0.0
 */

export class BaseEditor {
    /**
     * @param {Object} config - Editor configuration
     * @param {string} config.editorType - 'css' or 'html'
     * @param {Array} config.itemsConfig - Array of {id, label} objects
     * @param {number} config.maxActiveEditors - Max concurrent editors
     * @param {string} config.apiEndpoint - Save/load API URL
     * @param {string} config.formFieldPrefix - Form field prefix (e.g., 'css_template_')
     * @param {string} config.monacoLanguage - Monaco language mode
     * @param {string} config.fileExtension - File extension for import/export
     * @param {string} config.mimeType - MIME type for export
     * @param {string} config.commentStyle - Comment style for imports
     * @param {string} config.formatterMethod - Formatter method name
     * @param {string} config.dataAttribute - HTML data attribute name
     * @param {string} config.itemLabel - Label for log messages
     */
    constructor(config) {
        this.config = this.validateConfig(config);

        // Shared state
        this.context = null;
        this.editorState = {};
        this.originalContent = {};
        this.csrfToken = '';
        this.monacoEditors = {};
        this.isMobileView = false;
        this.keyboardHandler = null;

        // Hooks for app-specific behavior
        this.onEditorContentChange = null;  // e.g., CSS live preview
        this.onSaveAll = null;  // Save all editors callback
        this.onSaveOpenTabs = null;  // Save open tabs callback
        this.onFormatAllActive = null;  // Format all active editors callback
        this.onSaveItem = null;  // Save single item callback
    }

    /**
     * Validate configuration object
     */
    validateConfig(config) {
        const required = [
            'editorType', 'itemsConfig', 'maxActiveEditors', 'apiEndpoint',
            'formFieldPrefix', 'monacoLanguage', 'fileExtension', 'mimeType',
            'commentStyle', 'formatterMethod', 'dataAttribute', 'itemLabel'
        ];

        for (const field of required) {
            if (!(field in config)) {
                throw new Error(`BaseEditor config missing required field: ${field}`);
            }
        }

        // Validate types
        if (typeof config.editorType !== 'string') {
            throw new Error('BaseEditor config.editorType must be a string');
        }

        if (!Array.isArray(config.itemsConfig)) {
            throw new Error('BaseEditor config.itemsConfig must be an array');
        }

        if (typeof config.maxActiveEditors !== 'number' || config.maxActiveEditors < 1) {
            throw new Error('BaseEditor config.maxActiveEditors must be a positive number');
        }

        return config;
    }

    /**
     * Get configuration value
     */
    getConfig(key) {
        return this.config[key];
    }

    /**
     * Get editor type in uppercase for logging
     */
    getEditorTypeUpper() {
        return this.config.editorType.toUpperCase();
    }

    /**
     * Log message with editor type prefix
     */
    log(...args) {
        console.log(`[${this.getEditorTypeUpper()} Editor]`, ...args);
    }

    /**
     * Log error with editor type prefix
     */
    logError(...args) {
        console.error(`[${this.getEditorTypeUpper()} Editor]`, ...args);
    }

    // ============================================================================
    // Data Loading
    // ============================================================================

    /**
     * Load data from API
     * @param {boolean} skipContent - If true, only fetch CSRF token (checkpoint protection)
     */
    async loadData(skipContent = false) {
        try {
            const response = await this.context.API.fetch(this.config.apiEndpoint);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const { doc, data } = this.context.API.parseFormHTML(html);

            // Always extract CSRF token
            this.csrfToken = data.csrf_token;

            if (skipContent) {
                // Checkpoint protection: we have dirty edits, so don't fetch content
                // This prevents other people's changes from overwriting work-in-progress
                console.log(`[${this.getEditorTypeUpper()} Editor] Skipped content load (checkpoint protection)`);
            } else {
                // No dirty edits - safe to fetch fresh content from server
                this.config.itemsConfig.forEach(({ id }) => {
                    const fieldName = `${this.config.formFieldPrefix}${id}`;
                    const textarea = doc.querySelector(`textarea[name="${fieldName}"]`);
                    if (textarea) {
                        const content = textarea.textContent;
                        this.editorState[id].content = content;
                        this.originalContent[id] = content;
                    }
                });
            }

            // Show editor container
            const containerId = `${this.config.editorType}-editor-container`;
            const container = document.getElementById(containerId);
            if (container) {
                container.style.display = 'block';
            }

            console.log(`[${this.getEditorTypeUpper()} Editor] Data loaded`);

        } catch (error) {
            console.error(`[${this.getEditorTypeUpper()} Editor] Failed to load data:`, error);
            this.context.UI.showToast(
                `Failed to load ${this.config.editorType.toUpperCase()}: ${error.message}`,
                'error'
            );
        }
    }

    // ============================================================================
    // State Management
    // ============================================================================

    /**
     * Get current state for persistence
     */
    getState() {
        const itemLabel = this.config.itemLabel;
        const activeKey = itemLabel === 'role' ? 'activeRoles' : 'activeFields';

        const state = {
            [activeKey]: Object.keys(this.editorState).filter(
                id => this.editorState[id].active
            ),
            content: {},
            isDirty: {},
            originalContent: {}
        };

        Object.keys(this.editorState).forEach(itemId => {
            const itemState = this.editorState[itemId];
            state.content[itemId] = itemState.content;
            state.isDirty[itemId] = itemState.isDirty;
            state.originalContent[itemId] = this.originalContent[itemId];
        });

        return state;
    }

    /**
     * Restore state
     */
    setState(state) {
        if (!state) return;

        const itemLabel = this.config.itemLabel;
        const activeKey = itemLabel === 'role' ? 'activeRoles' : 'activeFields';

        // Restore active items
        if (state[activeKey]) {
            state[activeKey].forEach(itemId => {
                if (this.editorState[itemId]) {
                    this.editorState[itemId].active = true;
                }
            });
        }

        // Restore content
        if (state.content) {
            Object.keys(state.content).forEach(itemId => {
                if (this.editorState[itemId]) {
                    this.editorState[itemId].content = state.content[itemId];
                }
            });
        }

        // Restore dirty state
        if (state.isDirty) {
            Object.keys(state.isDirty).forEach(itemId => {
                if (this.editorState[itemId]) {
                    this.editorState[itemId].isDirty = state.isDirty[itemId];
                }
            });
        }

        // Restore original content (server baseline)
        if (state.originalContent) {
            Object.keys(state.originalContent).forEach(itemId => {
                this.originalContent[itemId] = state.originalContent[itemId];
            });
        }
    }

    /**
     * Save current state to storage
     */
    saveState() {
        const appId = `${this.config.editorType}-editor`;
        const state = this.getState();
        this.context.Storage.setAppState(appId, state);
    }

    // ============================================================================
    // Viewport & Mobile Detection
    // ============================================================================

    /**
     * Check viewport width and switch between mobile/desktop view
     */
    checkViewportWidth() {
        const wasMobileView = this.isMobileView;

        // Get overlay width to determine mobile/desktop view
        // Use overlay instead of editor container to avoid issues when container is hidden
        const overlay = document.getElementById('expert-enhancements-overlay');
        if (overlay) {
            const containerWidth = overlay.offsetWidth;
            const desktopBreakpoint = this.context.Config.get('advanced.breakpoints.desktop');
            this.isMobileView = containerWidth < desktopBreakpoint;
        }

        // If view mode changed, rebuild the toggle bar
        if (wasMobileView !== this.isMobileView) {
            // Note: buildToggleBar() will be extracted in Phase 9
            // For now, it must be implemented by the child class
            this.buildToggleBar();

            // If switching to mobile and multiple editors are active, keep only the first
            if (this.isMobileView) {
                const activeItems = Object.keys(this.editorState).filter(
                    id => this.editorState[id].active
                );
                if (activeItems.length > 1) {
                    // Deactivate all except the first
                    activeItems.slice(1).forEach(itemId => {
                        this.editorState[itemId].active = false;
                    });
                    this.updateGrid();
                    this.saveState();
                }
            }
            this.updateToggleButtons();
        }

        return this.isMobileView;
    }

    /**
     * Handle mobile dropdown editor change
     */
    handleMobileEditorChange(newItemId) {
        this.log(`handleMobileEditorChange to: ${newItemId}`);

        const currentActiveItem = Object.keys(this.editorState).find(
            id => this.editorState[id].active
        );

        // If selecting the same item, do nothing
        if (newItemId === currentActiveItem) {
            return;
        }

        // Deactivate all editors
        Object.keys(this.editorState).forEach(itemId => {
            this.editorState[itemId].active = false;
        });

        // Activate selected editor
        this.editorState[newItemId].active = true;

        this.updateGrid();
        this.saveState();

        // Update option text to reflect current status icons
        const mobileSelect = document.getElementById('mobile-editor-select');
        if (mobileSelect) {
            this.updateToggleButtons();
        }
    }

    // ============================================================================
    // Monaco Editor Operations
    // ============================================================================

    /**
     * Create Monaco editor instance
     */
    createMonacoEditor(itemId, container) {
        const item = this.editorState[itemId];
        const monaco = this.context.Monaco.get();

        // Create editor immediately (may have 0 dimensions if overlay is hidden)
        const editor = monaco.editor.create(container, {
            value: item.content || '',
            language: this.config.monacoLanguage,
            theme: this.context.Config.get('editor.theme'),
            automaticLayout: false,
            minimap: { enabled: this.context.Config.get('editor.minimapEnabled') },
            fontSize: this.context.Config.get('editor.fontSize'),
            wordWrap: this.context.Config.get('editor.wordWrap'),
            scrollBeyondLastLine: this.context.Config.get('editor.scrollBeyondLastLine'),
            tabSize: this.context.Config.get('editor.tabSize')
        });

        this.monacoEditors[itemId] = editor;

        // Track changes
        editor.onDidChangeModelContent(() => {
            item.content = editor.getValue();
            item.isDirty = item.content !== this.originalContent[itemId];
            this.updateToggleButtons();

            // Call app-specific hook if defined (e.g., for CSS live preview)
            if (this.onEditorContentChange) {
                this.onEditorContentChange(itemId, editor);
            }
        });

        this.log(`Created Monaco editor for: ${itemId}`);
    }

    /**
     * Initialize editors (activate default if none active)
     */
    initializeEditors(skipDefault = false) {
        const hasActive = Object.values(this.editorState).some(item => item.active);

        // Only set default if we should not skip and nothing is active
        if (!skipDefault && !hasActive) {
            // Activate first item by default
            const firstItem = this.config.itemsConfig[0];
            this.editorState[firstItem.id].active = true;
            this.log(`No saved state, activating default: ${firstItem.id}`);
        } else {
            this.log(`Skipping default activation, skipDefault: ${skipDefault}, hasActive: ${hasActive}`);
        }

        this.updateGrid();
    }

    // ============================================================================
    // Import/Export Operations
    // ============================================================================

    /**
     * Export item content to file
     */
    exportItem(itemId) {
        const item = this.editorState[itemId];
        if (!item) return;

        try {
            const content = item.content || '';
            const blob = new Blob([content], { type: this.config.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.config.formFieldPrefix}${itemId}${this.config.fileExtension}`;
            a.click();
            URL.revokeObjectURL(url);

            this.context.UI.showToast(`Exported ${item.label}`, 'success');
        } catch (error) {
            this.context.UI.showToast(`Failed to export: ${error.message}`, 'error');
        }
    }

    /**
     * Import file into item (appends content)
     */
    importItem(itemId, file) {
        const item = this.editorState[itemId];
        if (!item) return;

        const expectedExt = this.config.fileExtension;

        // Validate file type
        if (!file.name.endsWith(expectedExt)) {
            this.context.UI.showToast(`Please select a ${this.config.editorType.toUpperCase()} file (${expectedExt})`, 'error');
            return;
        }

        // Validate file size (max 5MB)
        const maxSizeMB = this.context.Config.get('files.maxSizeMB');
        const maxSize = maxSizeMB * 1024 * 1024;
        if (file.size > maxSize) {
            this.context.UI.showToast(
                `File too large. Maximum size is ${maxSizeMB}MB (file is ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
                'error'
            );
            return;
        }

        // Check for empty files
        if (file.size === 0) {
            this.context.UI.showToast('Cannot import empty file', 'error');
            return;
        }

        // Show loading state
        this.context.LoadingOverlay.show(`Importing ${file.name}...`);

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const importedContent = e.target.result;

                // Create separator comment
                const commentStyle = this.config.commentStyle;
                let separator;
                if (commentStyle === '/* */') {
                    separator = `\n\n/* ========================================\n   Imported from: ${file.name}\n   Date: ${new Date().toLocaleString()}\n   ======================================== */\n`;
                } else {
                    separator = `\n\n<!-- ========================================\n     Imported from: ${file.name}\n     Date: ${new Date().toLocaleString()}\n     ======================================== -->\n`;
                }

                // Append content to existing
                const currentContent = item.content || '';
                const newContent = currentContent + separator + importedContent;

                // Update state
                item.content = newContent;
                item.isDirty = true;

                // Update Monaco editor using executeEdits for undo support
                if (this.monacoEditors[itemId]) {
                    const editor = this.monacoEditors[itemId];
                    const model = editor.getModel();
                    const lineCount = model.getLineCount();
                    const lastLineLength = model.getLineLength(lineCount);

                    const monaco = this.context.Monaco.get();
                    editor.executeEdits('import', [{
                        range: new monaco.Range(lineCount, lastLineLength + 1, lineCount, lastLineLength + 1),
                        text: separator + importedContent
                    }]);
                }

                // Save state and update UI
                this.saveState();
                this.updateToggleButtons();

                this.context.LoadingOverlay.hide();
                this.context.UI.showToast(
                    `Content from ${file.name} appended to ${item.label}`,
                    'success',
                    5000
                );
            } catch (error) {
                this.context.LoadingOverlay.hide();
                this.context.UI.showToast(`Failed to import: ${error.message}`, 'error');
            }
        };

        reader.onerror = () => {
            this.context.LoadingOverlay.hide();
            this.context.UI.showToast('Failed to read file', 'error');
        };

        reader.readAsText(file);
    }

    /**
     * Import file via drag & drop (with item selector)
     */
    async importFile(fileContent, fileName) {
        try {
            // Hide loading overlay before showing selector (waiting for user input)
            this.context.LoadingOverlay.hide();

            // Prepare item list for selector
            const items = Object.keys(this.editorState).map(itemId => ({
                id: itemId,
                label: this.editorState[itemId].label
            }));

            // Show item selector dialog
            const selectedItemId = await this.context.FileImport.showRoleSelector(
                items,
                this.config.editorType
            );

            if (!selectedItemId) {
                this.context.LoadingOverlay.hide();
                this.context.UI.showToast('Import cancelled', 'info');
                return;
            }

            const item = this.editorState[selectedItemId];
            if (!item) {
                this.context.LoadingOverlay.hide();
                this.context.UI.showToast(`Selected ${this.config.itemLabel} not found`, 'error');
                return;
            }

            // Ensure target editor is active and created before import
            // This is critical for preserving undo history when importing across apps
            if (!item.active) {
                item.active = true;
                this.updateGrid(); // Creates the Monaco editor
                // Give the editor time to fully initialize
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Create separator comment
            const commentStyle = this.config.commentStyle;
            let separator;
            if (commentStyle === '/* */') {
                separator = `\n\n/* ========================================\n   Imported from: ${fileName}\n   Date: ${new Date().toLocaleString()}\n   ======================================== */\n`;
            } else {
                separator = `\n\n<!-- ========================================\n     Imported from: ${fileName}\n     Date: ${new Date().toLocaleString()}\n     ======================================== -->\n`;
            }

            // Append content to existing
            const currentContent = item.content || '';
            const newContent = currentContent + separator + fileContent;

            // Update state
            item.content = newContent;
            item.isDirty = true;

            // Update Monaco editor using executeEdits for undo support
            if (this.monacoEditors[selectedItemId]) {
                const editor = this.monacoEditors[selectedItemId];
                const model = editor.getModel();
                const lineCount = model.getLineCount();
                const lastLineLength = model.getLineLength(lineCount);

                const monaco = this.context.Monaco.get();
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

            this.context.LoadingOverlay.hide();
            this.context.UI.showToast(
                `Content from ${fileName} appended to ${item.label}`,
                'success',
                5000
            );
        } catch (error) {
            this.context.LoadingOverlay.hide();
            this.context.UI.showToast(`Failed to import: ${error.message}`, 'error');
        }
    }

    // ============================================================================
    // Formatting Operations
    // ============================================================================

    /**
     * Format content for a specific item
     * @param {string} itemId - Item identifier
     * @param {boolean} silent - If true, suppress success toast
     * @returns {Object|null} - { changed: boolean, label: string } or null on error/empty
     */
    async formatItem(itemId, silent = false) {
        if (!this.context.Formatter.isReady()) {
            this.context.UI.showToast('Code formatting is currently unavailable', 'warning');
            return null;
        }

        const item = this.editorState[itemId];
        const editor = this.monacoEditors[itemId];

        if (!item || !editor) return null;

        try {
            console.log(`[${this.config.editorType.toUpperCase()} Editor] Formatting ${itemId}...`);

            // Get current content
            const content = editor.getValue();

            if (!content || content.trim() === '') {
                this.context.UI.showToast('Nothing to format', 'warning');
                return null;
            }

            // Format using Prettier with configured formatter method
            const formatted = await this.context.Formatter[this.config.formatterMethod](content);

            // Check if content actually changed
            const changed = content !== formatted;

            // Update editor with formatted content
            editor.setValue(formatted);

            // Mark as dirty if content changed
            item.content = formatted;
            item.isDirty = item.content !== this.originalContent[itemId];
            this.updateToggleButtons();

            if (!silent) {
                const message = changed ? `${item.label} formatted` : `${item.label} already formatted`;
                this.context.UI.showToast(message, 'success');
            }

            return { changed, label: item.label };
        } catch (error) {
            console.error(`[${this.config.editorType.toUpperCase()} Editor] Format ${itemId} failed:`, error);
            this.context.UI.showToast(`Formatting failed: ${error.message}`, 'error');
            return null;
        }
    }

    /**
     * Format all active editors
     */
    async formatAllActive() {
        if (!this.context.Formatter.isReady()) {
            this.context.UI.showToast('Code formatting is currently unavailable', 'warning');
            return;
        }

        const activeItems = Object.keys(this.editorState).filter(
            id => this.editorState[id].active
        );

        if (activeItems.length === 0) {
            this.context.UI.showToast('No editors open to format', 'warning');
            return;
        }

        try {
            console.log(`[${this.config.editorType.toUpperCase()} Editor] Formatting ${activeItems.length} active editor(s)...`);

            // Format each active editor (silent mode to avoid duplicate toasts)
            const results = [];
            for (const itemId of activeItems) {
                const result = await this.formatItem(itemId, true);
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

            this.context.UI.showToast(message, 'success');
        } catch (error) {
            console.error(`[${this.config.editorType.toUpperCase()} Editor] Format all active failed:`, error);
            this.context.UI.showToast(`Formatting failed: ${error.message}`, 'error');
        }
    }

    // ============================================================================
    // Revert & Discard Operations
    // ============================================================================

    /**
     * Discard all changes (revert to original) with inline confirmation
     */
    discardAll() {
        console.log(`[${this.config.editorType.toUpperCase()} Editor] discardAll called`);

        if (Object.keys(this.originalContent).length === 0) {
            this.context.UI.showToast('No original content to revert to', 'warning');
            return;
        }

        // Check if any editors have unsaved changes
        const hasUnsavedChanges = Object.values(this.editorState).some(item => item.isDirty);
        const discardBtn = document.getElementById('discard-btn');

        if (hasUnsavedChanges) {
            if (discardBtn && !discardBtn.classList.contains('confirming')) {
                console.log(`[${this.config.editorType.toUpperCase()} Editor] discardAll - Showing inline confirmation`);
                // Show inline confirmation
                this.context.UI.showInlineConfirmation(discardBtn, () => {
                    this.performDiscardAll();
                });
            }
            return;
        }

        // No unsaved changes - show "no changes" message
        if (discardBtn && !discardBtn.classList.contains('showing-no-changes')) {
            console.log(`[${this.config.editorType.toUpperCase()} Editor] discardAll - Showing no changes message`);
            this.context.UI.showNoChangesMessage(discardBtn);
        }
    }

    /**
     * Actually perform discard all (after confirmation)
     */
    performDiscardAll() {
        console.log(`[${this.config.editorType.toUpperCase()} Editor] performDiscardAll executing`);

        // Revert all state to original content
        Object.keys(this.editorState).forEach(itemId => {
            this.editorState[itemId].content = this.originalContent[itemId] || '';
            this.editorState[itemId].isDirty = false;

            // If editor is active, update its content
            const editor = this.monacoEditors[itemId];
            if (editor) {
                editor.setValue(this.editorState[itemId].content);
            }
        });

        this.updateToggleButtons();

        // Check if all editors are now clean - if so, clear app state
        const allClean = Object.values(this.editorState).every(s => !s.isDirty);
        if (allClean) {
            console.log(`[${this.config.editorType.toUpperCase()} Editor] All editors clean, clearing app state`);
            this.context.Storage.clearAppState(this.id);
        } else {
            this.saveState();
        }

        // Close dropdown menu
        const dropdownMenu = document.getElementById('save-dropdown-menu');
        if (dropdownMenu) dropdownMenu.classList.remove('show');
        const dropdown = document.querySelector('.save-dropdown');
        if (dropdown) dropdown.classList.remove('open');

        this.context.UI.showToast('All changes discarded', 'success');
    }

    /**
     * Revert a single item (with inline confirmation)
     * @param {string} itemId - Item identifier
     */
    revertItem(itemId) {
        console.log(`[${this.config.editorType.toUpperCase()} Editor] revertItem called for: ${itemId}`);

        const item = this.editorState[itemId];
        if (!item) return;

        // Check if editor has unsaved changes
        const revertBtn = document.querySelector(`[data-revert-${this.config.dataAttribute}="${itemId}"]`);
        if (!revertBtn) return;

        if (item.isDirty) {
            if (!revertBtn.classList.contains('confirming')) {
                // Show inline confirmation
                this.context.UI.showInlineConfirmation(revertBtn, () => {
                    this.performRevert(itemId);
                });
            }
            return;
        }

        // No unsaved changes - show "no changes" message
        if (!revertBtn.classList.contains('showing-no-changes')) {
            this.context.UI.showNoChangesMessage(revertBtn);
        }
    }

    /**
     * Actually perform revert (after confirmation)
     * @param {string} itemId - Item identifier
     */
    performRevert(itemId) {
        console.log(`[${this.config.editorType.toUpperCase()} Editor] performRevert executing for: ${itemId}`);

        const item = this.editorState[itemId];
        if (!item) return;

        // Revert content to original
        item.content = this.originalContent[itemId] || '';
        item.isDirty = false;

        // If editor is active, update its content
        const editor = this.monacoEditors[itemId];
        if (editor) {
            editor.setValue(item.content);
        }

        this.updateToggleButtons();

        // Check if all editors are now clean - if so, clear app state
        const allClean = Object.values(this.editorState).every(s => !s.isDirty);
        if (allClean) {
            console.log(`[${this.config.editorType.toUpperCase()} Editor] All editors clean, clearing app state`);
            this.context.Storage.clearAppState(this.id);
        } else {
            this.saveState();
        }

        // Close dropdown menu
        const menu = document.querySelector(`[data-menu-${this.config.dataAttribute}="${itemId}"]`);
        if (menu) menu.classList.remove('show');

        this.context.UI.showToast(`${item.label} reverted`, 'success');
    }

    // ============================================================================
    // Grid & Layout Utilities
    // ============================================================================

    /**
     * Update editors grid
     */
    updateGrid() {
        const grid = document.getElementById('editors-grid');
        if (!grid) return;

        const activeItems = Object.keys(this.editorState).filter(
            id => this.editorState[id].active
        );

        grid.innerHTML = '';
        grid.className = 'editors-grid cols-' + activeItems.length;

        activeItems.forEach(itemId => {
            // Note: createEditorPane() will be extracted in Phase 9
            // For now, it must be implemented by the child class
            const pane = this.createEditorPane(itemId);
            grid.appendChild(pane);
        });

        // Calculate and set explicit heights
        setTimeout(() => {
            this.updateHeights();
        }, 50);
    }

    /**
     * Calculate and set explicit pixel heights for editors
     */
    updateHeights() {
        const containerId = `${this.config.editorType}-editor-container`;
        const container = document.getElementById(containerId);
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
        Object.values(this.monacoEditors).forEach(editor => {
            if (editor) {
                editor.layout();
            }
        });
    }

    /**
     * Update toggle button states and pane status indicators
     */
    updateToggleButtons() {
        const dataAttr = this.config.dataAttribute;

        // Update desktop buttons (if they exist)
        const buttons = document.querySelectorAll('.toggle-btn');

        buttons.forEach(btn => {
            const itemId = btn.getAttribute(`data-${dataAttr}`);
            const item = this.editorState[itemId];

            if (item && item.active) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }

            // Show dirty indicator
            if (item && item.isDirty) {
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
            const options = mobileSelect.querySelectorAll(`option[data-${dataAttr}]`);
            options.forEach(option => {
                const itemId = option.getAttribute(`data-${dataAttr}`);
                if (itemId && this.editorState[itemId]) {
                    const item = this.editorState[itemId];
                    const statusIcon = item.isDirty ? '● ' : '✓ ';
                    option.textContent = statusIcon + item.label;
                }
            });

            // Set selected value to active item
            const activeItem = Object.keys(this.editorState).find(
                id => this.editorState[id].active
            );
            if (activeItem) {
                mobileSelect.value = activeItem;
            }
        }

        // Update editor pane status indicators
        Object.keys(this.editorState).forEach(itemId => {
            const status = document.getElementById(`status-${itemId}`);
            if (status) {
                const item = this.editorState[itemId];
                status.textContent = item.isDirty ? '●' : '✓';
                status.style.color = item.isDirty ? '#ff9800' : '#4caf50';
            }
        });
    }

    /**
     * Toggle editor for an item
     * Left click: Open only this editor (close others)
     * Shift+click: Toggle this editor alongside others
     */
    toggleEditor(itemId, event) {
        const item = this.editorState[itemId];
        if (!item) return;

        const activeCount = Object.values(this.editorState).filter(i => i.active).length;
        const isShiftClick = event && event.shiftKey;

        if (isShiftClick) {
            // Shift+click: Toggle this editor while keeping others
            if (item.active) {
                item.active = false;
            } else {
                const maxEditors = this.context.Config.get('editor.maxActiveTabs');
                if (activeCount >= maxEditors) {
                    this.context.UI.showToast(`Maximum ${maxEditors} editors can be open at once`, 'warning');
                    return;
                }
                item.active = true;
            }
        } else {
            // Regular click: Open only this editor
            if (item.active && activeCount === 1) {
                // Don't close if it's the only one open
                return;
            }

            // Close all others
            Object.keys(this.editorState).forEach(id => {
                this.editorState[id].active = false;
            });

            // Open this one
            item.active = true;
        }

        this.updateGrid();
        this.updateToggleButtons();
        this.saveState();
    }

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
            saveBtn.addEventListener('click', () => {
                if (this.onSaveAll) {
                    this.onSaveAll();
                }
            });
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

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            // Close global dropdown
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
    }

    /**
     * Toggle editor dropdown menu (save/revert dropdown within an editor pane)
     */
    toggleEditorDropdown(itemId) {
        const dataAttr = this.config.dataAttribute;
        const menu = document.querySelector(`[data-menu-${dataAttr}="${itemId}"]`);
        if (!menu) return;

        // Close all other editor dropdowns AND the global dropdown
        document.querySelectorAll('.editor-save-dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });
        const globalDropdown = document.getElementById('save-dropdown-menu');
        if (globalDropdown) globalDropdown.classList.remove('show');

        menu.classList.toggle('show');
    }

    /**
     * Toggle actions dropdown menu (format/import/export dropdown)
     */
    toggleActionsDropdown(itemId) {
        const dataAttr = this.config.dataAttribute;
        const menu = document.querySelector(`[data-actions-menu-${dataAttr}="${itemId}"]`);
        if (!menu) return;

        // Close all other actions dropdowns
        document.querySelectorAll('.editor-actions-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });

        menu.classList.toggle('show');
    }

    /**
     * Setup keyboard shortcuts for save and format operations
     */
    setupKeyboardShortcuts() {
        this.keyboardHandler = (e) => {
            // Ctrl+S or Cmd+S - Save open tabs
            if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
                e.preventDefault();
                if (this.onSaveOpenTabs) {
                    this.onSaveOpenTabs();
                }
            }
            // Ctrl+Shift+S or Cmd+Shift+S - Save all
            else if ((e.ctrlKey || e.metaKey) && e.key === 'S' && e.shiftKey) {
                e.preventDefault();
                if (this.onSaveAll) {
                    this.onSaveAll();
                }
            }
            // Ctrl+Shift+F or Cmd+Shift+F - Format active editors (only if available)
            else if ((e.ctrlKey || e.metaKey) && e.key === 'F' && e.shiftKey) {
                e.preventDefault();
                if (this.context.Formatter.isReady() && this.onFormatAllActive) {
                    this.onFormatAllActive();
                }
                // Silent no-op if formatter not available
            }
        };

        document.addEventListener('keydown', this.keyboardHandler);
        const editorTypeUpper = this.config.editorType.toUpperCase();
        console.log(`[${editorTypeUpper} Editor] Keyboard shortcuts registered: Ctrl+S (save open), Ctrl+Shift+S (save all), Ctrl+Shift+F (format)`);
    }

    /**
     * Build toggle bar with item buttons (desktop) or dropdown (mobile)
     * Never rebuilds the save dropdown - only toggle buttons or mobile selector
     */
    buildToggleBar() {
        const toggleBar = document.getElementById('toggle-bar');
        if (!toggleBar) return;

        const dataAttr = this.config.dataAttribute;
        const itemsConfig = this.config.itemsConfig;

        // Clear existing buttons/selectors (but keep save dropdown)
        const existingButtons = toggleBar.querySelectorAll('.toggle-btn, .mobile-selector-wrapper');
        existingButtons.forEach(el => el.remove());

        if (this.isMobileView) {
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

            // Add options for each item with status icons
            itemsConfig.forEach(({ id, label: itemLabel }) => {
                const item = this.editorState[id];
                const option = document.createElement('option');
                option.value = id;
                const statusIcon = item.isDirty ? '● ' : '✓ ';
                option.textContent = statusIcon + itemLabel;
                option.setAttribute(`data-${dataAttr}`, id);
                select.appendChild(option);
            });

            // Set current selection - respect already active editor
            let activeItem = Object.keys(this.editorState).find(id => this.editorState[id].active);

            // Only activate first editor if truly no active editors exist
            if (!activeItem) {
                const firstItem = itemsConfig[0].id;
                this.editorState[firstItem].active = true;
                activeItem = firstItem;
                const editorTypeUpper = this.config.editorType.toUpperCase();
                console.log(`[${editorTypeUpper} Editor] No active editor found, activating first: ${activeItem}`);
                // Need to render the editor
                setTimeout(() => {
                    this.updateGrid();
                    this.saveState();
                }, 0);
            }

            select.value = activeItem;

            // Add change listener
            select.addEventListener('change', (e) => this.handleMobileEditorChange(e.target.value));

            wrapper.appendChild(label);
            wrapper.appendChild(select);

            // Insert at the beginning of toggle bar (before save dropdown)
            const firstChild = toggleBar.firstChild;
            toggleBar.insertBefore(wrapper, firstChild);
        } else {
            // Create desktop toggle buttons
            itemsConfig.forEach(({ id, label }) => {
                const btn = document.createElement('button');
                btn.className = 'toggle-btn';
                btn.setAttribute(`data-${dataAttr}`, id);
                btn.textContent = label;
                btn.addEventListener('click', (e) => this.toggleEditor(id, e));

                // Insert before the save dropdown
                const saveDropdown = toggleBar.querySelector('.save-dropdown');
                toggleBar.insertBefore(btn, saveDropdown);
            });
        }

        this.updateToggleButtons();
    }

    /**
     * Create editor pane for an item with header, save dropdown, actions menu, and Monaco editor
     */
    createEditorPane(itemId) {
        const item = this.editorState[itemId];
        const dataAttr = this.config.dataAttribute;

        const pane = this.context.DOM.create('div', { className: 'editor-pane' });
        const header = this.context.DOM.create('div', { className: 'editor-pane-header' });

        // Left side: Title + Status only
        const headerLeft = this.context.DOM.create('div', {
            className: 'header-left',
            style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }
        });

        const titleGroup = this.context.DOM.create('div', {
            style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }
        });
        const title = this.context.DOM.create('span', {}, [item.label]);
        const status = this.context.DOM.create('span', {
            className: 'editor-status',
            id: `status-${itemId}`,
            style: { fontSize: '0.9rem' }
        }, [item.isDirty ? '●' : '✓']);

        titleGroup.appendChild(status);
        titleGroup.appendChild(title);
        headerLeft.appendChild(titleGroup);

        // Right side: Save dropdown + Actions dropdown
        const headerRight = this.context.DOM.create('div', {
            className: 'header-right',
            style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }
        });

        // Save dropdown group
        const saveDropdown = this.context.DOM.create('div', {
            className: 'editor-save-dropdown'
        });

        const saveBtn = this.context.DOM.create('button', {
            className: 'editor-pane-save',
            [`data-save-${dataAttr}`]: itemId
        }, ['Save']);
        saveBtn.addEventListener('click', () => {
            if (this.onSaveItem) {
                this.onSaveItem(itemId);
            }
        });

        const dropdownToggle = this.context.DOM.create('button', {
            className: 'editor-save-dropdown-toggle',
            [`data-dropdown-${dataAttr}`]: itemId
        }, ['▼']);
        dropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleEditorDropdown(itemId);
        });

        const dropdownMenu = this.context.DOM.create('div', {
            className: 'editor-save-dropdown-menu',
            [`data-menu-${dataAttr}`]: itemId
        });

        const revertBtn = this.context.DOM.create('button', {
            className: 'editor-dropdown-item',
            [`data-revert-${dataAttr}`]: itemId
        }, ['Revert this']);
        revertBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.revertItem(itemId);
        });

        dropdownMenu.appendChild(revertBtn);
        saveDropdown.appendChild(saveBtn);
        saveDropdown.appendChild(dropdownToggle);
        saveDropdown.appendChild(dropdownMenu);

        // Actions dropdown
        const actionsDropdown = this.context.DOM.create('div', {
            className: 'editor-actions-dropdown',
            style: { position: 'relative' }
        });

        const actionsBtn = this.context.DOM.create('button', {
            className: 'editor-actions-btn',
            [`data-actions-${dataAttr}`]: itemId
        }, ['Actions ▼']);
        actionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleActionsDropdown(itemId);
        });

        const actionsMenu = this.context.DOM.create('div', {
            className: 'editor-actions-menu',
            [`data-actions-menu-${dataAttr}`]: itemId
        });

        // Format option (only if Prettier available)
        if (this.context.Formatter.isReady()) {
            const formatOption = this.context.DOM.create('button', {
                className: 'editor-actions-item',
                [`data-format-${dataAttr}`]: itemId
            }, ['Format']);
            formatOption.addEventListener('click', (e) => {
                e.stopPropagation();
                this.formatItem(itemId);
                this.toggleActionsDropdown(itemId); // Close menu
            });
            actionsMenu.appendChild(formatOption);
        }

        // Import option with hidden file input
        const fileInput = this.context.DOM.create('input', {
            type: 'file',
            accept: this.config.fileExtension,
            style: 'display: none;',
            id: `file-input-${itemId}`
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.importItem(itemId, e.target.files[0]);
                e.target.value = ''; // Reset input to allow re-importing same file
            }
        });

        const importOption = this.context.DOM.create('button', {
            className: 'editor-actions-item',
            [`data-import-${dataAttr}`]: itemId
        }, ['Import']);
        importOption.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
            this.toggleActionsDropdown(itemId); // Close menu
        });

        // Export option
        const exportOption = this.context.DOM.create('button', {
            className: 'editor-actions-item',
            [`data-export-${dataAttr}`]: itemId
        }, ['Export']);
        exportOption.addEventListener('click', (e) => {
            e.stopPropagation();
            this.exportItem(itemId);
            this.toggleActionsDropdown(itemId); // Close menu
        });

        actionsMenu.appendChild(importOption);
        actionsMenu.appendChild(exportOption);
        actionsDropdown.appendChild(actionsBtn);
        actionsDropdown.appendChild(actionsMenu);

        // Add both dropdowns to right side
        headerRight.appendChild(saveDropdown);
        headerRight.appendChild(actionsDropdown);

        // Assemble header
        header.appendChild(headerLeft);
        header.appendChild(headerRight);
        pane.appendChild(header);
        pane.appendChild(fileInput);

        const editorContainer = this.context.DOM.create('div', {
            className: 'editor-instance',
            id: `editor-${itemId}`
        });
        pane.appendChild(editorContainer);

        // Create Monaco editor
        if (this.context.Monaco.isReady()) {
            this.createMonacoEditor(itemId, editorContainer);
        }

        return pane;
    }
}
