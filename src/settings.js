/**
 * CXone Expert Enhancements - Settings App
 *
 * Comprehensive configuration UI with hierarchical settings management.
 * Shows user-configurable settings with visual indicators for embed overrides.
 *
 * @version 2.0.0
 */

// ES Module - import dependencies from core
import { AppManager } from './core.js';

console.log('[Settings App] Loading...');

// ============================================================================
// State & Configuration
// ============================================================================

let context = null;
let config = null;

// Track which sections are expanded
const sectionState = {
    behavior: true,  // Expanded by default
    editor: true,
    files: false,
    overlay: false,
    performance: false,
    appearance: false,
    advanced: false
};

// ============================================================================
// App Interface Implementation
// ============================================================================

const SettingsApp = {
    id: 'settings',
    name: 'Settings',

    // App-specific constraints for overlay sizing
    constraints: {
        minWidth: 500,
        minHeight: 400
    },

    /**
     * Initialize the app with context
     */
    async init(ctx) {
        console.log('[Settings] Initializing...');
        context = ctx;
        config = ctx.Config;

        // Load section state from localStorage
        loadSectionState();

        console.log('[Settings] Initialized');
    },

    /**
     * Mount the app into the container
     */
    async mount(container) {
        console.log('[Settings] Mounting...');

        // Build UI
        container.innerHTML = `
            <div class="enhancements-app-container">
                <div class="settings-container">
                    <h2 class="settings-heading">Settings & Configuration</h2>
                    <p class="settings-intro">
                        Configure behavior, appearance, and performance.
                        ${Object.keys(config.flattenObject(config.embedConfig)).length > 0
                            ? '<span class="lock-indicator">🔒</span> Locked settings are controlled by embed configuration.'
                            : ''}
                    </p>
                    <div id="settings-sections">
                        <!-- Sections will be inserted here -->
                    </div>
                    <div class="settings-footer">
                        <button class="btn btn-secondary" id="reset-all-btn">Reset All to Defaults</button>
                        <button class="btn btn-primary" id="export-config-btn">Export Config</button>
                    </div>
                </div>
            </div>
        `;

        // Inject styles
        this.injectStyles();

        // Build all sections
        const sectionsContainer = container.querySelector('#settings-sections');
        sectionsContainer.appendChild(createBehaviorSection());
        sectionsContainer.appendChild(createEditorSection());
        sectionsContainer.appendChild(createFilesSection());
        sectionsContainer.appendChild(createOverlaySection());
        sectionsContainer.appendChild(createPerformanceSection());
        sectionsContainer.appendChild(createAppearanceSection());
        sectionsContainer.appendChild(createAdvancedSection());

        // Attach global event listeners
        attachGlobalListeners();

        console.log('[Settings] Mounted');
    },

    /**
     * Unmount the app (cleanup)
     */
    async unmount() {
        console.log('[Settings] Unmounting...');
        saveSectionState();
        console.log('[Settings] Unmounted');
    },

    /**
     * Get current state for persistence
     */
    getState() {
        return {
            lastViewed: Date.now(),
            sectionState
        };
    },

    /**
     * Restore state
     */
    setState(state) {
        if (state && state.sectionState) {
            Object.assign(sectionState, state.sectionState);
        }
    },

    /**
     * Inject custom styles for settings UI
     */
    injectStyles() {
        if (document.getElementById('settings-app-styles-v2')) return;

        const style = document.createElement('style');
        style.id = 'settings-app-styles-v2';
        style.textContent = `
            .enhancements-app-container {
                overflow-y: auto;
                height: 100%;
            }

            .settings-container {
                padding: 2rem;
                max-width: 900px;
                margin: 0 auto;
                color: #e9ecef;
            }

            .settings-heading {
                font-size: 1.75rem;
                font-weight: 600;
                margin: 0 0 1rem 0;
                color: #fff;
            }

            .settings-intro {
                font-size: 0.95rem;
                color: #adb5bd;
                margin: 0 0 2rem 0;
                line-height: 1.5;
            }

            .lock-indicator {
                display: inline-block;
                margin-right: 0.25rem;
            }

            /* Collapsible Section */
            .settings-section {
                margin-bottom: 1rem;
                border: 1px solid #444;
                border-radius: 6px;
                background: #2525;
                overflow: hidden;
            }

            .section-header {
                display: flex;
                align-items: center;
                padding: 1rem 1.25rem;
                cursor: pointer;
                background: #2d2d30;
                border-bottom: 1px solid #444;
                transition: background 0.2s;
                user-select: none;
            }

            .section-header:hover {
                background: #353538;
            }

            .section-icon {
                font-size: 1.25rem;
                margin-right: 0.75rem;
            }

            .section-title {
                flex: 1;
                font-size: 1.1rem;
                font-weight: 500;
                color: #fff;
                margin: 0;
            }

            .section-chevron {
                font-size: 1rem;
                transition: transform 0.2s;
                color: #adb5bd;
            }

            .section-header.expanded .section-chevron {
                transform: rotate(90deg);
            }

            .section-body {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease-out;
            }

            .section-body.expanded {
                max-height: 2000px;
                transition: max-height 0.3s ease-in;
            }

            .section-content {
                padding: 1.5rem 1.25rem;
            }

            /* Setting Option - Compact Design */
            .setting-option {
                display: grid;
                grid-template-columns: minmax(180px, auto) 1fr auto;
                grid-template-rows: auto auto;
                gap: 0.5rem 1rem;
                align-items: center;
                margin-bottom: 0.85rem;
                padding: 0.6rem 0;
                border-bottom: 1px solid #2a2a2a;
                transition: opacity 0.2s;
            }

            .setting-option:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }

            /* Grey out locked settings */
            .setting-option:has(input:disabled),
            .setting-option:has(select:disabled) {
                opacity: 0.45;
                pointer-events: none;
            }

            /* Grid layout: [header] [control] [status] */
            .setting-header {
                grid-column: 1;
                grid-row: 1;
                display: flex;
                align-items: center;
                gap: 0.4rem;
            }

            .setting-control {
                grid-column: 2;
                grid-row: 1;
                display: flex;
                align-items: center;
            }

            .setting-status {
                grid-column: 3;
                grid-row: 1;
                display: flex;
                align-items: center;
                justify-content: flex-end;
            }

            .setting-description {
                grid-column: 2 / 4;
                grid-row: 2;
                font-size: 0.8rem;
                color: #888;
                line-height: 1.3;
                margin-top: -0.2rem;
            }

            .setting-label {
                font-weight: 500;
                color: #e9ecef;
                font-size: 0.9rem;
            }

            /* Inline lock badge */
            .status-badge {
                font-size: 0.75rem;
                padding: 0.1rem 0.35rem;
                border-radius: 3px;
                font-weight: 500;
                line-height: 1;
            }

            .status-locked {
                background: rgba(255, 152, 0, 0.15);
                color: #ff9800;
                border: 1px solid rgba(255, 152, 0, 0.25);
            }

            .status-modified {
                background: rgba(59, 130, 246, 0.15);
                color: #3b82f6;
                border: 1px solid rgba(59, 130, 246, 0.25);
            }

            .reset-button {
                background: none;
                border: 1px solid #444;
                color: #adb5bd;
                padding: 0.2rem 0.5rem;
                border-radius: 3px;
                font-size: 0.75rem;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }

            .reset-button:hover {
                background: #3a3a3a;
                color: #e9ecef;
                border-color: #555;
            }

            .setting-control > * {
                margin: 0 !important;
            }

            /* Input Controls */
            input[type="checkbox"] {
                width: 18px;
                height: 18px;
                cursor: pointer;
                margin-right: 0.5rem;
            }

            input[type="number"],
            input[type="text"],
            select {
                width: 100%;
                max-width: 300px;
                padding: 0.5rem;
                background: #2d2d30;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e9ecef;
                font-size: 0.95rem;
            }

            input[type="number"]:focus,
            input[type="text"]:focus,
            select:focus {
                outline: none;
                border-color: #0d6efd;
            }

            input[type="number"]:disabled,
            input[type="text"]:disabled,
            select:disabled,
            input[type="checkbox"]:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .radio-group {
                display: flex;
                gap: 1.5rem;
                margin: 0.5rem 0;
            }

            .radio-option {
                display: flex;
                align-items: center;
            }

            .radio-option input[type="radio"] {
                margin-right: 0.5rem;
                cursor: pointer;
            }

            .radio-option input[type="radio"]:disabled {
                cursor: not-allowed;
            }

            /* Buttons */
            .btn {
                padding: 0.5rem 1.25rem;
                border-radius: 4px;
                font-size: 0.95rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                border: none;
            }

            .btn-primary {
                background: #0d6efd;
                color: white;
            }

            .btn-primary:hover {
                background: #0b5ed7;
            }

            .btn-secondary {
                background: transparent;
                color: #e9ecef;
                border: 1px solid #555;
            }

            .btn-secondary:hover {
                background: #3a3a3a;
            }

            .settings-footer {
                display: flex;
                gap: 1rem;
                margin-top: 2rem;
                padding-top: 2rem;
                border-top: 1px solid #444;
            }

            /* Color Picker */
            input[type="color"] {
                width: 60px;
                height: 36px;
                border: 1px solid #444;
                border-radius: 4px;
                cursor: pointer;
                background: #2d2d30;
            }

            .color-input-group {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .color-text {
                font-family: monospace;
                font-size: 0.9rem;
                color: #adb5bd;
            }

            /* Debug Section Styling */
            .section-debug {
                opacity: 0.8;
            }

            .section-debug .section-header {
                background: #2a2a2d;
            }
        `;
        document.head.appendChild(style);
    }
};

