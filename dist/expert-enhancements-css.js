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

    // ============================================================================
    // App Interface Implementation
    // ============================================================================

    const CSSEditorApp = {
        id: 'css-editor',
        name: 'CSS Editor',

        // App-specific constraints for overlay sizing
        constraints: {
            minWidth: 900,
            minHeight: 600
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

            // Build UI
            container.innerHTML = `
                <div class="enhancements-app-container">
                    <div id="message-area"></div>
                    <div id="loading" class="loading" style="display: block;">Loading CSS from system...</div>
                    <div id="css-editor-container" style="display: none;">
                        <div class="toggle-bar" id="toggle-bar"></div>
                        <div id="editors-grid" class="editors-grid"></div>
                    </div>
                </div>
            `;

            // Restore state if available
            const savedState = context.Storage.getAppState(this.id);

            if (savedState) {
                console.log('[CSS Editor] Restoring state:', savedState);
                this.setState(savedState);
            }

            // Load CSS data
            await this.loadData();

            // Build toggle bar
            this.buildToggleBar();

            // Initialize editors - skip default if we have saved state
            const skipDefault = !!savedState;
            console.log('[CSS Editor] Initializing editors, skip default:', skipDefault);
            this.initializeEditors(skipDefault);

            console.log('[CSS Editor] Mounted');
        },

        /**
         * Unmount the app (cleanup)
         */
        async unmount() {
            console.log('[CSS Editor] Unmounting...');

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
            // Recalculate heights and re-layout
            this.updateHeights();
        },

        /**
         * Get current state for persistence
         */
        getState() {
            const state = {
                activeRoles: Object.keys(editorState).filter(role => editorState[role].active),
                content: {},
                isDirty: {}
            };

            Object.keys(editorState).forEach(role => {
                const roleState = editorState[role];
                state.content[role] = roleState.content;
                state.isDirty[role] = roleState.isDirty;
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
        },

        /**
         * Load CSS data from API
         */
        async loadData() {
            try {
                const url = '/deki/cp/custom_css.php?params=%2F';
                const response = await context.API.fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const html = await response.text();
                const { doc, data } = context.API.parseFormHTML(html);

                // Extract CSRF token
                csrfToken = data.csrf_token;

                // Extract CSS from textareas
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
                        // Only update content if role doesn't have unsaved edits
                        // This preserves edited content across page refreshes
                        if (!editorState[roleId].isDirty) {
                            editorState[roleId].content = content;
                        }
                        // Always update originalContent with server state
                        originalContent[roleId] = content;
                    }
                });

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
         * Build toggle bar with role buttons
         */
        buildToggleBar() {
            const toggleBar = document.getElementById('toggle-bar');
            if (!toggleBar) return;

            toggleBar.innerHTML = '';

            // Create role buttons
            ROLE_CONFIG.forEach(({ id, label }) => {
                const btn = context.DOM.create('button', {
                    className: 'toggle-btn',
                    'data-role': id
                }, [label]);

                btn.addEventListener('click', (e) => this.toggleEditor(id, e));
                toggleBar.appendChild(btn);
            });

            // Create save/discard buttons
            const buttonGroup = context.DOM.create('div', {
                className: 'save-dropdown',
                style: { display: 'flex', gap: '4px' }
            });

            const saveBtn = context.DOM.create('button', {
                className: 'btn btn-primary',
                id: 'save-btn'
            }, ['Save All']);
            saveBtn.addEventListener('click', () => this.saveAll());

            const discardBtn = context.DOM.create('button', {
                className: 'btn btn-secondary',
                id: 'discard-btn',
                style: {
                    background: '#dc3545',
                    color: 'white',
                    border: '1px solid #dc3545'
                }
            }, ['Discard All']);
            discardBtn.addEventListener('click', () => this.discardAll());

            buttonGroup.appendChild(saveBtn);
            buttonGroup.appendChild(discardBtn);
            toggleBar.appendChild(buttonGroup);

            this.updateToggleButtons();
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
                style: { display: 'flex', gap: '0.5rem' }
            });

            const saveBtn = context.DOM.create('button', {
                className: 'pane-btn pane-btn-save',
                title: 'Save',
                style: {
                    background: '#28a745',
                    border: '1px solid #28a745',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                }
            }, ['Save']);
            saveBtn.addEventListener('click', () => this.saveRole(roleId));

            const exportBtn = context.DOM.create('button', {
                className: 'pane-btn',
                title: 'Export',
                style: {
                    background: 'transparent',
                    border: '1px solid #555',
                    color: '#ccc',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                }
            }, ['Export']);
            exportBtn.addEventListener('click', () => this.exportRole(roleId));

            const discardBtn = context.DOM.create('button', {
                className: 'pane-btn',
                title: 'Discard',
                style: {
                    background: 'transparent',
                    border: '1px solid #555',
                    color: '#dc3545',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                }
            }, ['Discard']);
            discardBtn.addEventListener('click', () => this.discardRole(roleId));

            actions.appendChild(saveBtn);
            actions.appendChild(exportBtn);
            actions.appendChild(discardBtn);

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
         */
        async discardAll() {
            const confirmed = await context.UI.confirm(
                'Discard all changes and revert to last saved state?',
                { confirmText: 'Discard', cancelText: 'Cancel', type: 'danger' }
            );

            if (!confirmed) {
                return;
            }

            Object.keys(editorState).forEach(roleId => {
                editorState[roleId].content = originalContent[roleId] || '';
                editorState[roleId].isDirty = false;

                const editor = monacoEditors[roleId];
                if (editor) {
                    editor.setValue(editorState[roleId].content);
                }
            });

            this.updateToggleButtons();
            context.UI.showMessage('All changes discarded', 'success');
        },

        /**
         * Discard changes for a specific role
         */
        async discardRole(roleId) {
            const role = editorState[roleId];
            if (!role) return;

            const confirmed = await context.UI.confirm(
                `Discard changes to ${role.label}?`,
                { confirmText: 'Discard', cancelText: 'Cancel', type: 'danger' }
            );

            if (!confirmed) {
                return;
            }

            role.content = originalContent[roleId] || '';
            role.isDirty = false;

            const editor = monacoEditors[roleId];
            if (editor) {
                editor.setValue(role.content);
            }

            this.updateToggleButtons();
            context.UI.showMessage(`${role.label} reverted`, 'success');
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
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error('[CSS Editor] Save failed:', error);
                context.UI.showMessage('Failed to save CSS: ' + error.message, 'error');
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
