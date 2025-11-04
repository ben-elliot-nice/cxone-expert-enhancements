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
}