// ============================================================================
// Section Builders
// ============================================================================

/**
 * Create collapsible section
 */
function createSection(id, icon, title, content, isDebug = false) {
    const section = document.createElement('div');
    section.className = `settings-section${isDebug ? ' section-debug' : ''}`;
    section.dataset.sectionId = id;

    const isExpanded = sectionState[id];

    section.innerHTML = `
        <div class="section-header ${isExpanded ? 'expanded' : ''}" data-section="${id}">
            <span class="section-icon">${icon}</span>
            <h3 class="section-title">${title}</h3>
            <span class="section-chevron">▶</span>
        </div>
        <div class="section-body ${isExpanded ? 'expanded' : ''}">
            <div class="section-content" id="section-${id}">
                ${content}
            </div>
        </div>
    `;

    // Add click handler for toggle
    const header = section.querySelector('.section-header');
    header.addEventListener('click', () => toggleSection(id));

    return section;
}

/**
 * Create setting option element
 */
function createSetting(path, label, controlHtml, description = '') {
    const source = config.getSource(path);
    const isLocked = source === 'embed';
    const isModified = source === 'user';
    const defaultValue = config.getDefault(path);
    const currentValue = config.get(path);

    const option = document.createElement('div');
    option.className = 'setting-option';
    option.dataset.path = path;

    let statusBadge = '';
    if (isLocked) {
        statusBadge = '<span class="status-badge status-locked" title="This setting is locked because it has been set in the embed configuration (data-config attribute)">🔒</span>';
    } else if (isModified) {
        statusBadge = '<span class="status-badge status-modified" title="Modified from default">Modified</span>';
    }

    let resetButton = '';
    if (isModified && !isLocked) {
        resetButton = `<button class="reset-button" data-reset="${path}" title="Reset to default">Reset</button>`;
    }

    option.innerHTML = `
        <div class="setting-header">
            <label class="setting-label">${label}</label>
            ${statusBadge}
        </div>
        <div class="setting-control">
            ${controlHtml}
        </div>
        ${resetButton ? `<div class="setting-status">${resetButton}</div>` : ''}
        ${description ? `<div class="setting-description" title="${description}">${description}</div>` : ''}
    `;

    // Disable controls if locked
    if (isLocked) {
        const inputs = option.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.disabled = true;
            input.title = 'This setting is controlled by embed configuration';
        });
    }

    return option;
}

