/**
 * CXone Expert Enhancements - HTML Editor App
 *
 * Manages custom HTML head and tail content.
 *
 * @version 1.0.0
 */

(function() {
    'use strict';

    console.log('[HTML Editor App] Loading...');

    // ============================================================================
    // State & Configuration
    // ============================================================================

    const FIELD_CONFIG = [
        { id: 'head', label: 'Page HTML Head' },
        { id: 'tail', label: 'Page HTML Tail' }
    ];

    const MAX_ACTIVE_EDITORS = 2;

    let context = null;
    let editorState = {};
    let originalContent = {};
    let csrfToken = '';
    let monacoEditors = {};

    // ============================================================================
    // App Interface Implementation
    // ============================================================================

    const HTMLEditorApp = {
        id: 'html-editor',
        name: 'HTML Editor',

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
                    <div id="loading" class="loading" style="display: block;">Loading HTML from system...</div>
                    <div id="html-editor-container" style="display: none;">
                        <div class="toggle-bar" id="toggle-bar"></div>
                        <div id="editors-grid" class="editors-grid"></div>
                    </div>
                </div>
            `;

            // Restore state if available
            const savedState = context.Storage.getAppState(this.id);

            if (savedState) {
                console.log('[HTML Editor] Restoring state:', savedState);
                this.setState(savedState);
            }

            // Load HTML data
            await this.loadData();

            // Build toggle bar
            this.buildToggleBar();

            // Initialize editors - skip default if we have saved state
            const skipDefault = !!savedState;
            console.log('[HTML Editor] Initializing editors, skip default:', skipDefault);
            this.initializeEditors(skipDefault);

            console.log('[HTML Editor] Mounted');
        },

        /**
         * Unmount the app (cleanup)
         */
        async unmount() {
            console.log('[HTML Editor] Unmounting...');

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
            // Recalculate heights and re-layout
            this.updateHeights();
        },

        /**
         * Get current state for persistence
         */
        getState() {
            const state = {
                activeFields: Object.keys(editorState).filter(field => editorState[field].active),
                content: {},
                isDirty: {}
            };

            Object.keys(editorState).forEach(field => {
                const fieldState = editorState[field];
                state.content[field] = fieldState.content;
                state.isDirty[field] = fieldState.isDirty;
            });

            return state;
        },

        /**
         * Restore state
         */
        setState(state) {
            if (!state) return;

            // Restore active fields
            if (state.activeFields) {
                state.activeFields.forEach(field => {
                    if (editorState[field]) {
                        editorState[field].active = true;
                    }
                });
            }

            // Restore content
            if (state.content) {
                Object.keys(state.content).forEach(field => {
                    if (editorState[field]) {
                        editorState[field].content = state.content[field];
                    }
                });
            }

            // Restore dirty state
            if (state.isDirty) {
                Object.keys(state.isDirty).forEach(field => {
                    if (editorState[field]) {
                        editorState[field].isDirty = state.isDirty[field];
                    }
                });
            }
        },

        /**
         * Load HTML data from API
         */
        async loadData() {
            try {
                const url = '/deki/cp/custom_html.php?params=%2F';
                const response = await context.API.fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const html = await response.text();
                const { doc, data } = context.API.parseFormHTML(html);

                // Extract CSRF token
                csrfToken = data.csrf_token;

                // Extract HTML from textareas
                const textareas = {
                    'html_template_head': 'head',
                    'html_template_tail': 'tail'
                };

                Object.entries(textareas).forEach(([name, fieldId]) => {
                    const textarea = doc.querySelector(`textarea[name="${name}"]`);
                    if (textarea) {
                        const content = textarea.textContent;
                        // Only update content if field doesn't have unsaved edits
                        // This preserves edited content across page refreshes
                        if (!editorState[fieldId].isDirty) {
                            editorState[fieldId].content = content;
                        }
                        // Always update originalContent with server state
                        originalContent[fieldId] = content;
                    }
                });

                // Hide loading, show editor
                document.getElementById('loading').style.display = 'none';
                document.getElementById('html-editor-container').style.display = 'block';

                console.log('[HTML Editor] Data loaded');

            } catch (error) {
                console.error('[HTML Editor] Failed to load data:', error);
                context.UI.showMessage('Failed to load HTML: ' + error.message, 'error');
            }
        },

        /**
         * Build toggle bar with field buttons
         */
        buildToggleBar() {
            const toggleBar = document.getElementById('toggle-bar');
            if (!toggleBar) return;

            toggleBar.innerHTML = '';

            // Create field buttons
            FIELD_CONFIG.forEach(({ id, label }) => {
                const btn = context.DOM.create('button', {
                    className: 'toggle-btn',
                    'data-field': id
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
                    if (activeCount >= MAX_ACTIVE_EDITORS) {
                        context.UI.showMessage(`Maximum ${MAX_ACTIVE_EDITORS} editors can be open at once`, 'error');
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
         * Save current state to storage
         */
        saveState() {
            const state = this.getState();
            context.Storage.setAppState(this.id, state);
            console.log('[HTML Editor] State saved:', state);
        },

        /**
         * Update editors grid
         */
        updateGrid() {
            const grid = document.getElementById('editors-grid');
            if (!grid) return;

            const activeFields = Object.keys(editorState).filter(field => editorState[field].active);

            grid.innerHTML = '';
            grid.className = 'editors-grid cols-' + activeFields.length;

            activeFields.forEach(fieldId => {
                const pane = this.createEditorPane(fieldId);
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
            const container = document.getElementById('html-editor-container');
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
         * Create editor pane for a field
         */
        createEditorPane(fieldId) {
            const field = editorState[fieldId];

            const pane = context.DOM.create('div', { className: 'editor-pane' });
            const header = context.DOM.create('div', { className: 'editor-pane-header' });

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
            saveBtn.addEventListener('click', () => this.saveField(fieldId));

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
            exportBtn.addEventListener('click', () => this.exportField(fieldId));

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
            discardBtn.addEventListener('click', () => this.discardField(fieldId));

            actions.appendChild(saveBtn);
            actions.appendChild(exportBtn);
            actions.appendChild(discardBtn);

            header.appendChild(titleGroup);
            header.appendChild(actions);
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
         * Create Monaco editor instance
         */
        createMonacoEditor(fieldId, container) {
            const field = editorState[fieldId];
            const monaco = context.Monaco.get();

            // Create editor immediately (CSS now properly sizes containers)
            const editor = monaco.editor.create(container, {
                value: field.content || '',
                language: 'html',
                theme: 'vs-dark',
                automaticLayout: false,
                minimap: { enabled: true },
                fontSize: 14,
                wordWrap: 'on',
                scrollBeyondLastLine: false
            });

            monacoEditors[fieldId] = editor;

            // Track changes
            editor.onDidChangeModelContent(() => {
                field.content = editor.getValue();
                field.isDirty = field.content !== originalContent[fieldId];
                this.updateToggleButtons();
            });

            console.log(`[HTML Editor] Created Monaco editor for: ${fieldId}`);
        },

        /**
         * Initialize editors (activate default if none active)
         */
        initializeEditors(skipDefault = false) {
            const hasActive = Object.values(editorState).some(f => f.active);

            // Only set default if we should not skip and nothing is active
            if (!skipDefault && !hasActive) {
                // Activate 'head' by default
                editorState.head.active = true;
                console.log('[HTML Editor] No saved state, activating default: head');
            } else {
                console.log('[HTML Editor] Skipping default activation, skipDefault:', skipDefault, 'hasActive:', hasActive);
            }

            this.updateGrid();
        },

        /**
         * Update toggle button states and pane status indicators
         */
        updateToggleButtons() {
            const buttons = document.querySelectorAll('.toggle-btn');

            buttons.forEach(btn => {
                const fieldId = btn.getAttribute('data-field');
                const field = editorState[fieldId];

                if (field && field.active) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }

                // Show dirty indicator
                if (field && field.isDirty) {
                    btn.style.fontWeight = 'bold';
                    btn.style.color = '#ff9800';
                } else {
                    btn.style.fontWeight = '';
                    btn.style.color = '';
                }
            });

            // Update editor pane status indicators
            Object.keys(editorState).forEach(fieldId => {
                const status = document.getElementById(`status-${fieldId}`);
                if (status) {
                    const field = editorState[fieldId];
                    status.textContent = field.isDirty ? '●' : '✓';
                    status.style.color = field.isDirty ? '#ff9800' : '#4caf50';
                }
            });
        },

        /**
         * Export HTML for a field
         */
        exportField(fieldId) {
            const field = editorState[fieldId];
            if (!field) return;

            try {
                const content = field.content || '';
                const blob = new Blob([content], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `html_template_${fieldId}.html`;
                a.click();
                URL.revokeObjectURL(url);

                context.UI.showMessage(`Exported ${field.label}`, 'success');
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

            Object.keys(editorState).forEach(fieldId => {
                editorState[fieldId].content = originalContent[fieldId] || '';
                editorState[fieldId].isDirty = false;

                const editor = monacoEditors[fieldId];
                if (editor) {
                    editor.setValue(editorState[fieldId].content);
                }
            });

            this.updateToggleButtons();
            context.UI.showMessage('All changes discarded', 'success');
        },

        /**
         * Discard changes for a specific field
         */
        async discardField(fieldId) {
            const field = editorState[fieldId];
            if (!field) return;

            const confirmed = await context.UI.confirm(
                `Discard changes to ${field.label}?`,
                { confirmText: 'Discard', cancelText: 'Cancel', type: 'danger' }
            );

            if (!confirmed) {
                return;
            }

            field.content = originalContent[fieldId] || '';
            field.isDirty = false;

            const editor = monacoEditors[fieldId];
            if (editor) {
                editor.setValue(field.content);
            }

            this.updateToggleButtons();
            context.UI.showMessage(`${field.label} reverted`, 'success');
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

                // Build form data - send all fields but only save changes for this one
                // Other fields use their original content to avoid overwriting
                const formData = {
                    csrf_token: csrfToken,
                    html_template_head: fieldId === 'head' ? field.content : originalContent.head,
                    html_template_tail: fieldId === 'tail' ? field.content : originalContent.tail
                };

                const { body, boundary } = context.API.buildMultipartBody(formData);

                const url = '/deki/cp/custom_html.php?params=%2F';
                const response = await context.API.fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`
                    },
                    body: body
                });

                if (response.ok || response.redirected) {
                    context.UI.showMessage(`${field.label} saved successfully!`, 'success');

                    // Update original content for this field only
                    originalContent[fieldId] = field.content;
                    field.isDirty = false;

                    this.updateToggleButtons();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error(`[HTML Editor] Save ${fieldId} failed:`, error);
                context.UI.showMessage(`Failed to save: ${error.message}`, 'error');
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
                        'Content-Type': `multipart/form-data; boundary=${boundary}`
                    },
                    body: body
                });

                if (response.ok || response.redirected) {
                    context.UI.showMessage('HTML saved successfully!', 'success');

                    // Update original content
                    Object.keys(editorState).forEach(fieldId => {
                        originalContent[fieldId] = editorState[fieldId].content;
                        editorState[fieldId].isDirty = false;
                    });

                    this.updateToggleButtons();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (error) {
                console.error('[HTML Editor] Save failed:', error);
                context.UI.showMessage('Failed to save HTML: ' + error.message, 'error');
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
            window.ExpertEnhancements.AppManager.register(HTMLEditorApp);
            console.log('[HTML Editor App] Registered');
        }
    }, 100);

})();
