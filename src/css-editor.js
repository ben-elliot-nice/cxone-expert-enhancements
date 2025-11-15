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
            this._baseEditor.onSaveAll = (btn) => this._baseEditor.saveAll(btn);
            this._baseEditor.onSaveOpenTabs = () => this.saveOpenTabs();
            this._baseEditor.onFormatAllActive = () => this.formatAllActive();
            this._baseEditor.onSaveItem = (roleId, btn) => this._baseEditor.saveItem(roleId, btn);
            this._baseEditor.onFormatItem = (roleId) => this.formatRole(roleId);

            // Form data construction hooks
            this._baseEditor.buildFormDataForSave = (roleId) => {
                return {
                    csrf_token: csrfToken,
                    css_template_all: roleId === 'all' ? editorState.all.content : originalContent.all,
                    css_template_anonymous: roleId === 'anonymous' ? editorState.anonymous.content : originalContent.anonymous,
                    css_template_viewer: roleId === 'viewer' ? editorState.viewer.content : originalContent.viewer,
                    css_template_seated: roleId === 'seated' ? editorState.seated.content : originalContent.seated,
                    css_template_admin: roleId === 'admin' ? editorState.admin.content : originalContent.admin,
                    css_template_grape: roleId === 'grape' ? editorState.grape.content : originalContent.grape
                };
            };

            this._baseEditor.buildFormDataForSaveAll = () => {
                return {
                    csrf_token: csrfToken,
                    css_template_all: editorState.all.content,
                    css_template_anonymous: editorState.anonymous.content,
                    css_template_viewer: editorState.viewer.content,
                    css_template_seated: editorState.seated.content,
                    css_template_admin: editorState.admin.content,
                    css_template_grape: editorState.grape.content
                };
            };

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
                    this._baseEditor.injectFormatButtons();
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