/**
 * Behavior Section
 */
function createBehaviorSection() {
    const formatOnSave = config.get('behavior.formatOnSave');
    const autoSaveEnabled = config.get('behavior.autoSaveEnabled');
    const confirmBeforeDiscard = config.get('behavior.confirmBeforeDiscard');

    const content = document.createElement('div');

    content.appendChild(createSetting(
        'behavior.formatOnSave',
        'Format on Save',
        `<label style="display: flex; align-items: center;">
            <input type="checkbox" id="format-on-save" ${formatOnSave ? 'checked' : ''}>
            <span>Automatically format code when clicking Save</span>
        </label>`,
        'Formats code using Prettier before saving changes.'
    ));

    content.appendChild(createSetting(
        'behavior.confirmBeforeDiscard',
        'Confirm Before Discard',
        `<label style="display: flex; align-items: center;">
            <input type="checkbox" id="confirm-before-discard" ${confirmBeforeDiscard ? 'checked' : ''}>
            <span>Ask for confirmation before discarding unsaved changes</span>
        </label>`,
        'Shows a confirmation dialog when discarding unsaved changes.'
    ));

    const section = createSection('behavior', '⚙️', 'Editor Behavior', '');
    const sectionContent = section.querySelector('.section-content');
    sectionContent.innerHTML = '';
    sectionContent.appendChild(content);

    // Attach event listeners
    const formatOnSaveCheckbox = content.querySelector('#format-on-save');
    if (formatOnSaveCheckbox && !formatOnSaveCheckbox.disabled) {
        formatOnSaveCheckbox.addEventListener('change', (e) => {
            config.setUserSetting('behavior.formatOnSave', e.target.checked);
            context.UI.showToast('Setting saved', 'success', 2000);
        });
    }

    const confirmCheckbox = content.querySelector('#confirm-before-discard');
    if (confirmCheckbox && !confirmCheckbox.disabled) {
        confirmCheckbox.addEventListener('change', (e) => {
            config.setUserSetting('behavior.confirmBeforeDiscard', e.target.checked);
            context.UI.showToast('Setting saved', 'success', 2000);
        });
    }

    return section;
}

