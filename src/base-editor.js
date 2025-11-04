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

        // Hook for app-specific behavior (e.g., CSS live preview)
        this.onEditorContentChange = null;
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
}
