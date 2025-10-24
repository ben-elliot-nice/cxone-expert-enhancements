/**
 * CXone Expert Enhancements - CSS Editor App
 *
 * Manages custom CSS for different user roles.
 *
 * @version 1.0.0
 */

(function() {
    'use strict';

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

    const MAX_ACTIVE_EDITORS = 3;

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

        // App-specific constraints for overlay sizing
        constraints: {
            minWidth: 420,
            minHeight: 300
        },

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

                // Check viewport width to set mobile/desktop view
                this.checkViewportWidth();

                // Build toggle bar (buttons or dropdown based on viewport)
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
                // Hide role selector if overlay is narrower than 480px
                if (overlayWidth < 480) {
                    roleSelector.style.display = 'none';
                } else {
                    roleSelector.style.display = '';
                }
            }
        },

        /**
         * Get current state for persistence
         */
        getState() {
            const state = {
                activeRoles: Object.keys(editorState).filter(role => editorState[role].active),
                content: {},
                isDirty: {},
                originalContent: {},
                livePreview: {
                    enabled: livePreviewEnabled,
                    selectedRole: livePreviewRole
                }
            };

            Object.keys(editorState).forEach(role => {
                const roleState = editorState[role];
                state.content[role] = roleState.content;
                state.isDirty[role] = roleState.isDirty;
                state.originalContent[role] = originalContent[role];
            });

            return state;
        },

        /**
         * Restore state
         */
        setState(state) {
            if (!state) return;

            // Restore active roles
            if (state.activeRoles) {
                state.activeRoles.forEach(role => {
                    if (editorState[role]) {
                        editorState[role].active = true;
                    }
                });
            }

            // Restore content
            if (state.content) {
                Object.keys(state.content).forEach(role => {
                    if (editorState[role]) {
                        editorState[role].content = state.content[role];
                    }
                });
            }

            // Restore dirty state
            if (state.isDirty) {
                Object.keys(state.isDirty).forEach(role => {
                    if (editorState[role]) {
                        editorState[role].isDirty = state.isDirty[role];
                    }
                });
            }

            // Restore original content (server baseline)
            if (state.originalContent) {
                Object.keys(state.originalContent).forEach(role => {
                    originalContent[role] = state.originalContent[role];
                });
            }

            // Restore live preview state
            if (state.livePreview) {
                livePreviewEnabled = state.livePreview.enabled || false;
                livePreviewRole = state.livePreview.selectedRole || 'anonymous';
                console.log('[CSS Editor] Restored live preview state:', state.livePreview);
            }
        },

        /**
         * Load CSS data from API
         * @param {boolean} skipContent - If true, only fetch CSRF token (checkpoint protection)
         */
        async loadData(skipContent = false) {
            try {
                const url = '/deki/cp/custom_css.php?params=%2F';
                const response = await context.API.fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const html = await response.text();
                const { doc, data } = context.API.parseFormHTML(html);

                // Always extract CSRF token
                csrfToken = data.csrf_token;
                console.log('[CSS Editor] CSRF token extracted');

                if (skipContent) {
                    // Checkpoint protection: we have dirty edits, so don't fetch CSS content
                    // This prevents other people's changes from overwriting work-in-progress
                    console.log('[CSS Editor] Skipping content fetch - using saved edits (checkpoint protection)');
                } else {
                    // No dirty edits - safe to fetch fresh CSS from server
                    console.log('[CSS Editor] Fetching fresh CSS content from server');

                    const textareas = {
                        'css_template_all': 'all',
                        'css_template_anonymous': 'anonymous',
                        'css_template_viewer': 'viewer',
                        'css_template_seated': 'seated',
                        'css_template_admin': 'admin',
                        'css_template_grape': 'grape'
                    };

                    Object.entries(textareas).forEach(([name, roleId]) => {
                        const textarea = doc.querySelector(`textarea[name="${name}"]`);
                        if (textarea) {
                            const content = textarea.textContent;
                            editorState[roleId].content = content;
                            originalContent[roleId] = content;
                        }
                    });
                }

                // Hide loading, show editor
                document.getElementById('loading').style.display = 'none';
                document.getElementById('css-editor-container').style.display = 'block';

                console.log('[CSS Editor] Data loaded');

            } catch (error) {
                console.error('[CSS Editor] Failed to load data:', error);
                context.UI.showMessage('Failed to load CSS: ' + error.message, 'error');
            }
        },

        /**
         * Check viewport width and switch between mobile/desktop view
         */
        checkViewportWidth() {
            const wasMobileView = isMobileView;

            // Get container width to determine mobile/desktop view
            const container = document.getElementById('css-editor-container');
            if (container) {
                const containerWidth = container.offsetWidth;
                isMobileView = containerWidth < 920;
                console.log(`[CSS Editor] checkViewportWidth: width=${containerWidth}px, mobile=${isMobileView}`);
            }

            // If view mode changed, rebuild the toggle bar
            if (wasMobileView !== isMobileView) {
                console.log(`[CSS Editor] View mode changed to ${isMobileView ? 'mobile' : 'desktop'}`);
                this.buildToggleBar();

                // If switching to mobile and multiple editors are active, keep only the first
                if (isMobileView) {
                    const activeRoles = Object.keys(editorState).filter(role => editorState[role].active);
                    if (activeRoles.length > 1) {
                        console.log(`[CSS Editor] Multiple editors active in mobile view, keeping only: ${activeRoles[0]}`);
                        // Deactivate all except the first
                        activeRoles.slice(1).forEach(roleId => {
                            editorState[roleId].active = false;
                        });
                        this.updateGrid();
                        this.saveState();
                    }
                }
                this.updateToggleButtons();
            }

            return isMobileView;
        },

        /**
         * Build toggle bar with role buttons (desktop) or dropdown (mobile)
         * Never rebuilds the save dropdown - only toggle buttons or mobile selector
         */
        buildToggleBar() {
            const toggleBar = document.getElementById('toggle-bar');
            if (!toggleBar) return;

            console.log(`[CSS Editor] buildToggleBar for ${isMobileView ? 'mobile' : 'desktop'} view`);

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

                // Add options for each role with status icons
                ROLE_CONFIG.forEach(({ id, label: roleLabel }) => {
                    const role = editorState[id];
                    const option = document.createElement('option');
                    option.value = id;
                    const statusIcon = role.isDirty ? '● ' : '✓ ';
                    option.textContent = statusIcon + roleLabel;
                    option.setAttribute('data-role', id);
                    select.appendChild(option);
                });

                // Set current selection - respect already active editor
                let activeRole = Object.keys(editorState).find(role => editorState[role].active);

                // Only activate first editor if truly no active editors exist
                if (!activeRole) {
                    const firstRole = ROLE_CONFIG[0].id;
                    editorState[firstRole].active = true;
                    activeRole = firstRole;
                    console.log(`[CSS Editor] No active editor found, activating first: ${activeRole}`);
                    // Need to render the editor
                    setTimeout(() => {
                        this.updateGrid();
                        this.saveState();
                    }, 0);
                } else {
                    console.log(`[CSS Editor] Using existing active editor: ${activeRole}`);
                }

                select.value = activeRole;

                // Add change listener
                select.addEventListener('change', (e) => this.handleMobileEditorChange(e.target.value));

                wrapper.appendChild(label);
                wrapper.appendChild(select);

                // Insert at the beginning of toggle bar (before save dropdown)
                const firstChild = toggleBar.firstChild;
                toggleBar.insertBefore(wrapper, firstChild);
            } else {
                // Create desktop toggle buttons
                ROLE_CONFIG.forEach(({ id, label }) => {
                    const btn = document.createElement('button');
                    btn.className = 'toggle-btn';
                    btn.setAttribute('data-role', id);
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
         * Handle mobile dropdown editor change
         */
        handleMobileEditorChange(newRoleId) {
            console.log(`[CSS Editor] handleMobileEditorChange to: ${newRoleId}`);

            const currentActiveRole = Object.keys(editorState).find(role => editorState[role].active);

            // If selecting the same role, do nothing
            if (newRoleId === currentActiveRole) {
                return;
            }

            // Deactivate all editors
            Object.keys(editorState).forEach(roleId => {
                editorState[roleId].active = false;
            });

            // Activate selected editor
            editorState[newRoleId].active = true;

            this.updateGrid();
            this.saveState();

            // Update option text to reflect current status icons
            const mobileSelect = document.getElementById('mobile-editor-select');
            if (mobileSelect) {
                this.updateToggleButtons();
            }
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
                console.log('[CSS Editor] Save button listener attached');
            }

            if (discardBtn) {
                discardBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.discardAll();
                });
                console.log('[CSS Editor] Discard button listener attached');
            }

            if (dropdownToggle && dropdownMenu && dropdown) {
                dropdownToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdownMenu.classList.toggle('show');
                    dropdown.classList.toggle('open');
                });
                console.log('[CSS Editor] Dropdown toggle listener attached');
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
        },

        /**
         * Toggle editor for a role
         * Left click: Open only this editor (close others)
         * Shift+click: Toggle this editor alongside others
         */
        toggleEditor(roleId, event) {
            const role = editorState[roleId];
            if (!role) return;

            const activeCount = Object.values(editorState).filter(r => r.active).length;
            const isShiftClick = event && event.shiftKey;

            if (isShiftClick) {
                // Shift+click: Toggle this editor while keeping others
                if (role.active) {
                    role.active = false;
                } else {
                    if (activeCount >= MAX_ACTIVE_EDITORS) {
                        context.UI.showMessage(`Maximum ${MAX_ACTIVE_EDITORS} editors can be open at once`, 'error');
                        return;
                    }
                    role.active = true;
                }
            } else {
                // Regular click: Open only this editor
                if (role.active && activeCount === 1) {
                    // Don't close if it's the only one open
                    return;
                }

                // Close all others
                Object.keys(editorState).forEach(rid => {
                    editorState[rid].active = false;
                });

                // Open this one
                role.active = true;
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
            console.log('[CSS Editor] State saved:', state);
        },

        /**
         * Update editors grid
         */
        updateGrid() {
            const grid = document.getElementById('editors-grid');
            if (!grid) return;

            const activeRoles = Object.keys(editorState).filter(role => editorState[role].active);

            grid.innerHTML = '';
            grid.className = 'editors-grid cols-' + activeRoles.length;

            activeRoles.forEach(roleId => {
                const pane = this.createEditorPane(roleId);
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
            const container = document.getElementById('css-editor-container');
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
         * Create editor pane for a role
         */
        createEditorPane(roleId) {
            const role = editorState[roleId];

            const pane = context.DOM.create('div', { className: 'editor-pane' });
            const header = context.DOM.create('div', { className: 'editor-pane-header' });

            const titleGroup = context.DOM.create('div', {
                style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }
            });
            const title = context.DOM.create('span', {}, [role.label]);
            const status = context.DOM.create('span', {
                className: 'editor-status',
                id: `status-${roleId}`,
                style: { fontSize: '0.9rem' }
            }, [role.isDirty ? '●' : '✓']);

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
                'data-save-role': roleId
            }, ['Save']);
            saveBtn.addEventListener('click', () => this.saveRole(roleId));

            const dropdownToggle = context.DOM.create('button', {
                className: 'editor-save-dropdown-toggle',
                'data-dropdown-role': roleId
            }, ['▼']);
            dropdownToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleEditorDropdown(roleId);
            });

            const dropdownMenu = context.DOM.create('div', {
                className: 'editor-save-dropdown-menu',
                'data-menu-role': roleId
            });

            const revertBtn = context.DOM.create('button', {
                className: 'editor-dropdown-item',
                'data-revert-role': roleId
            }, ['Revert this']);
            revertBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.revertRole(roleId);
            });

            dropdownMenu.appendChild(revertBtn);
            saveDropdown.appendChild(saveBtn);
            saveDropdown.appendChild(dropdownToggle);
            saveDropdown.appendChild(dropdownMenu);

            const exportBtn = context.DOM.create('button', {
                className: 'editor-pane-export',
                'data-export-role': roleId
            }, ['Export']);
            exportBtn.addEventListener('click', () => this.exportRole(roleId));

            actions.appendChild(saveDropdown);
            actions.appendChild(exportBtn);

            header.appendChild(titleGroup);
            header.appendChild(actions);
            pane.appendChild(header);

            const editorContainer = context.DOM.create('div', {
                className: 'editor-instance',
                id: `editor-${roleId}`
            });
            pane.appendChild(editorContainer);

            // Create Monaco editor (CSS now properly sizes containers)
            if (context.Monaco.isReady()) {
                this.createMonacoEditor(roleId, editorContainer);
            }

            return pane;
        },

        /**
         * Create Monaco editor instance
         */
        createMonacoEditor(roleId, container) {
            const role = editorState[roleId];
            const monaco = context.Monaco.get();

            // Create editor immediately (may have 0 dimensions if overlay is hidden)
            const editor = monaco.editor.create(container, {
                value: role.content || '',
                language: 'css',
                theme: 'vs-dark',
                automaticLayout: false,
                minimap: { enabled: true },
                fontSize: 14,
                wordWrap: 'on',
                scrollBeyondLastLine: false
            });

            monacoEditors[roleId] = editor;

            // Track changes
            editor.onDidChangeModelContent(() => {
                role.content = editor.getValue();
                role.isDirty = role.content !== originalContent[roleId];
                this.updateToggleButtons();
                this.updateLivePreview();
            });

            console.log(`[CSS Editor] Created Monaco editor for: ${roleId}`);
        },

        /**
         * Initialize editors (activate default if none active)
         */
        initializeEditors(skipDefault = false) {
            const hasActive = Object.values(editorState).some(r => r.active);

            // Only set default if we should not skip and nothing is active
            if (!skipDefault && !hasActive) {
                // Activate 'all' by default
                editorState.all.active = true;
                console.log('[CSS Editor] No saved state, activating default: all');
            } else {
                console.log('[CSS Editor] Skipping default activation, skipDefault:', skipDefault, 'hasActive:', hasActive);
            }

            this.updateGrid();
        },

        /**
         * Update toggle button states and pane status indicators
         */
        updateToggleButtons() {
            // Update desktop buttons (if they exist)
            const buttons = document.querySelectorAll('.toggle-btn');

            buttons.forEach(btn => {
                const roleId = btn.getAttribute('data-role');
                const role = editorState[roleId];

                if (role && role.active) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }

                // Show dirty indicator
                if (role && role.isDirty) {
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
                const options = mobileSelect.querySelectorAll('option[data-role]');
                options.forEach(option => {
                    const roleId = option.getAttribute('data-role');
                    if (roleId && editorState[roleId]) {
                        const role = editorState[roleId];
                        const statusIcon = role.isDirty ? '● ' : '✓ ';
                        option.textContent = statusIcon + role.label;
                    }
                });

                // Set selected value to active role
                const activeRole = Object.keys(editorState).find(role => editorState[role].active);
                if (activeRole) {
                    mobileSelect.value = activeRole;
                }
            }

            // Update editor pane status indicators
            Object.keys(editorState).forEach(roleId => {
                const status = document.getElementById(`status-${roleId}`);
                if (status) {
                    const role = editorState[roleId];
                    status.textContent = role.isDirty ? '●' : '✓';
                    status.style.color = role.isDirty ? '#ff9800' : '#4caf50';
                }
            });
        },

        /**
         * Export CSS for a role
         */
        exportRole(roleId) {
            const role = editorState[roleId];
            if (!role) return;

            try {
                const content = role.content || '';
                const blob = new Blob([content], { type: 'text/css' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `css_template_${roleId}.css`;
                a.click();
                URL.revokeObjectURL(url);

                context.UI.showMessage(`Exported ${role.label}`, 'success');
            } catch (error) {
                context.UI.showMessage(`Failed to export: ${error.message}`, 'error');
            }
        },

        /**
         * Discard all changes (revert to original)
         * Uses inline confirmation
         */
        discardAll() {
            console.log('[CSS Editor] discardAll called');

            if (Object.keys(originalContent).length === 0) {
                context.UI.showMessage('No original content to revert to', 'error');
                return;
            }

            // Check if any editors have unsaved changes
            const hasUnsavedChanges = Object.values(editorState).some(role => role.isDirty);
            const discardBtn = document.getElementById('discard-btn');

            console.log('[CSS Editor] discardAll - hasUnsavedChanges:', hasUnsavedChanges);
            console.log('[CSS Editor] discardAll - discardBtn:', discardBtn);
            console.log('[CSS Editor] discardAll - discardBtn.classList:', discardBtn?.classList);

            if (hasUnsavedChanges) {
                if (discardBtn && !discardBtn.classList.contains('confirming')) {
                    console.log('[CSS Editor] discardAll - Showing inline confirmation');
                    // Show inline confirmation
                    context.UI.showInlineConfirmation(discardBtn, () => {
                        this.performDiscardAll();
                    });
                } else {
                    console.log('[CSS Editor] discardAll - Button already confirming or not found');
                }
                return;
            }

            // No unsaved changes - show "no changes" message
            if (discardBtn && !discardBtn.classList.contains('showing-no-changes')) {
                console.log('[CSS Editor] discardAll - Showing no changes message');
                context.UI.showNoChangesMessage(discardBtn);
            }
        },

        /**
         * Actually perform discard all (after confirmation)
         */
        performDiscardAll() {
            console.log('[CSS Editor] performDiscardAll executing');

            // Revert all state to original content
            Object.keys(editorState).forEach(roleId => {
                editorState[roleId].content = originalContent[roleId] || '';
                editorState[roleId].isDirty = false;

                // If editor is active, update its content
                const editor = monacoEditors[roleId];
                if (editor) {
                    editor.setValue(editorState[roleId].content);
                }
            });

            this.updateToggleButtons();

            // Check if all editors are now clean - if so, clear app state
            const allClean = Object.values(editorState).every(s => !s.isDirty);
            if (allClean) {
                console.log('[CSS Editor] All editors clean, clearing app state');
                context.Storage.clearAppState(this.id);
            } else {
                this.saveState();
            }

            // Close dropdown menu
            const dropdownMenu = document.getElementById('save-dropdown-menu');
            if (dropdownMenu) dropdownMenu.classList.remove('show');
            const dropdown = document.querySelector('.save-dropdown');
            if (dropdown) dropdown.classList.remove('open');

            context.UI.showMessage('All changes discarded', 'success');
        },

        /**
         * Revert a single role (with inline confirmation)
         */
        revertRole(roleId) {
            console.log(`[CSS Editor] revertRole called for: ${roleId}`);

            const role = editorState[roleId];
            if (!role) return;

            // Check if editor has unsaved changes
            const revertBtn = document.querySelector(`[data-revert-role="${roleId}"]`);
            if (!revertBtn) return;

            if (role.isDirty) {
                if (!revertBtn.classList.contains('confirming')) {
                    // Show inline confirmation
                    context.UI.showInlineConfirmation(revertBtn, () => {
                        this.performRevert(roleId);
                    });
                }
                return;
            }

            // No unsaved changes - show "no changes" message
            if (!revertBtn.classList.contains('showing-no-changes')) {
                context.UI.showNoChangesMessage(revertBtn);
            }
        },

        /**
         * Actually perform revert (after confirmation)
         */
        performRevert(roleId) {
            console.log(`[CSS Editor] performRevert executing for: ${roleId}`);

            const role = editorState[roleId];
            if (!role) return;

            // Revert content to original
            role.content = originalContent[roleId] || '';
            role.isDirty = false;

            // If editor is active, update its content
            const editor = monacoEditors[roleId];
            if (editor) {
                editor.setValue(role.content);
            }

            this.updateToggleButtons();

            // Check if all editors are now clean - if so, clear app state
            const allClean = Object.values(editorState).every(s => !s.isDirty);
            if (allClean) {
                console.log('[CSS Editor] All editors clean, clearing app state');
                context.Storage.clearAppState(this.id);
            } else {
                this.saveState();
            }

            // Close dropdown menu
            const menu = document.querySelector(`[data-menu-role="${roleId}"]`);
            if (menu) menu.classList.remove('show');

            context.UI.showMessage(`${role.label} reverted`, 'success');
        },

        /**
         * Toggle editor dropdown menu
         */
        toggleEditorDropdown(roleId) {
            const menu = document.querySelector(`[data-menu-role="${roleId}"]`);
            if (!menu) return;

            // Close all other editor dropdowns AND the global dropdown
            document.querySelectorAll('.editor-save-dropdown-menu.show').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });
            const globalDropdown = document.getElementById('save-dropdown-menu');
            if (globalDropdown) globalDropdown.classList.remove('show');

            menu.classList.toggle('show');
        },

        /**
         * Save a single CSS role
         */
        async saveRole(roleId) {
            try {
                console.log(`[CSS Editor] Saving ${roleId}...`);

                const role = editorState[roleId];
                if (!role) {
                    throw new Error(`Role ${roleId} not found`);
                }

                // Sync this editor's value to state
                const editor = monacoEditors[roleId];
                if (editor) {
                    role.content = editor.getValue();
                }

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
                    context.UI.showMessage(`${role.label} saved successfully!`, 'success');

                    // Update original content for this role only
                    originalContent[roleId] = role.content;
                    role.isDirty = false;

                    this.updateToggleButtons();

                    // Persist updated state to localStorage
                    this.saveState();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error(`[CSS Editor] Save ${roleId} failed:`, error);
                context.UI.showMessage(`Failed to save: ${error.message}`, 'error');
            }
        },

        /**
         * Save all CSS
         */
        async saveAll() {
            try {
                console.log('[CSS Editor] Saving all CSS...');

                // Sync editor values to state
                Object.keys(monacoEditors).forEach(roleId => {
                    const editor = monacoEditors[roleId];
                    if (editor) {
                        editorState[roleId].content = editor.getValue();
                    }
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
                    context.UI.showMessage('CSS saved successfully!', 'success');

                    // Update original content
                    Object.keys(editorState).forEach(roleId => {
                        originalContent[roleId] = editorState[roleId].content;
                        editorState[roleId].isDirty = false;
                    });

                    this.updateToggleButtons();

                    // Persist updated state to localStorage
                    this.saveState();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error('[CSS Editor] Save failed:', error);
                context.UI.showMessage('Failed to save CSS: ' + error.message, 'error');
            }
        },

        /**
         * Save only the currently open tabs
         */
        async saveOpenTabs() {
            try {
                const openRoles = Object.keys(editorState).filter(role => editorState[role].active);

                if (openRoles.length === 0) {
                    context.UI.showMessage('No tabs open to save', 'warning');
                    return;
                }

                console.log(`[CSS Editor] Saving ${openRoles.length} open tab(s):`, openRoles);

                // Sync editor values to state for open tabs
                openRoles.forEach(roleId => {
                    const editor = monacoEditors[roleId];
                    if (editor) {
                        editorState[roleId].content = editor.getValue();
                    }
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
                    context.UI.showMessage(`${tabLabel} saved successfully!`, 'success');

                    // Update original content for saved tabs
                    openRoles.forEach(roleId => {
                        originalContent[roleId] = editorState[roleId].content;
                        editorState[roleId].isDirty = false;
                    });

                    this.updateToggleButtons();
                    this.saveState();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error('[CSS Editor] Save open tabs failed:', error);
                context.UI.showMessage('Failed to save: ' + error.message, 'error');
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
            };

            document.addEventListener('keydown', keyboardHandler);
            console.log('[CSS Editor] Keyboard shortcuts registered: Ctrl+S (save open), Ctrl+Shift+S (save all)');
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

            // Debounce 300ms
            livePreviewDebounceTimer = setTimeout(() => {
                this.performLivePreviewUpdate();
                livePreviewDebounceTimer = null;
            }, 300);
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
    // Register App
    // ============================================================================

    // Wait for core to be ready
    const waitForCore = setInterval(() => {
        if (window.ExpertEnhancements && window.ExpertEnhancements.AppManager) {
            clearInterval(waitForCore);
            window.ExpertEnhancements.AppManager.register(CSSEditorApp);
            console.log('[CSS Editor App] Registered');
        }
    }, 100);

})();