/**
 * Editor Section
 */
function createEditorSection() {
    const theme = config.get('editor.theme');
    const fontSize = config.get('editor.fontSize');
    const tabSize = config.get('editor.tabSize');
    const indentStyle = config.get('editor.indentStyle');
    const quoteStyle = config.get('editor.quoteStyle');
    const minimapEnabled = config.get('editor.minimapEnabled');
    const wordWrap = config.get('editor.wordWrap');

    const content = document.createElement('div');

    content.appendChild(createSetting(
        'editor.theme',
        'Editor Theme',
        `<select id="editor-theme">
            <option value="vs-dark" ${theme === 'vs-dark' ? 'selected' : ''}>Dark</option>
            <option value="vs-light" ${theme === 'vs-light' ? 'selected' : ''}>Light</option>
        </select>`,
        'Color scheme for the Monaco editor.'
    ));

    content.appendChild(createSetting(
        'editor.fontSize',
        'Font Size',
        `<input type="number" id="editor-fontsize" value="${fontSize}" min="10" max="24" step="1">`,
        'Font size in pixels (10-24).'
    ));

    content.appendChild(createSetting(
        'editor.tabSize',
        'Tab Size',
        `<select id="editor-tabsize">
            <option value="2" ${tabSize === 2 ? 'selected' : ''}>2 spaces</option>
            <option value="4" ${tabSize === 4 ? 'selected' : ''}>4 spaces</option>
            <option value="8" ${tabSize === 8 ? 'selected' : ''}>8 spaces</option>
        </select>`,
        'Number of spaces per tab/indentation level.'
    ));

    content.appendChild(createSetting(
        'editor.indentStyle',
        'Indentation Style',
        `<div class="radio-group">
            <label class="radio-option">
                <input type="radio" name="indent-style" value="spaces" ${indentStyle === 'spaces' ? 'checked' : ''}>
                <span>Spaces</span>
            </label>
            <label class="radio-option">
                <input type="radio" name="indent-style" value="tabs" ${indentStyle === 'tabs' ? 'checked' : ''}>
                <span>Tabs</span>
            </label>
        </div>`,
        'Whether to use spaces or tabs for indentation.'
    ));

    content.appendChild(createSetting(
        'editor.quoteStyle',
        'Quote Style',
        `<div class="radio-group">
            <label class="radio-option">
                <input type="radio" name="quote-style" value="single" ${quoteStyle === 'single' ? 'checked' : ''}>
                <span>Single quotes (')</span>
            </label>
            <label class="radio-option">
                <input type="radio" name="quote-style" value="double" ${quoteStyle === 'double' ? 'checked' : ''}>
                <span>Double quotes (")</span>
            </label>
        </div>`,
        'Preferred quote style for strings.'
    ));

    content.appendChild(createSetting(
        'editor.minimapEnabled',
        'Show Minimap',
        `<label style="display: flex; align-items: center;">
            <input type="checkbox" id="editor-minimap" ${minimapEnabled ? 'checked' : ''}>
            <span>Show code minimap in editor</span>
        </label>`,
        'Displays a code overview/minimap on the right side of the editor.'
    ));

    content.appendChild(createSetting(
        'editor.wordWrap',
        'Word Wrap',
        `<select id="editor-wordwrap">
            <option value="on" ${wordWrap === 'on' ? 'selected' : ''}>On</option>
            <option value="off" ${wordWrap === 'off' ? 'selected' : ''}>Off</option>
            <option value="bounded" ${wordWrap === 'bounded' ? 'selected' : ''}>Bounded</option>
        </select>`,
        'How to wrap long lines in the editor.'
    ));

    const maxActiveTabs = config.get('editor.maxActiveTabs');
    content.appendChild(createSetting(
        'editor.maxActiveTabs',
        'Maximum Active Tabs',
        `<input type="number" id="editor-max-tabs" value="${maxActiveTabs}" min="1" max="10" step="1">`,
        'Maximum number of editor tabs that can be open simultaneously (1-10).'
    ));

    const section = createSection('editor', '✏️', 'Editor Appearance', '');
    const sectionContent = section.querySelector('.section-content');
    sectionContent.innerHTML = '';
    sectionContent.appendChild(content);

    // Attach event listeners
    attachInputListener(content, '#editor-theme', 'change', 'editor.theme', (e) => e.target.value);
    attachInputListener(content, '#editor-fontsize', 'input', 'editor.fontSize', (e) => parseInt(e.target.value, 10));
    attachInputListener(content, '#editor-tabsize', 'change', 'editor.tabSize', (e) => parseInt(e.target.value, 10));
    attachInputListener(content, 'input[name="indent-style"]', 'change', 'editor.indentStyle', (e) => e.target.value);
    attachInputListener(content, 'input[name="quote-style"]', 'change', 'editor.quoteStyle', (e) => e.target.value);
    attachInputListener(content, '#editor-minimap', 'change', 'editor.minimapEnabled', (e) => e.target.checked);
    attachInputListener(content, '#editor-wordwrap', 'change', 'editor.wordWrap', (e) => e.target.value);
    attachInputListener(content, '#editor-max-tabs', 'input', 'editor.maxActiveTabs', (e) => parseInt(e.target.value, 10));

    return section;
}

