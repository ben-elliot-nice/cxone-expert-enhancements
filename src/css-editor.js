/**
 * CXone Expert Enhancements - CSS Editor App
 *
 * Manages custom CSS for different user roles.
 *
 * @version 1.0.0
 */

// ES Module - import dependencies from core
import { AppManager } from './core.js';
import { BaseEditor } from './base-editor.js';

console.log('[CSS Editor App] Loading...');

    // ============================================================================
    // State & Configuration
    // ============================================================================

    const ROLE_CONFIG = [
        { id: 'all', label: 'All Roles' },
        { id: 'anonymous', label: 'Anonymous' },
        { id: 'viewer', label: 'Community Member' },
        { id: 'seated', label: 'Pro Member' },
        { id: 'admin', label: 'Admin' },
        { id: 'grape', label: 'Legacy Browser' }
    ];

    // Max active editors will be fetched from config

    let context = null; // Will receive Monaco, API, Storage, UI, DOM
    let editorState = {};
    let originalContent = {};
    let csrfToken = '';
    let monacoEditors = {};
    let isMobileView = false;
    let keyboardHandler = null; // Keyboard shortcut handler

    // Live Preview state (CSS Editor only)
    let livePreviewEnabled = false;
    let livePreviewRole = 'anonymous';
    let livePreviewStyleTag = null;
    let livePreviewDebounceTimer = null;

    // ============================================================================
    // App Interface Implementation
    // ============================================================================

    const CSSEditorApp = {
        id: 'css-editor',
        name: 'CSS Editor',

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
            console.log('[CSS Editor] Initializing...');
            context = ctx;

            // Initialize editor state
            ROLE_CONFIG.forEach(role => {
                editorState[role.id] = {
                    active: false,
                    editor: null,
                    content: '',
                    label: role.label,
                    isDirty: false
                };
            });

            // Create BaseEditor instance with CSS-specific configuration
            this._baseEditor = new BaseEditor({
                editorType: 'css',
                itemsConfig: ROLE_CONFIG,
                maxActiveEditors: 3,
                apiEndpoint: '/deki/cp/custom_css.php?params=%2F',
                formFieldPrefix: 'css_template_',
                monacoLanguage: 'css',
                fileExtension: '.css',
                mimeType: 'text/css',
                commentStyle: '/* */',
                formatterMethod: 'formatCSS',
                dataAttribute: 'role',
                itemLabel: 'role'
            });

            // Share state with BaseEditor
            this._baseEditor.id = this.id;
            this._baseEditor.context = ctx;
            this._baseEditor.editorState = editorState;
            this._baseEditor.originalContent = originalContent;
            this._baseEditor.monacoEditors = monacoEditors;
            this._baseEditor.isMobileView = isMobileView;

            // Set hooks for CSS-specific behavior
            this._baseEditor.onEditorContentChange = () => {
                this.updateLivePreview();
            };
            this._baseEditor.onSaveAll = () => this.saveAll();
            this._baseEditor.onSaveOpenTabs = () => this.saveOpenTabs();
            this._baseEditor.onFormatAllActive = () => this.formatAllActive();
            this._baseEditor.onSaveItem = (itemId) => this.saveRole(itemId);

            // Wait for Monaco to be ready
            await context.Monaco.init();

            console.log('[CSS Editor] Initialized');
        },

        /**
         * Mount the app into the container
         */
        async mount(container) {
            console.log('[CSS Editor] Mounting...');

            // Build UI with persistent save dropdown
            container.innerHTML = `
                <div class="enhancements-app-container">
                    <div id="message-area"></div>
                    <div id="css-editor-container" style="display: none;">
                        <div class="toggle-bar" id="toggle-bar">
                            <div class="save-dropdown">
                                <button class="btn btn-primary" id="save-btn">Save All</button>
                                <button class="btn btn-dropdown-toggle" id="save-dropdown-toggle">▼</button>
                                <div class="dropdown-menu" id="save-dropdown-menu">
                                    <button class="dropdown-item" id="discard-btn">Discard All</button>
                                </div>
                            </div>
                        </div>
                        <div id="editors-grid" class="editors-grid"></div>
                    </div>
                </div>
            `;

            // Show loading overlay
            context.LoadingOverlay.show('Loading CSS from system...', {
                timeout: 30000,
                showProgress: true
            });

            try {
                // Load Prettier (blocking to prevent AMD race condition)
                try {
                    await context.Formatter.init();
                    console.log('[CSS Editor] Code formatter loaded successfully');
                    // Inject format buttons into all rendered panes
                    this.injectFormatButtons();
                } catch (formatterError) {
                    console.warn('[CSS Editor] Code formatter unavailable:', formatterError);
                    // Graceful degradation - editor works without formatting
                }

                // Restore state if available
                const savedState = context.Storage.getAppState(this.id);
                let hasDirtyEdits = false;

                if (savedState) {
                    console.log('[CSS Editor] Restoring state:', savedState);
                    context.LoadingOverlay.setMessage('Restoring saved state...');
                    this.setState(savedState);

                    // Check if any fields are dirty
                    hasDirtyEdits = savedState.isDirty && Object.values(savedState.isDirty).some(dirty => dirty);
                    console.log('[CSS Editor] Has dirty edits in saved state:', hasDirtyEdits);
                }

                // Load CSS data - skip full fetch if we have dirty edits (checkpoint protection)
                if (hasDirtyEdits) {
                    context.LoadingOverlay.setMessage('Loading saved edits...');
                } else {
                    context.LoadingOverlay.setMessage('Fetching CSS from server...');
                }
                await this.loadData(hasDirtyEdits);

                // Build toggle bar (buttons or dropdown based on viewport)
                // Note: Don't check viewport width here - overlay dimensions aren't ready yet
                // onResize() will be called after mount and will properly detect viewport
                this.buildToggleBar();

                // Initialize editors - skip default if we have saved state
                context.LoadingOverlay.setMessage('Initializing Monaco editors...');
                const skipDefault = !!savedState;
                console.log('[CSS Editor] Initializing editors, skip default:', skipDefault);
                this.initializeEditors(skipDefault);

                // Setup save dropdown event listeners
                this.setupSaveDropdown();

                // Setup keyboard shortcuts
                this.setupKeyboardShortcuts();

                // Create and mount live preview controls to overlay header
                this.createLivePreviewControls();

                // Hide loading overlay
                context.LoadingOverlay.hide();

                console.log('[CSS Editor] Mounted');

            } catch (error) {
                console.error('[CSS Editor] Mount failed:', error);
                context.LoadingOverlay.showError('Failed to load CSS Editor: ' + error.message);
                throw error;
            }
        },

        /**
         * Unmount the app (cleanup)
         */
        async unmount() {
            console.log('[CSS Editor] Unmounting...');

            // Clear live preview
            this.clearLivePreview();
            if (livePreviewStyleTag && livePreviewStyleTag.parentNode) {
                livePreviewStyleTag.remove();
                livePreviewStyleTag = null;
            }

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

            console.log('[CSS Editor] Unmounted');
        },

        /**
         * Handle resize events
         */
        onResize() {
            // Check if view mode changed (mobile/desktop)
            this.checkViewportWidth();

            // Check if overlay is narrow (hide role selector)
            this.checkOverlayWidth();

            // Recalculate heights and re-layout
            this.updateHeights();
        },

        /**
         * Check overlay width and hide/show role selector accordingly
         */
        checkOverlayWidth() {
            const overlay = document.getElementById('expert-enhancements-overlay');
            if (!overlay) return;

            const overlayWidth = overlay.offsetWidth;
            const roleSelector = document.querySelector('.live-preview-role-selector');

            if (roleSelector) {
                // Hide role selector if overlay is narrower than mobile breakpoint
                const mobileBreakpoint = context.Config.get('advanced.breakpoints.mobile');
                if (overlayWidth < mobileBreakpoint) {
                    roleSelector.style.display = 'none';
                } else {
                    roleSelector.style.display = '';
                }
            }
        },

        /**
         * Get current state for persistence (delegated to BaseEditor with CSS-specific additions)
         */
        getState() {
            const state = this._baseEditor.getState();

            // Add CSS-specific live preview state
            state.livePreview = {
                enabled: livePreviewEnabled,
                selectedRole: livePreviewRole
            };

            return state;
        },

        /**
         * Restore state (delegated to BaseEditor with CSS-specific additions)
         */
        setState(state) {
            if (!state) return;

            // Restore base state
            this._baseEditor.setState(state);

            // Restore CSS-specific live preview state
            if (state.livePreview) {
                livePreviewEnabled = state.livePreview.enabled || false;
                livePreviewRole = state.livePreview.selectedRole || 'anonymous';
                console.log('[CSS Editor] Restored live preview state:', state.livePreview);
            }
        },

        /**
         * Load CSS data from API (delegated to BaseEditor)
         * @param {boolean} skipContent - If true, only fetch CSRF token (checkpoint protection)
         */
        async loadData(skipContent = false) {
            await this._baseEditor.loadData(skipContent);
            // Sync csrfToken to module variable for save operations
            csrfToken = this._baseEditor.csrfToken;
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
         * Build toggle bar with role buttons (desktop) or dropdown (mobile)
         * (delegated to BaseEditor)
         */
        buildToggleBar() {
            return this._baseEditor.buildToggleBar();
        },

        /**
         * Handle mobile dropdown editor change (delegated to BaseEditor)
         */
        handleMobileEditorChange(newRoleId) {
            return this._baseEditor.handleMobileEditorChange(newRoleId);
        },

        /**
         * Setup save dropdown event listeners (delegated to BaseEditor)
         */
        setupSaveDropdown() {
            return this._baseEditor.setupSaveDropdown();
        },

        /**
         * Toggle editor for a role (delegated to BaseEditor)
         */
        toggleEditor(roleId, event) {
            return this._baseEditor.toggleEditor(roleId, event);
        },

        /**
         * Save current state to storage (uses custom getState for CSS-specific state)
         */
        saveState() {
            // Use custom getState to include CSS-specific state
            const state = this.getState();
            context.Storage.setAppState(this.id, state);
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
         * Create editor pane for a role (delegated to BaseEditor)
         */
        createEditorPane(roleId) {
            return this._baseEditor.createEditorPane(roleId);
        },

        /**
         * Create Monaco editor instance (delegated to BaseEditor)
         */
        createMonacoEditor(roleId, container) {
            return this._baseEditor.createMonacoEditor(roleId, container);
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
         * Export CSS for a role (delegated to BaseEditor)
         */
        exportRole(roleId) {
            return this._baseEditor.exportItem(roleId);
        },

        /**
         * Import CSS file into a role (appends content) (delegated to BaseEditor)
         */
        importRole(roleId, file) {
            return this._baseEditor.importItem(roleId, file);
        },

        /**
         * Import CSS file via drag & drop (with role selector) (delegated to BaseEditor)
         */
        async importFile(fileContent, fileName) {
            return this._baseEditor.importFile(fileContent, fileName);
        },

        /**
         * Inject format buttons into all rendered editor panes
         * Called when Prettier becomes available after editor is already mounted
         */
        injectFormatButtons() {
            console.log('[CSS Editor] Injecting format buttons into rendered panes');

            // Find all editor pane actions containers
            const panes = document.querySelectorAll('.editor-pane');

            panes.forEach(pane => {
                const actions = pane.querySelector('.editor-pane-actions');
                const exportBtn = pane.querySelector('.editor-pane-export');

                if (!actions || !exportBtn) return;

                // Check if format button already exists
                if (pane.querySelector('.editor-pane-format')) return;

                // Get roleId from export button
                const roleId = exportBtn.getAttribute('data-export-role');
                if (!roleId) return;

                // Create and insert format button before export button
                const formatBtn = context.DOM.create('button', {
                    className: 'editor-pane-format',
                    'data-format-role': roleId,
                    title: 'Format CSS (Ctrl+Shift+F)'
                }, ['Format']);
                formatBtn.addEventListener('click', () => this.formatRole(roleId));

                // Insert before export button
                actions.insertBefore(formatBtn, exportBtn);

            });
        },

        /**
         * Format CSS for a specific role
         * @param {string} roleId - Role identifier
         * @param {boolean} silent - If true, suppress success toast
         * @returns {Object|null} - { changed: boolean, label: string } or null on error/empty
         */
        async formatRole(roleId, silent = false) {
            return this._baseEditor.formatItem(roleId, silent);
        },

        /**
         * Format all active editors
         */
        async formatAllActive() {
            return this._baseEditor.formatAllActive();
        },

        /**
         * Discard all changes (revert to original)
         * Uses inline confirmation
         */
        discardAll() {
            return this._baseEditor.discardAll();
        },

        /**
         * Actually perform discard all (after confirmation)
         */
        performDiscardAll() {
            return this._baseEditor.performDiscardAll();
        },

        /**
         * Revert a single role (with inline confirmation)
         */
        revertRole(roleId) {
            return this._baseEditor.revertItem(roleId);
        },

        /**
         * Actually perform revert (after confirmation)
         */
        performRevert(roleId) {
            return this._baseEditor.performRevert(roleId);
        },

        /**
         * Toggle editor dropdown menu
         */
        toggleEditorDropdown(roleId) {
            return this._baseEditor.toggleEditorDropdown(roleId);
        },

        /**
         * Toggle actions dropdown menu (delegated to BaseEditor)
         */
        toggleActionsDropdown(roleId) {
            return this._baseEditor.toggleActionsDropdown(roleId);
        },

        /**
         * Save a single CSS role
         */
        async saveRole(roleId) {
            const saveBtn = document.querySelector(`[data-save-role="${roleId}"]`);
            if (!saveBtn) return;

            // Get all save buttons to disable them
            const saveAllBtn = document.getElementById('save-btn');
            const allSaveBtns = document.querySelectorAll('[data-save-role]');

            // Store original button state
            const originalText = saveBtn.textContent;
            const wasDisabled = saveBtn.disabled;

            try {
                console.log(`[CSS Editor] Saving ${roleId}...`);

                const role = editorState[roleId];
                if (!role) {
                    throw new Error(`Role ${roleId} not found`);
                }

                // Disable ALL save buttons
                if (saveAllBtn) saveAllBtn.disabled = true;
                allSaveBtns.forEach(btn => btn.disabled = true);

                // Show loading state on this button
                saveBtn.classList.add('saving');
                saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

                // Sync this editor's value to state
                const editor = monacoEditors[roleId];
                if (editor) {
                    role.content = editor.getValue();
                }

                // Format on save if enabled and formatter available
                const settings = context.Storage.getFormatterSettings();
                if (settings.formatOnSave && context.Formatter.isReady() && role.content && role.content.trim() !== '') {
                    try {
                        console.log(`[CSS Editor] Auto-formatting ${roleId} before save...`);
                        const formatted = await context.Formatter.formatCSS(role.content);
                        role.content = formatted;
                        if (editor) {
                            editor.setValue(formatted);
                        }
                    } catch (formatError) {
                        console.warn(`[CSS Editor] Auto-format failed for ${roleId}:`, formatError);
                        // Continue with save even if formatting fails
                    }
                }

                // Check if this role has changes
                if (!role.isDirty && role.content === originalContent[roleId]) {
                    context.UI.showToast(`${role.label} has no changes to save`, 'warning');
                    return;
                }

                // Capture content being saved (to detect edits during save)
                const contentBeingSaved = role.content;

                // Build form data - send the edited field + original content for others
                // This ensures only the specific field is saved, not all edited fields
                const formData = {
                    csrf_token: csrfToken,
                    css_template_all: roleId === 'all' ? editorState.all.content : originalContent.all,
                    css_template_anonymous: roleId === 'anonymous' ? editorState.anonymous.content : originalContent.anonymous,
                    css_template_viewer: roleId === 'viewer' ? editorState.viewer.content : originalContent.viewer,
                    css_template_seated: roleId === 'seated' ? editorState.seated.content : originalContent.seated,
                    css_template_admin: roleId === 'admin' ? editorState.admin.content : originalContent.admin,
                    css_template_grape: roleId === 'grape' ? editorState.grape.content : originalContent.grape
                };

                const { body, boundary } = context.API.buildMultipartBody(formData);

                const url = '/deki/cp/custom_css.php?params=%2F';
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
                    context.UI.showToast(`${role.label} saved successfully!`, 'success');

                    // Update original content to what was actually saved
                    originalContent[roleId] = contentBeingSaved;

                    // Only mark clean if content hasn't changed during save
                    const currentContent = editor ? editor.getValue() : role.content;
                    if (currentContent === contentBeingSaved) {
                        role.isDirty = false;
                    } else {
                        role.isDirty = true;
                        console.log(`[CSS Editor] ${roleId} content changed during save, keeping dirty state`);
                    }

                    this.updateToggleButtons();

                    // Persist updated state to localStorage
                    this.saveState();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error(`[CSS Editor] Save ${roleId} failed:`, error);
                context.UI.showToast(`Failed to save: ${error.message}`, 'error');
            } finally {
                // Restore all button states
                saveBtn.disabled = wasDisabled;
                saveBtn.classList.remove('saving');
                saveBtn.textContent = originalText;
                if (saveAllBtn) saveAllBtn.disabled = false;
                allSaveBtns.forEach(btn => btn.disabled = false);
            }
        },

        /**
         * Save all CSS
         */
        async saveAll() {
            const saveBtn = document.getElementById('save-btn');
            if (!saveBtn) return;

            // Get all save buttons to disable them
            const allSaveBtns = document.querySelectorAll('[data-save-role]');

            // Store original button state
            const originalText = saveBtn.textContent;
            const wasDisabled = saveBtn.disabled;

            try {
                console.log('[CSS Editor] Saving all CSS...');

                // Disable ALL save buttons
                saveBtn.disabled = true;
                allSaveBtns.forEach(btn => btn.disabled = true);

                // Show loading state on Save All button
                saveBtn.classList.add('saving');
                saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

                // Sync editor values to state
                Object.keys(monacoEditors).forEach(roleId => {
                    const editor = monacoEditors[roleId];
                    if (editor) {
                        editorState[roleId].content = editor.getValue();
                    }
                });

                // Format on save if enabled and formatter available
                const settings = context.Storage.getFormatterSettings();
                if (settings.formatOnSave && context.Formatter.isReady()) {
                    for (const roleId of Object.keys(editorState)) {
                        const role = editorState[roleId];
                        if (role.content && role.content.trim() !== '') {
                            try {
                                console.log(`[CSS Editor] Auto-formatting ${roleId} before save...`);
                                const formatted = await context.Formatter.formatCSS(role.content);
                                role.content = formatted;
                                const editor = monacoEditors[roleId];
                                if (editor) {
                                    editor.setValue(formatted);
                                }
                            } catch (formatError) {
                                console.warn(`[CSS Editor] Auto-format failed for ${roleId}:`, formatError);
                                // Continue with save even if formatting fails
                            }
                        }
                    }
                }

                // Check if any role has changes
                const hasChanges = Object.keys(editorState).some(roleId => {
                    return editorState[roleId].isDirty || editorState[roleId].content !== originalContent[roleId];
                });

                if (!hasChanges) {
                    context.UI.showToast('No changes to save', 'warning');
                    return;
                }

                // Capture content being saved for all roles (to detect edits during save)
                const contentBeingSaved = {};
                Object.keys(editorState).forEach(roleId => {
                    contentBeingSaved[roleId] = editorState[roleId].content;
                });

                // Build form data
                const formData = {
                    csrf_token: csrfToken,
                    css_template_all: editorState.all.content,
                    css_template_anonymous: editorState.anonymous.content,
                    css_template_viewer: editorState.viewer.content,
                    css_template_seated: editorState.seated.content,
                    css_template_admin: editorState.admin.content,
                    css_template_grape: editorState.grape.content
                };

                const { body, boundary } = context.API.buildMultipartBody(formData);

                const url = '/deki/cp/custom_css.php?params=%2F';
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
                    context.UI.showToast('CSS saved successfully!', 'success');

                    // Update original content and dirty flags
                    Object.keys(editorState).forEach(roleId => {
                        // Update original content to what was actually saved
                        originalContent[roleId] = contentBeingSaved[roleId];

                        // Only mark clean if content hasn't changed during save
                        const editor = monacoEditors[roleId];
                        const currentContent = editor ? editor.getValue() : editorState[roleId].content;
                        if (currentContent === contentBeingSaved[roleId]) {
                            editorState[roleId].isDirty = false;
                        } else {
                            editorState[roleId].isDirty = true;
                            console.log(`[CSS Editor] ${roleId} content changed during save, keeping dirty state`);
                        }
                    });

                    this.updateToggleButtons();

                    // Persist updated state to localStorage
                    this.saveState();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error('[CSS Editor] Save failed:', error);
                context.UI.showToast('Failed to save CSS: ' + error.message, 'error');
            } finally {
                // Restore all button states
                saveBtn.disabled = wasDisabled;
                saveBtn.classList.remove('saving');
                saveBtn.textContent = originalText;
                allSaveBtns.forEach(btn => btn.disabled = false);
            }
        },

        /**
         * Save only the currently open tabs
         */
        async saveOpenTabs() {
            const openRoles = Object.keys(editorState).filter(role => editorState[role].active);

            if (openRoles.length === 0) {
                context.UI.showToast('No tabs open to save', 'warning');
                return;
            }

            // Get all save buttons to disable them
            const saveAllBtn = document.getElementById('save-btn');
            const allSaveBtns = document.querySelectorAll('[data-save-role]');

            // Store original button states
            const buttonStates = new Map();

            // Store Save All button state
            if (saveAllBtn) {
                buttonStates.set(saveAllBtn, {
                    text: saveAllBtn.textContent,
                    disabled: saveAllBtn.disabled
                });
            }

            // Store individual editor save button states
            openRoles.forEach(roleId => {
                const btn = document.querySelector(`[data-save-role="${roleId}"]`);
                if (btn) {
                    buttonStates.set(btn, {
                        text: btn.textContent,
                        disabled: btn.disabled
                    });
                }
            });

            try {
                console.log(`[CSS Editor] Saving ${openRoles.length} open tab(s):`, openRoles);

                // Disable ALL save buttons
                if (saveAllBtn) saveAllBtn.disabled = true;
                allSaveBtns.forEach(btn => btn.disabled = true);

                // Show loading state on open editor save buttons
                openRoles.forEach(roleId => {
                    const btn = document.querySelector(`[data-save-role="${roleId}"]`);
                    if (btn) {
                        btn.classList.add('saving');
                        btn.innerHTML = '<span class="spinner"></span> Saving...';
                    }
                });

                // Sync editor values to state for open tabs
                openRoles.forEach(roleId => {
                    const editor = monacoEditors[roleId];
                    if (editor) {
                        editorState[roleId].content = editor.getValue();
                    }
                });

                // Format on save if enabled and formatter available
                const settings = context.Storage.getFormatterSettings();
                if (settings.formatOnSave && context.Formatter.isReady()) {
                    for (const roleId of openRoles) {
                        const role = editorState[roleId];
                        if (role.content && role.content.trim() !== '') {
                            try {
                                console.log(`[CSS Editor] Auto-formatting ${roleId} before save...`);
                                const formatted = await context.Formatter.formatCSS(role.content);
                                role.content = formatted;
                                const editor = monacoEditors[roleId];
                                if (editor) {
                                    editor.setValue(formatted);
                                }
                            } catch (formatError) {
                                console.warn(`[CSS Editor] Auto-format failed for ${roleId}:`, formatError);
                                // Continue with save even if formatting fails
                            }
                        }
                    }
                }

                // Check if any open tab has changes
                const hasChanges = openRoles.some(roleId => {
                    return editorState[roleId].isDirty || editorState[roleId].content !== originalContent[roleId];
                });

                if (!hasChanges) {
                    const tabLabel = openRoles.length === 1 ? editorState[openRoles[0]].label : `${openRoles.length} tabs`;
                    context.UI.showToast(`${tabLabel} have no changes to save`, 'warning');
                    return;
                }

                // Capture content being saved for open tabs (to detect edits during save)
                const contentBeingSaved = {};
                openRoles.forEach(roleId => {
                    contentBeingSaved[roleId] = editorState[roleId].content;
                });

                // Build form data - send edited content for open tabs, original for closed tabs
                const formData = {
                    csrf_token: csrfToken,
                    css_template_all: openRoles.includes('all') ? editorState.all.content : originalContent.all,
                    css_template_anonymous: openRoles.includes('anonymous') ? editorState.anonymous.content : originalContent.anonymous,
                    css_template_viewer: openRoles.includes('viewer') ? editorState.viewer.content : originalContent.viewer,
                    css_template_seated: openRoles.includes('seated') ? editorState.seated.content : originalContent.seated,
                    css_template_admin: openRoles.includes('admin') ? editorState.admin.content : originalContent.admin,
                    css_template_grape: openRoles.includes('grape') ? editorState.grape.content : originalContent.grape
                };

                const { body, boundary } = context.API.buildMultipartBody(formData);

                const url = '/deki/cp/custom_css.php?params=%2F';
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
                    const tabLabel = openRoles.length === 1 ? editorState[openRoles[0]].label : `${openRoles.length} tabs`;
                    context.UI.showToast(`${tabLabel} saved successfully!`, 'success');

                    // Update original content and dirty flags for saved tabs
                    openRoles.forEach(roleId => {
                        // Update original content to what was actually saved
                        originalContent[roleId] = contentBeingSaved[roleId];

                        // Only mark clean if content hasn't changed during save
                        const editor = monacoEditors[roleId];
                        const currentContent = editor ? editor.getValue() : editorState[roleId].content;
                        if (currentContent === contentBeingSaved[roleId]) {
                            editorState[roleId].isDirty = false;
                        } else {
                            editorState[roleId].isDirty = true;
                            console.log(`[CSS Editor] ${roleId} content changed during save, keeping dirty state`);
                        }
                    });

                    this.updateToggleButtons();
                    this.saveState();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error('[CSS Editor] Save open tabs failed:', error);
                context.UI.showToast('Failed to save: ' + error.message, 'error');
            } finally {
                // Restore all button states
                buttonStates.forEach((state, btn) => {
                    btn.disabled = state.disabled;
                    btn.classList.remove('saving');
                    btn.textContent = state.text;
                });
            }
        },

        /**
         * Setup keyboard shortcuts
         */
        setupKeyboardShortcuts() {
            this._baseEditor.setupKeyboardShortcuts();
            // Store reference to BaseEditor's handler in module-level variable for cleanup
            keyboardHandler = this._baseEditor.keyboardHandler;
        },

        /**
         * Create and mount live preview UI controls to overlay header
         */
        createLivePreviewControls() {
            // Toggle button (eye icon)
            const toggleBtn = context.DOM.create('button', {
                className: livePreviewEnabled ? 'live-preview-toggle enabled' : 'live-preview-toggle',
                title: `Live Preview (${livePreviewEnabled ? 'ON' : 'OFF'})`
            });
            toggleBtn.innerHTML = '👁️';
            toggleBtn.addEventListener('click', () => this.toggleLivePreview());

            // Role selector dropdown
            const roleSelector = context.DOM.create('select', {
                className: 'live-preview-role-selector'
            });
            roleSelector.innerHTML = `
                <option value="anonymous">Anonymous</option>
                <option value="viewer">Community</option>
                <option value="seated">Pro</option>
                <option value="admin">Admin</option>
                <option value="grape">Legacy</option>
            `;
            roleSelector.value = livePreviewRole;
            roleSelector.addEventListener('change', (e) => this.setLivePreviewRole(e.target.value));

            // Mount to overlay header via core
            context.Overlay.setAppControls([toggleBtn, roleSelector]);

            console.log('[CSS Editor] Live preview controls created and mounted');

            // Check overlay width and hide role selector if needed
            this.checkOverlayWidth();

            // Initialize preview if enabled
            if (livePreviewEnabled) {
                this.performLivePreviewUpdate();
            }
        },

        /**
         * Toggle live preview on/off
         */
        toggleLivePreview() {
            livePreviewEnabled = !livePreviewEnabled;

            console.log(`[CSS Editor] Live preview ${livePreviewEnabled ? 'enabled' : 'disabled'}`);

            // Update button appearance
            const toggleBtn = document.querySelector('.live-preview-toggle');
            if (toggleBtn) {
                toggleBtn.className = livePreviewEnabled ? 'live-preview-toggle enabled' : 'live-preview-toggle';
                toggleBtn.title = `Live Preview (${livePreviewEnabled ? 'ON' : 'OFF'})`;
            }

            // Update or clear preview
            if (livePreviewEnabled) {
                this.performLivePreviewUpdate();
            } else {
                this.clearLivePreview();
            }

            // Persist state
            this.saveState();
        },

        /**
         * Set live preview role and update immediately
         */
        setLivePreviewRole(roleId) {
            livePreviewRole = roleId;

            console.log(`[CSS Editor] Live preview role changed to: ${roleId}`);

            // Update immediately if enabled
            if (livePreviewEnabled) {
                this.performLivePreviewUpdate();
            }

            // Persist state
            this.saveState();
        },

        /**
         * Get or create live preview style tag in page <head>
         */
        getLivePreviewStyleTag() {
            if (!livePreviewStyleTag) {
                livePreviewStyleTag = document.createElement('style');
                livePreviewStyleTag.id = 'css-editor-live-preview';
                livePreviewStyleTag.setAttribute('data-source', 'CSS Editor Live Preview');
                document.head.appendChild(livePreviewStyleTag);
                console.log('[CSS Editor] Created live preview style tag');
            }
            return livePreviewStyleTag;
        },

        /**
         * Update live preview (debounced 300ms)
         */
        updateLivePreview() {
            if (!livePreviewEnabled) return;

            // Clear existing timer
            if (livePreviewDebounceTimer) {
                clearTimeout(livePreviewDebounceTimer);
            }

            // Debounce using config value
            const debounceDelay = context.Config.get('performance.livePreviewDebounce');
            livePreviewDebounceTimer = setTimeout(() => {
                this.performLivePreviewUpdate();
                livePreviewDebounceTimer = null;
            }, debounceDelay);
        },

        /**
         * Perform live preview update (actual CSS injection)
         * Combines CSS based on role hierarchy
         */
        performLivePreviewUpdate() {
            try {
                const styleTag = this.getLivePreviewStyleTag();

                // Determine which roles to include based on selected preview role
                // Role hierarchy:
                // - anonymous: all + anonymous
                // - viewer: all + viewer
                // - seated: all + seated
                // - admin: all + seated + admin (inherits pro)
                // - grape: all + grape

                const rolesToInclude = ['all']; // All roles get "all" CSS

                if (livePreviewRole === 'anonymous') {
                    rolesToInclude.push('anonymous');
                } else if (livePreviewRole === 'viewer') {
                    rolesToInclude.push('viewer');
                } else if (livePreviewRole === 'seated') {
                    rolesToInclude.push('seated');
                } else if (livePreviewRole === 'admin') {
                    // Admin inherits pro member permissions
                    rolesToInclude.push('seated', 'admin');
                } else if (livePreviewRole === 'grape') {
                    rolesToInclude.push('grape');
                }

                // Combine CSS in order
                let combinedCSS = '';
                rolesToInclude.forEach(roleId => {
                    const role = editorState[roleId];
                    if (role && role.content && role.content.trim()) {
                        combinedCSS += `\n/* Live Preview: ${role.label} */\n`;
                        combinedCSS += role.content;
                        combinedCSS += '\n';
                    }
                });

                // Inject into page
                styleTag.textContent = combinedCSS;

                console.log(`[CSS Editor] Live preview updated: ${combinedCSS.length} chars for role "${livePreviewRole}"`);
            } catch (error) {
                console.error('[CSS Editor] Live preview update failed:', error);
            }
        },

        /**
         * Clear live preview CSS
         */
        clearLivePreview() {
            if (livePreviewStyleTag) {
                livePreviewStyleTag.textContent = '';
                console.log('[CSS Editor] Live preview cleared');
            }
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

    if (failApps.includes('css-editor')) {
        console.warn('[CSS Editor App] ⚠ Simulating registration failure (failApp URL param)');
        throw new Error('Simulated failure for testing (URL param: failApp=css-editor)');
    }

    const registered = AppManager.register(CSSEditorApp);
    if (registered) {
        console.log('[CSS Editor App] Successfully registered');
    } else {
        console.error('[CSS Editor App] Registration failed - check AppManager logs');
    }
} catch (error) {
    console.error('[CSS Editor App] Unexpected error during registration:', error);
}

// Export for potential external use
export { CSSEditorApp };