/**
 * Files Section
 */
function createFilesSection() {
    const maxSizeMB = config.get('files.maxSizeMB');

    const content = document.createElement('div');

    content.appendChild(createSetting(
        'files.maxSizeMB',
        'Maximum File Size',
        `<input type="number" id="files-maxsize" value="${maxSizeMB}" min="1" max="50" step="1"> MB`,
        'Maximum allowed file size for imports (1-50 MB).'
    ));

    const section = createSection('files', '📂', 'File Operations', '');
    const sectionContent = section.querySelector('.section-content');
    sectionContent.innerHTML = '';
    sectionContent.appendChild(content);

    attachInputListener(content, '#files-maxsize', 'input', 'files.maxSizeMB', (e) => parseInt(e.target.value, 10));

    return section;
}

/**
 * Overlay Section
 */
function createOverlaySection() {
    const defaultWidth = config.get('overlay.defaultWidth');
    const defaultHeight = config.get('overlay.defaultHeight');
    const rememberPosition = config.get('overlay.rememberPosition');
    const rememberSize = config.get('overlay.rememberSize');

    const content = document.createElement('div');

    content.appendChild(createSetting(
        'overlay.defaultWidth',
        'Default Width',
        `<input type="number" id="overlay-width" value="${defaultWidth}" min="800" max="3000" step="100"> px`,
        'Default width when opening the overlay (800-3000 px).'
    ));

    content.appendChild(createSetting(
        'overlay.defaultHeight',
        'Default Height',
        `<input type="number" id="overlay-height" value="${defaultHeight}" min="400" max="2000" step="50"> px`,
        'Default height when opening the overlay (400-2000 px).'
    ));

    content.appendChild(createSetting(
        'overlay.rememberPosition',
        'Remember Position',
        `<label style="display: flex; align-items: center;">
            <input type="checkbox" id="overlay-remember-pos" ${rememberPosition ? 'checked' : ''}>
            <span>Remember overlay position across sessions</span>
        </label>`,
        'Saves the overlay position when you close it.'
    ));

    content.appendChild(createSetting(
        'overlay.rememberSize',
        'Remember Size',
        `<label style="display: flex; align-items: center;">
            <input type="checkbox" id="overlay-remember-size" ${rememberSize ? 'checked' : ''}>
            <span>Remember overlay size across sessions</span>
        </label>`,
        'Saves the overlay dimensions when you resize it.'
    ));

    const openOnLoad = config.get('overlay.openOnLoad');
    content.appendChild(createSetting(
        'overlay.openOnLoad',
        'Auto-Open on Page Load',
        `<label style="display: flex; align-items: center;">
            <input type="checkbox" id="overlay-open-on-load" ${openOnLoad ? 'checked' : ''}>
            <span>Automatically open overlay when page loads</span>
        </label>`,
        'Opens the enhancements overlay automatically when you visit the page.'
    ));

    const toggleButtonPosition = config.get('appearance.toggleButtonPosition');
    content.appendChild(createSetting(
        'appearance.toggleButtonPosition',
        'Toggle Button Position',
        `<select id="toggle-button-position">
            <option value="top-right" ${toggleButtonPosition === 'top-right' ? 'selected' : ''}>Top Right</option>
            <option value="top-left" ${toggleButtonPosition === 'top-left' ? 'selected' : ''}>Top Left</option>
            <option value="bottom-right" ${toggleButtonPosition === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
            <option value="bottom-left" ${toggleButtonPosition === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
        </select>`,
        'Position of the toggle button to open/close the overlay.'
    ));

    const section = createSection('overlay', '🖼️', 'Overlay & Layout', '');
    const sectionContent = section.querySelector('.section-content');
    sectionContent.innerHTML = '';
    sectionContent.appendChild(content);

    attachInputListener(content, '#overlay-width', 'input', 'overlay.defaultWidth', (e) => parseInt(e.target.value, 10));
    attachInputListener(content, '#overlay-height', 'input', 'overlay.defaultHeight', (e) => parseInt(e.target.value, 10));
    attachInputListener(content, '#overlay-remember-pos', 'change', 'overlay.rememberPosition', (e) => e.target.checked);
    attachInputListener(content, '#overlay-remember-size', 'change', 'overlay.rememberSize', (e) => e.target.checked);
    attachInputListener(content, '#overlay-open-on-load', 'change', 'overlay.openOnLoad', (e) => e.target.checked);
    attachInputListener(content, '#toggle-button-position', 'change', 'appearance.toggleButtonPosition', (e) => e.target.value);

    return section;
}

/**
 * Performance Section
 */
function createPerformanceSection() {
    const loadingTimeout = config.get('performance.loadingTimeout') / 1000; // Convert to seconds
    const toastDuration = config.get('performance.toastDuration') / 1000;
    const livePreviewDebounce = config.get('performance.livePreviewDebounce');

    const content = document.createElement('div');

    content.appendChild(createSetting(
        'performance.loadingTimeout',
        'Loading Timeout',
        `<input type="number" id="perf-loading-timeout" value="${loadingTimeout}" min="5" max="120" step="5"> seconds`,
        'Maximum time to wait for operations to complete (5-120 seconds).'
    ));

    content.appendChild(createSetting(
        'performance.toastDuration',
        'Toast Notification Duration',
        `<input type="number" id="perf-toast-duration" value="${toastDuration}" min="1" max="10" step="0.5"> seconds`,
        'How long toast notifications stay visible (1-10 seconds).'
    ));

    content.appendChild(createSetting(
        'performance.livePreviewDebounce',
        'Live Preview Delay',
        `<input type="number" id="perf-preview-debounce" value="${livePreviewDebounce}" min="100" max="2000" step="100"> ms`,
        'Delay before updating live preview (100-2000 ms). Higher = less responsive but better performance.'
    ));

    const section = createSection('performance', '⚡', 'Performance', '');
    const sectionContent = section.querySelector('.section-content');
    sectionContent.innerHTML = '';
    sectionContent.appendChild(content);

    attachInputListener(content, '#perf-loading-timeout', 'input', 'performance.loadingTimeout', (e) => parseInt(e.target.value, 10) * 1000);
    attachInputListener(content, '#perf-toast-duration', 'input', 'performance.toastDuration', (e) => parseFloat(e.target.value) * 1000);
    attachInputListener(content, '#perf-preview-debounce', 'input', 'performance.livePreviewDebounce', (e) => parseInt(e.target.value, 10));

    return section;
}

/**
 * Appearance Section
 */
function createAppearanceSection() {
    const primaryColor = config.get('appearance.primaryColor');
    const headerColor = config.get('appearance.headerColor');

    const content = document.createElement('div');

    content.appendChild(createSetting(
        'appearance.primaryColor',
        'Primary Color',
        `<div class="color-input-group">
            <input type="color" id="appearance-primary" value="${primaryColor}">
            <span class="color-text">${primaryColor}</span>
        </div>`,
        'Primary theme color for buttons and accents.'
    ));

    content.appendChild(createSetting(
        'appearance.headerColor',
        'Header Color',
        `<div class="color-input-group">
            <input type="color" id="appearance-header" value="${headerColor}">
            <span class="color-text">${headerColor}</span>
        </div>`,
        'Background color for overlay header.'
    ));

    const section = createSection('appearance', '🎨', 'Colors & Theme', '');
    const sectionContent = section.querySelector('.section-content');
    sectionContent.innerHTML = '';
    sectionContent.appendChild(content);

    attachInputListener(content, '#appearance-primary', 'input', 'appearance.primaryColor', (e) => {
        content.querySelector('.color-input-group .color-text').textContent = e.target.value;
        return e.target.value;
    });

    attachInputListener(content, '#appearance-header', 'input', 'appearance.headerColor', (e) => {
        content.querySelectorAll('.color-input-group .color-text')[1].textContent = e.target.value;

        // Apply header color to overlay header immediately
        const overlayHeader = document.getElementById('expert-enhancements-overlay-header');
        if (overlayHeader) {
            overlayHeader.style.background = e.target.value;
        }

        return e.target.value;
    });

    return section;
}

/**
 * Advanced/Debug Section
 */
function createAdvancedSection() {
    const storagePrefix = config.get('advanced.storagePrefix');
    const monacoUrl = config.get('advanced.cdnUrls.monaco');

    const content = document.createElement('div');
    content.innerHTML = `
        <p style="color: #ff9800; margin-bottom: 1rem;">
            ⚠️ <strong>Warning:</strong> These are advanced settings. Only modify if you know what you're doing.
        </p>
    `;

    content.appendChild(createSetting(
        'advanced.storagePrefix',
        'LocalStorage Prefix',
        `<input type="text" id="advanced-storage-prefix" value="${storagePrefix}">`,
        'Prefix for localStorage keys. Changing this will reset all saved data.'
    ));

    content.appendChild(createSetting(
        'advanced.cdnUrls.monaco',
        'Monaco CDN URL',
        `<input type="text" id="advanced-monaco-url" value="${monacoUrl}" style="max-width: 600px;">`,
        'CDN URL for Monaco Editor. Changing this requires a page refresh.'
    ));

    const section = createSection('advanced', '🔧', 'Advanced & Debug', '', true);
    const sectionContent = section.querySelector('.section-content');
    sectionContent.innerHTML = '';
    sectionContent.appendChild(content);

    attachInputListener(content, '#advanced-storage-prefix', 'change', 'advanced.storagePrefix', (e) => e.target.value);
    attachInputListener(content, '#advanced-monaco-url', 'change', 'advanced.cdnUrls.monaco', (e) => e.target.value);

    return section;
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Toggle section expand/collapse
 */
function toggleSection(sectionId) {
    sectionState[sectionId] = !sectionState[sectionId];

    const section = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (!section) return;

    const header = section.querySelector('.section-header');
    const body = section.querySelector('.section-body');

    if (sectionState[sectionId]) {
        header.classList.add('expanded');
        body.classList.add('expanded');
    } else {
        header.classList.remove('expanded');
        body.classList.remove('expanded');
    }

    saveSectionState();
}

/**
 * Attach input listener with config update
 */
function attachInputListener(container, selector, event, configPath, valueFn) {
    const elements = container.querySelectorAll(selector);
    elements.forEach(element => {
        if (element.disabled) return;

        element.addEventListener(event, (e) => {
            const value = valueFn(e);
            const success = config.setUserSetting(configPath, value);
            if (success) {
                context.UI.showToast('Setting saved', 'success', 2000);

                // Update UI to show modified status
                refreshSettingStatus(configPath);
            }
        });
    });
}

/**
 * Refresh setting status badges
 */
function refreshSettingStatus(path) {
    const settingOption = document.querySelector(`[data-path="${path}"]`);
    if (!settingOption) return;

    const source = config.getSource(path);
    const statusDiv = settingOption.querySelector('.setting-status');
    if (!statusDiv) return;

    let statusHtml = '';
    if (source === 'embed') {
        statusHtml = '<span class="status-badge status-locked" title="Controlled by embed configuration">🔒 Locked</span>';
    } else if (source === 'user') {
        statusHtml = `
            <span class="status-badge status-modified" title="Modified from default">Modified</span>
            <button class="reset-button" data-reset="${path}">Reset</button>
        `;
    }

    statusDiv.innerHTML = statusHtml;

    // Re-attach reset button listener
    const resetBtn = statusDiv.querySelector('.reset-button');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => resetSetting(path));
    }
}

/**
 * Reset individual setting
 */
function resetSetting(path) {
    config.resetUserSetting(path);
    context.UI.showToast('Setting reset to default', 'info', 2000);

    // Remount to refresh UI
    const container = document.querySelector('.enhancements-app-container').parentElement;
    SettingsApp.mount(container);
}

/**
 * Attach global event listeners
 */
function attachGlobalListeners() {
    // Reset all button
    const resetAllBtn = document.getElementById('reset-all-btn');
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', async () => {
            const confirmed = await context.UI.confirm(
                'Are you sure you want to reset all settings to defaults? This cannot be undone.',
                { confirmText: 'Reset All', cancelText: 'Cancel', type: 'danger' }
            );

            if (confirmed) {
                config.resetAllUserSettings();
                context.UI.showToast('All settings reset to defaults', 'success');

                // Remount to refresh UI
                const container = document.querySelector('.enhancements-app-container').parentElement;
                SettingsApp.mount(container);
            }
        });
    }

    // Export config button
    const exportBtn = document.getElementById('export-config-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const configData = config.exportConfig();
            const json = JSON.stringify(configData, null, 2);

            // Copy to clipboard
            navigator.clipboard.writeText(json).then(() => {
                context.UI.showToast('Configuration copied to clipboard', 'success');
            }).catch(() => {
                // Fallback: show in console
                console.log('Configuration:', configData);
                context.UI.showToast('Configuration exported to console', 'info');
            });
        });
    }

    // Reset buttons
    document.querySelectorAll('[data-reset]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const path = e.target.dataset.reset;
            resetSetting(path);
        });
    });
}

/**
 * Load section state from localStorage
 */
function loadSectionState() {
    try {
        const saved = localStorage.getItem('expertEnhancements:settingsSections');
        if (saved) {
            Object.assign(sectionState, JSON.parse(saved));
        }
    } catch (error) {
        console.warn('[Settings] Failed to load section state:', error);
    }
}

/**
 * Save section state to localStorage
 */
function saveSectionState() {
    try {
        localStorage.setItem('expertEnhancements:settingsSections', JSON.stringify(sectionState));
    } catch (error) {
        console.warn('[Settings] Failed to save section state:', error);
    }
}

// ============================================================================
// Register App & Export
// ============================================================================

// Register with AppManager (gracefully handles registration failures)
try {
    // Debug/Test: Allow URL parameter to force registration failure
    const urlParams = new URLSearchParams(window.location.search);
    const failApps = urlParams.getAll('failApp');

    if (failApps.includes('settings')) {
        console.warn('[Settings App] ⚠ Simulating registration failure (failApp URL param)');
        throw new Error('Simulated failure for testing (URL param: failApp=settings)');
    }

    const registered = AppManager.register(SettingsApp);
    if (registered) {
        console.log('[Settings App] Successfully registered');
    } else {
        console.error('[Settings App] Registration failed - check AppManager logs');
    }
} catch (error) {
    console.error('[Settings App] Unexpected error during registration:', error);
}

// Export for potential external use
export { SettingsApp };
