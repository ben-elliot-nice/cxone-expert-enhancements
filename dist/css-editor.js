console.log('[CSS Editor] Script loaded, preparing Monaco initialization');

// Create an isolated scope for Monaco to avoid AMD conflicts
// We'll temporarily hide AMD only when Monaco's loader script executes
(function() {
    const originalDefine = window.define;
    const originalRequire = window.require;

    console.log('[CSS Editor] Temporarily hiding AMD for Monaco loader');
    delete window.define;
    delete window.require;

    // Load Monaco loader script
    const loaderScript = document.createElement('script');
    loaderScript.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js';
    loaderScript.onload = () => {
        console.log('[CSS Editor] Monaco loader loaded, restoring page AMD');
        // Immediately restore the page's AMD after Monaco loader loads
        // Monaco has its own require/define now in a different scope
        if (originalDefine) window.define = originalDefine;
        if (originalRequire) window.require = originalRequire;

        // Store Monaco's require separately before page AMD overwrites it
        window.monacoRequire = require;
        console.log('[CSS Editor] Page AMD restored, Monaco require stored separately');
    };
    loaderScript.onerror = () => {
        console.error('[CSS Editor] Failed to load Monaco loader');
        // Restore AMD even on error
        if (originalDefine) window.define = originalDefine;
        if (originalRequire) window.require = originalRequire;
    };
    document.head.appendChild(loaderScript);
})();

// State management for editors
const editorState = {
    all: { active: false, editor: null, content: '', label: 'All Roles', isDirty: false },
    anonymous: { active: false, editor: null, content: '', label: 'Anonymous', isDirty: false },
    viewer: { active: false, editor: null, content: '', label: 'Community Member', isDirty: false },
    seated: { active: false, editor: null, content: '', label: 'Pro Member', isDirty: false },
    admin: { active: false, editor: null, content: '', label: 'Admin', isDirty: false },
    grape: { active: false, editor: null, content: '', label: 'Legacy Browser', isDirty: false }
};

// Expose to window for embed script access
window.editorState = editorState;

const MAX_ACTIVE_EDITORS = 3;
let csrfToken = '';
let monacoReady = false;
let linterReady = false;
let originalContent = {}; // Store original CSS from API
let isMobileView = false; // Track if we're in mobile view (< 1080px)
let saveToLocalStorageDebounceTimer = null; // Debounce timer for localStorage saves
let livePreviewStyleTag = null; // Style tag for live CSS preview injection
let livePreviewDebounceTimer = null; // Debounce timer for live preview updates
// Note: Live preview flag is now stored in window.cssEditorEnableLivePreview (controlled by overlay toggle button)

function getActiveCount() {
    return Object.values(editorState).filter(s => s.active).length;
}

function saveActiveEditors() {
    const activeRoles = Object.keys(editorState).filter(role => editorState[role].active);
    try {
        localStorage.setItem('cssEditorActiveRoles', JSON.stringify(activeRoles));
        console.log('[saveActiveEditors] Saved active roles to localStorage:', activeRoles);
    } catch (error) {
        console.warn('[saveActiveEditors] Failed to save to localStorage:', error);
    }
}

function loadActiveEditors() {
    try {
        const saved = localStorage.getItem('cssEditorActiveRoles');
        if (saved) {
            const activeRoles = JSON.parse(saved);
            console.log('[loadActiveEditors] Loaded active roles from localStorage:', activeRoles);

            // Just activate the roles in state, don't create editors yet
            activeRoles.forEach(role => {
                if (editorState[role] && getActiveCount() < MAX_ACTIVE_EDITORS) {
                    editorState[role].active = true;
                    console.log(`[loadActiveEditors] Marked ${role} as active`);
                }
            });

            return activeRoles.length;
        }
    } catch (error) {
        console.warn('[loadActiveEditors] Failed to load from localStorage:', error);
    }
    return 0;
}

function saveCSSToLocalStorage() {
    try {
        const data = {
            modified: {},
            original: {}
        };
        Object.keys(editorState).forEach(role => {
            data.modified[role] = editorState[role].content;
            data.original[role] = originalContent[role];
        });
        localStorage.setItem('cssEditorContent', JSON.stringify(data));
        console.log('[saveCSSToLocalStorage] Saved CSS content and original baseline to localStorage');
    } catch (error) {
        console.warn('[saveCSSToLocalStorage] Failed to save to localStorage:', error);
    }
}

function debouncedSaveCSSToLocalStorage() {
    // Clear existing timer
    if (saveToLocalStorageDebounceTimer) {
        clearTimeout(saveToLocalStorageDebounceTimer);
    }

    // Set new timer - save after 500ms of inactivity
    saveToLocalStorageDebounceTimer = setTimeout(() => {
        saveCSSToLocalStorage();
        saveToLocalStorageDebounceTimer = null;
    }, 500);
}

function loadCSSFromLocalStorage() {
    try {
        const saved = localStorage.getItem('cssEditorContent');
        if (saved) {
            const data = JSON.parse(saved);

            // Handle legacy format (plain object) or new format (modified/original)
            if (data.modified && data.original) {
                console.log('[loadCSSFromLocalStorage] Found CSS content with original baseline in localStorage');
                return data;
            } else {
                // Legacy format - treat as modified content only
                console.log('[loadCSSFromLocalStorage] Found legacy CSS content in localStorage (no baseline)');
                return { modified: data, original: null };
            }
        }
    } catch (error) {
        console.warn('[loadCSSFromLocalStorage] Failed to load from localStorage:', error);
    }
    return null;
}

function clearCSSFromLocalStorage() {
    try {
        localStorage.removeItem('cssEditorContent');
        console.log('[clearCSSFromLocalStorage] Cleared CSS content from localStorage');
    } catch (error) {
        console.warn('[clearCSSFromLocalStorage] Failed to clear localStorage:', error);
    }
}

/**
 * Initialize or get the live preview style tag
 */
function getLivePreviewStyleTag() {
    if (!livePreviewStyleTag) {
        livePreviewStyleTag = document.createElement('style');
        livePreviewStyleTag.id = 'css-editor-live-preview';
        livePreviewStyleTag.setAttribute('data-source', 'CSS Editor Live Preview');
        document.head.appendChild(livePreviewStyleTag);
        console.log('[getLivePreviewStyleTag] Created live preview style tag');
    }
    return livePreviewStyleTag;
}

/**
 * Update live CSS preview in the page (debounced)
 */
function updateLivePreview() {
    // Check the dynamic flag (can be toggled by overlay button)
    const isEnabled = window.cssEditorEnableLivePreview || false;

    // Only update if live preview is enabled
    if (!isEnabled) {
        console.log('[updateLivePreview] Live preview disabled, skipping');
        return;
    }

    console.log('[updateLivePreview] Scheduling live preview update');

    // Clear existing timer
    if (livePreviewDebounceTimer) {
        clearTimeout(livePreviewDebounceTimer);
    }

    // Set new timer - update after 300ms of inactivity
    livePreviewDebounceTimer = setTimeout(() => {
        performLivePreviewUpdate();
        livePreviewDebounceTimer = null;
    }, 300);
}

/**
 * Actually perform the live preview update
 */
function performLivePreviewUpdate() {
    try {
        const styleTag = getLivePreviewStyleTag();

        // Get the selected preview role (defaults to 'anonymous')
        const selectedRole = window.cssEditorPreviewRole || 'anonymous';
        console.log('[performLivePreviewUpdate] Preview role:', selectedRole);

        // Build CSS combination based on selected role
        // Rules:
        // - anonymous: all + anonymous
        // - viewer (community): all + viewer
        // - seated (pro): all + seated
        // - admin: all + seated + admin
        // - grape (legacy): all + grape
        let combinedCSS = '';
        const rolesToInclude = [];

        // All roles get "all"
        rolesToInclude.push('all');

        // Add specific roles based on selection
        if (selectedRole === 'anonymous') {
            rolesToInclude.push('anonymous');
        } else if (selectedRole === 'viewer') {
            rolesToInclude.push('viewer');
        } else if (selectedRole === 'seated') {
            rolesToInclude.push('seated');
        } else if (selectedRole === 'admin') {
            // Admins inherit pro (seated) permissions
            rolesToInclude.push('seated');
            rolesToInclude.push('admin');
        } else if (selectedRole === 'grape') {
            rolesToInclude.push('grape');
        }

        console.log('[performLivePreviewUpdate] Including roles:', rolesToInclude);

        // Combine CSS in order
        rolesToInclude.forEach(role => {
            const state = editorState[role];
            if (state && state.content && state.content.trim()) {
                combinedCSS += `\n/* CSS Editor Preview: ${state.label} */\n`;
                combinedCSS += state.content;
                combinedCSS += '\n';
            }
        });

        styleTag.textContent = combinedCSS;
        console.log(`[performLivePreviewUpdate] Updated live preview: ${combinedCSS.length} characters for role "${selectedRole}"`);
    } catch (error) {
        console.warn('[performLivePreviewUpdate] Failed to update live preview:', error);
    }
}

/**
 * Clear live preview CSS
 */
function clearLivePreview() {
    if (livePreviewStyleTag) {
        livePreviewStyleTag.textContent = '';
        console.log('[clearLivePreview] Cleared live preview');
    }
}

// Expose functions for embed script
window.updateLivePreview = updateLivePreview;
window.clearLivePreview = clearLivePreview;


function updateToggleButtons() {
    const activeCount = getActiveCount();

    // Update regular toggle buttons (desktop view)
    Object.keys(editorState).forEach(role => {
        const btn = document.querySelector(`.toggle-btn[data-role="${role}"]`);
        if (!btn) return;

        const state = editorState[role];

        // Remove all state classes
        btn.classList.remove('active', 'disabled');

        if (state.active) {
            btn.classList.add('active');
        } else if (activeCount >= MAX_ACTIVE_EDITORS) {
            btn.classList.add('disabled');
        }
    });

    // Update mobile dropdown selector if it exists
    const mobileSelect = document.getElementById('mobile-editor-select');
    if (mobileSelect) {
        let activeRole = Object.keys(editorState).find(role => editorState[role].active);

        // If no active role, activate the first one and render it
        if (!activeRole) {
            activeRole = Object.keys(editorState)[0];
            editorState[activeRole].active = true;
            // Render the editor after activation
            setTimeout(() => {
                updateGrid();
                saveActiveEditors();
            }, 0);
        }

        // Update option text to reflect current status icons
        const options = mobileSelect.querySelectorAll('option[data-role]');
        options.forEach(option => {
            const role = option.getAttribute('data-role');
            if (role && editorState[role]) {
                const state = editorState[role];
                const statusIcon = state.isDirty ? '● ' : '✓ ';
                option.textContent = statusIcon + state.label;
            }
        });

        mobileSelect.value = activeRole;
    }
}

function checkViewportWidth() {
    const wasMobileView = isMobileView;

    // Check if we're in overlay mode (inside #css-editor-overlay)
    const editorApp = document.getElementById('css-editor-app');
    const isInOverlay = editorApp && editorApp.closest('#css-editor-overlay');

    if (isInOverlay) {
        // In overlay mode - use overlay width
        const overlay = document.getElementById('css-editor-overlay');
        if (overlay) {
            isMobileView = overlay.offsetWidth < 1080;
            console.log(`[checkViewportWidth] Overlay mode: width=${overlay.offsetWidth}px, mobile=${isMobileView}`);
        }
    } else {
        // Standard page mode - use window width
        isMobileView = window.innerWidth < 1080;
        console.log(`[checkViewportWidth] Page mode: width=${window.innerWidth}px, mobile=${isMobileView}`);
    }

    // If view mode changed, rebuild the toggle bar
    if (wasMobileView !== isMobileView) {
        console.log(`[checkViewportWidth] View mode changed to ${isMobileView ? 'mobile' : 'desktop'}`);
        rebuildToggleBar();

        // If switching to mobile and multiple editors are active, keep only leftmost
        if (isMobileView) {
            const activeRoles = Object.keys(editorState).filter(role => editorState[role].active);
            if (activeRoles.length > 1) {
                console.log(`[checkViewportWidth] Multiple editors active in mobile view, keeping only: ${activeRoles[0]}`);
                // Deactivate all except the first
                activeRoles.slice(1).forEach(role => {
                    const state = editorState[role];
                    if (state.editor) {
                        state.content = state.editor.getValue();
                        state.editor.dispose();
                        state.editor = null;
                    }
                    state.active = false;
                });
                updateGrid();
                saveActiveEditors();
            }
        }
        updateToggleButtons();
    }

    return isMobileView;
}
window.checkViewportWidth = checkViewportWidth;

function rebuildToggleBar() {
    console.log(`[rebuildToggleBar] Rebuilding toggle bar for ${isMobileView ? 'mobile' : 'desktop'} view`);
    const toggleBar = document.querySelector('.toggle-bar');
    if (!toggleBar) return;

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

        // Add options for each editor with status icons
        Object.keys(editorState).forEach(role => {
            const state = editorState[role];
            const option = document.createElement('option');
            option.value = role;
            const statusIcon = state.isDirty ? '● ' : '✓ ';
            option.textContent = statusIcon + state.label;
            option.setAttribute('data-role', role);
            select.appendChild(option);
        });

        // Set current selection - respect already active editor from localStorage
        let activeRole = Object.keys(editorState).find(role => editorState[role].active);

        // Only activate first editor if truly no active editors exist
        if (!activeRole) {
            const firstRole = Object.keys(editorState)[0];
            editorState[firstRole].active = true;
            activeRole = firstRole;
            console.log(`[rebuildToggleBar] No active editor found, activating first: ${activeRole}`);
            // Need to render the editor
            setTimeout(() => {
                updateGrid();
                saveActiveEditors();
            }, 0);
        } else {
            console.log(`[rebuildToggleBar] Using existing active editor: ${activeRole}`);
        }

        select.value = activeRole;

        // Add change listener
        select.addEventListener('change', (e) => {
            handleMobileEditorChange(e.target.value);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);

        // Insert at the beginning of toggle bar
        const firstChild = toggleBar.firstChild;
        toggleBar.insertBefore(wrapper, firstChild);
    } else {
        // Create desktop toggle buttons
        const roles = [
            { role: 'all', label: 'All Roles' },
            { role: 'anonymous', label: 'Anonymous' },
            { role: 'viewer', label: 'Community Member' },
            { role: 'seated', label: 'Pro Member' },
            { role: 'admin', label: 'Admin' },
            { role: 'grape', label: 'Legacy Browser' }
        ];

        roles.forEach(({ role, label }) => {
            const btn = document.createElement('button');
            btn.className = 'toggle-btn';
            btn.setAttribute('data-role', role);
            btn.textContent = label;
            btn.addEventListener('click', (e) => {
                // Desktop behavior:
                // - Regular click: Open solo (close all others)
                // - Ctrl+click: Toggle split view (add/remove from active set)
                if (e.ctrlKey || e.metaKey) {
                    // Ctrl+click: Toggle this editor in split view
                    toggleEditor(role);
                } else {
                    // Regular click: Open solo (close all others, open this one)
                    openEditorSolo(role);
                }
            });

            // Insert before the save dropdown
            const saveDropdown = toggleBar.querySelector('.save-dropdown');
            toggleBar.insertBefore(btn, saveDropdown);
        });
    }

    updateToggleButtons();
}

function handleMobileEditorChange(newRole) {
    console.log(`[handleMobileEditorChange] Selected role: ${newRole}`);

    if (!monacoReady) {
        showMessage('Please wait for Monaco Editor to load', 'error');
        return;
    }

    // Get currently active role
    const currentActiveRole = Object.keys(editorState).find(role => editorState[role].active);

    // If selecting the same role, do nothing
    if (newRole === currentActiveRole) {
        return;
    }

    // Deactivate current editor if any
    if (currentActiveRole) {
        const state = editorState[currentActiveRole];
        if (state.editor) {
            state.content = state.editor.getValue();
            state.editor.dispose();
            state.editor = null;
        }
        state.active = false;
    }

    // Activate new editor
    editorState[newRole].active = true;

    updateGrid();
    updateToggleButtons();
    saveActiveEditors();
}

function updateStatusIcon(role) {
    const statusIcon = document.querySelector(`[data-status-role="${role}"]`);
    if (statusIcon) {
        const state = editorState[role];
        if (state.isDirty) {
            statusIcon.textContent = '●';
            statusIcon.className = 'editor-pane-status dirty';
            statusIcon.title = 'Unsaved changes';
        } else {
            statusIcon.textContent = '✓';
            statusIcon.className = 'editor-pane-status saved';
            statusIcon.title = 'Saved';
        }
    }

    // Also update mobile dropdown option for this role
    updateMobileDropdownOption(role);
}

function updateMobileDropdownOption(role) {
    const mobileSelect = document.getElementById('mobile-editor-select');
    if (!mobileSelect) return;

    const option = mobileSelect.querySelector(`option[data-role="${role}"]`);
    if (option && editorState[role]) {
        const state = editorState[role];
        const statusIcon = state.isDirty ? '● ' : '✓ ';
        option.textContent = statusIcon + state.label;
    }
}

function updateGrid() {
    console.log('[updateGrid] Updating editor grid layout');
    const grid = document.getElementById('editors-grid');
    const activeRoles = Object.keys(editorState).filter(role => editorState[role].active);

    console.log('[updateGrid] Active roles:', activeRoles);

    // Save content from existing editors before clearing grid
    activeRoles.forEach(role => {
        const state = editorState[role];
        if (state.editor) {
            state.content = state.editor.getValue();
            console.log(`[updateGrid] Saved content for ${role}: ${state.content.length} chars`);
            // Dispose the old editor since we're clearing the DOM
            state.editor.dispose();
            state.editor = null;
        }
    });

    // Clear existing grid
    grid.innerHTML = '';

    // Update grid class based on active count
    grid.className = 'editors-grid';
    if (activeRoles.length > 0) {
        grid.classList.add(`cols-${Math.min(activeRoles.length, 4)}`);
    }

    // Create editor panes for active roles
    activeRoles.forEach(role => {
        const state = editorState[role];
        const pane = document.createElement('div');
        pane.className = 'editor-pane';
        pane.innerHTML = `
                <div class="editor-pane-header">
                    <div class="editor-pane-title-group">
                        <span class="editor-pane-status ${state.isDirty ? 'dirty' : 'saved'}" data-status-role="${role}" title="${state.isDirty ? 'Unsaved changes' : 'Saved'}">${state.isDirty ? '●' : '✓'}</span>
                        <span class="editor-pane-title">${state.label}</span>
                    </div>
                    <div class="editor-pane-actions">
                        <div class="editor-save-dropdown">
                            <button class="editor-pane-save" data-save-role="${role}">Save</button>
                            <button class="editor-save-dropdown-toggle" data-dropdown-role="${role}">▼</button>
                            <div class="editor-save-dropdown-menu" data-menu-role="${role}">
                                <button class="editor-dropdown-item" data-revert-role="${role}">Revert this</button>
                            </div>
                        </div>
                        <button class="editor-pane-export" data-export-role="${role}">Export</button>
                    </div>
                </div>
                <div id="editor-${role}" class="editor-instance"></div>
            `;
        grid.appendChild(pane);

        // Add click listener to save button
        const saveBtn = pane.querySelector('.editor-pane-save');
        saveBtn.addEventListener('click', () => saveSinglePane(role));

        // Add click listener to dropdown toggle
        const dropdownToggle = pane.querySelector('.editor-save-dropdown-toggle');
        dropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleEditorDropdown(role);
        });

        // Add click listener to revert button
        const revertBtn = pane.querySelector(`[data-revert-role="${role}"]`);
        revertBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent dropdown from closing
            revertSinglePane(role);
        });

        // Add click listener to export button
        const exportBtn = pane.querySelector('.editor-pane-export');
        exportBtn.addEventListener('click', () => exportCSS(role));

        // Always create a fresh Monaco editor
        console.log(`[updateGrid] Creating Monaco editor for ${role}`);
        createMonacoEditor(role);
    });

    console.log('[updateGrid] Grid update complete');

    // If in overlay mode, trigger height recalculation
    const editorApp = document.getElementById('css-editor-app');
    const isInOverlay = editorApp && editorApp.closest('#css-editor-overlay');
    if (isInOverlay && typeof window.cssEditorUpdateHeights === 'function') {
        // Delay slightly to let DOM settle
        setTimeout(() => {
            window.cssEditorUpdateHeights();
        }, 50);
    }
}

function createMonacoEditor(role) {
    console.log(`[createMonacoEditor] Creating editor for ${role}`);

    if (!monacoReady) {
        console.error('[createMonacoEditor] Monaco not ready!');
        return;
    }

    const container = document.getElementById(`editor-${role}`);
    if (!container) {
        console.error(`[createMonacoEditor] Container not found for ${role}`);
        return;
    }

    const state = editorState[role];
    console.log(`[createMonacoEditor] state.content length for ${role}: ${state.content?.length || 0} chars`);

    const editor = monaco.editor.create(container, {
        value: state.content || '',
        language: 'css',
        theme: 'vs-dark',
        automaticLayout: false,
        minimap: { enabled: true },
        fontSize: 14,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        cursorBlinking: 'smooth',
        folding: true,
        bracketPairColorization: {
            enabled: true
        }
    });

    // Initialize CSS Linter if available
    if (linterReady && typeof MonacoCSSLinter !== 'undefined') {
        try {
            console.log(`[createMonacoEditor] Enabling CSS linter for ${role}`);
            new MonacoCSSLinter.CSSLinter(editor, {
                rules: {
                    'color-no-invalid-hex': true,
                    'declaration-block-no-duplicate-properties': true,
                    'no-duplicate-selectors': true,
                    'selector-type-no-unknown': true,
                    'unit-no-unknown': true,
                    'property-no-unknown': true
                }
            });
        } catch (lintError) {
            console.warn(`[createMonacoEditor] Could not enable linter for ${role}:`, lintError);
        }
    }

    // Listen for content changes to update state and dirty flag
    editor.onDidChangeModelContent(() => {
        state.content = editor.getValue();

        // Mark as dirty if content differs from original
        const wasDirty = state.isDirty;
        state.isDirty = state.content !== originalContent[role];

        // Update status icon if dirty state changed
        if (wasDirty !== state.isDirty) {
            updateStatusIcon(role);

            // If this editor just became clean, check if ALL editors are now clean
            if (!state.isDirty) {
                const allClean = Object.values(editorState).every(s => !s.isDirty);
                if (allClean) {
                    console.log(`[createMonacoEditor] Editor ${role} became clean and all editors are clean, clearing localStorage`);
                    // Cancel any pending debounced save
                    if (saveToLocalStorageDebounceTimer) {
                        clearTimeout(saveToLocalStorageDebounceTimer);
                        saveToLocalStorageDebounceTimer = null;
                    }
                    clearCSSFromLocalStorage();
                    return; // Don't save to localStorage since we just cleared it
                }
            }
        }

        // Save to localStorage with debounce (500ms after typing stops)
        debouncedSaveCSSToLocalStorage();

        // Update live preview with debounce (300ms after typing stops)
        updateLivePreview();
    });

    state.editor = editor;
    console.log(`[createMonacoEditor] Editor created for ${role}`);

    // Force layout after a short delay to ensure proper rendering
    setTimeout(() => {
        if (state.editor) {
            state.editor.layout();
            console.log(`[createMonacoEditor] Layout called for ${role}`);
        }
    }, 50);
}

function toggleEditor(role) {
    console.log(`[toggleEditor] Toggling editor: ${role}`);

    if (!monacoReady) {
        console.error('[toggleEditor] Monaco not ready yet!');
        showMessage('Please wait for Monaco Editor to load', 'error');
        return;
    }

    const state = editorState[role];
    const activeCount = getActiveCount();

    if (state.active) {
        // Turn off - save content first
        console.log(`[toggleEditor] Turning off ${role}`);
        if (state.editor) {
            state.content = state.editor.getValue();
            state.editor.dispose();
            state.editor = null;
        }
        state.active = false;
    } else {
        // Turn on - check limit
        if (activeCount >= MAX_ACTIVE_EDITORS) {
            console.log(`[toggleEditor] Max editors reached (${MAX_ACTIVE_EDITORS})`);
            showMessage(`Maximum ${MAX_ACTIVE_EDITORS} editors allowed at once. Turn one off first.`, 'error');
            return;
        }
        console.log(`[toggleEditor] Turning on ${role}`);
        state.active = true;
    }

    updateGrid();
    updateToggleButtons();
    saveActiveEditors();
}
window.toggleEditor = toggleEditor;

/**
 * Open a single editor in full view (close all others)
 */
function openEditorSolo(role) {
    console.log(`[openEditorSolo] Opening ${role} in solo view`);

    if (!monacoReady) {
        console.error('[openEditorSolo] Monaco not ready yet!');
        showMessage('Please wait for Monaco Editor to load', 'error');
        return;
    }

    // Close all other editors first
    Object.keys(editorState).forEach(r => {
        if (r !== role) {
            const state = editorState[r];
            if (state.active) {
                console.log(`[openEditorSolo] Closing ${r}`);
                if (state.editor) {
                    state.content = state.editor.getValue();
                    state.editor.dispose();
                    state.editor = null;
                }
                state.active = false;
            }
        }
    });

    // Open the selected editor if not already open
    const targetState = editorState[role];
    if (!targetState.active) {
        console.log(`[openEditorSolo] Opening ${role}`);
        targetState.active = true;
    }

    updateGrid();
    updateToggleButtons();
    saveActiveEditors();
}
window.openEditorSolo = openEditorSolo;

function exportActiveEditors() {
    console.log('[exportActiveEditors] Exporting all active editors');
    const activeRoles = Object.keys(editorState).filter(role => editorState[role].active);

    if (activeRoles.length === 0) {
        showMessage('No active editors to export', 'error');
        return;
    }

    activeRoles.forEach(role => {
        exportCSS(role);
    });

    showMessage(`Exported ${activeRoles.length} CSS file${activeRoles.length === 1 ? '' : 's'}`, 'success');
}
window.exportActiveEditors = exportActiveEditors;


function showMessage(message, type = 'error') {
    console.log(`[showMessage] ${type.toUpperCase()}: ${message}`);
    const messageArea = document.getElementById('message-area');

    // Check if message already exists
    const existingMessages = messageArea.querySelectorAll('.message');
    for (const existingMsg of existingMessages) {
        const existingText = existingMsg.querySelector('.message-text')?.textContent;
        if (existingText === message && existingMsg.classList.contains(type)) {
            console.log(`[showMessage] Message already displayed, skipping duplicate`);
            return;
        }
    }

    const div = document.createElement('div');
    div.className = 'message ' + type;

    const textSpan = document.createElement('span');
    textSpan.className = 'message-text';
    textSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'message-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close message');
    closeBtn.addEventListener('click', () => {
        div.remove();
    });

    div.appendChild(textSpan);
    div.appendChild(closeBtn);
    messageArea.appendChild(div);

    const autoRemove = setTimeout(() => {
        div.remove();
    }, 5000);

    // Clear timeout if manually closed
    closeBtn.addEventListener('click', () => {
        clearTimeout(autoRemove);
    }, { once: true });
}

function exportCSS(role) {
    console.log(`[exportCSS] Exporting CSS for role: ${role}`);
    try {
        const state = editorState[role];
        // Get content from editor if active, otherwise from state
        const content = state.editor ? state.editor.getValue() : state.content;
        console.log(`[exportCSS] Content length: ${content.length} characters`);
        const blob = new Blob([content], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `css_template_${role}.css`;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`[exportCSS] Export complete for ${role}`);
    } catch (error) {
        console.error(`[exportCSS] Error exporting ${role}:`, error);
        showMessage(`Failed to export ${role}: ${error.message}`, 'error');
    }
}
window.exportCSS = exportCSS;

function parseHTML(html) {
    console.log('[parseHTML] Starting HTML parsing');
    console.log('[parseHTML] HTML length:', html.length);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const cssData = {
        csrf_token: '',
        css: {
            all: '',
            anonymous: '',
            viewer: '',
            seated: '',
            admin: '',
            grape: ''
        }
    };

    // Extract CSRF token
    const csrfInput = doc.querySelector('input[name="csrf_token"]');
    if (csrfInput) {
        cssData.csrf_token = csrfInput.value;
        console.log('[parseHTML] CSRF token found:', cssData.csrf_token.substring(0, 20) + '...');
    } else {
        console.warn('[parseHTML] CSRF token NOT found in HTML');
    }

    // Extract CSS from textareas
    const textareas = {
        'css_template_all': 'all',
        'css_template_anonymous': 'anonymous',
        'css_template_viewer': 'viewer',
        'css_template_seated': 'seated',
        'css_template_admin': 'admin',
        'css_template_grape': 'grape'
    };

    Object.entries(textareas).forEach(([name, key]) => {
        const textarea = doc.querySelector(`textarea[name="${name}"]`);
        if (textarea) {
            cssData.css[key] = textarea.textContent;
            console.log(`[parseHTML] Found ${key} CSS: ${cssData.css[key].length} characters`);
        } else {
            console.warn(`[parseHTML] Textarea "${name}" NOT found`);
        }
    });

    console.log('[parseHTML] Parsing complete. CSS sections found:', Object.keys(cssData.css).filter(k => cssData.css[k].length > 0));
    return cssData;
}

function initializeMonaco(callback) {
    console.log('[initializeMonaco] Loading Monaco Editor');

    // Use Monaco's require (stored separately from page's AMD)
    const monacoReq = window.monacoRequire || window.require;

    if (!monacoReq || typeof monacoReq.config !== 'function') {
        console.error('[initializeMonaco] Monaco require not available!');
        return;
    }

    monacoReq.config({
        paths: {
            vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs'
        }
    });

    monacoReq(['vs/editor/editor.main'], function () {
        console.log('[initializeMonaco] Monaco Editor loaded successfully');
        monacoReady = true;

        // Initialize CSS Linter
        try {
            console.log('[initializeMonaco] Initializing CSS Linter');
            if (typeof MonacoCSSLinter !== 'undefined') {
                // Note: MonacoCSSLinter will be initialized per editor
                linterReady = true;
                console.log('[initializeMonaco] CSS Linter ready');
            } else {
                console.warn('[initializeMonaco] MonacoCSSLinter not available, continuing without linting');
            }
        } catch (error) {
            console.warn('[initializeMonaco] Error initializing CSS Linter:', error);
        }

        if (callback) callback();
    });
}

function initializeEditors(cssData) {
    console.log('[initializeEditors] Starting editor initialization');
    console.log('[initializeEditors] Monaco ready?', monacoReady);

    if (!monacoReady) {
        console.error('[initializeEditors] Monaco not ready yet!');
        return;
    }

    // STEP 1: Load CSS data into state first and store original baseline
    Object.keys(editorState).forEach(role => {
        const state = editorState[role];
        state.content = cssData.css[role] || '';

        // Use provided original baseline if available, otherwise use current content as baseline
        if (cssData.original && cssData.original[role] !== undefined) {
            originalContent[role] = cssData.original[role];
            console.log(`[initializeEditors] Loaded ${role}: ${state.content.length} chars (original baseline: ${originalContent[role].length} chars)`);
        } else {
            originalContent[role] = cssData.css[role] || '';
            console.log(`[initializeEditors] Loaded ${role}: ${state.content.length} chars (using as baseline)`);
        }

        // Calculate initial dirty state by comparing content to original baseline
        state.isDirty = state.content !== originalContent[role];
        console.log(`[initializeEditors] ${role} isDirty: ${state.isDirty}`);
    });

    console.log('[initializeEditors] CSS loaded into state and original content stored');

    // STEP 2: Restore previously active editors from localStorage (just marks them active)
    const restored = loadActiveEditors();
    if (restored > 0) {
        console.log(`[initializeEditors] Restored ${restored} active editor(s) from cache`);
    } else {
        // No cached editors - activate "all" role by default
        console.log('[initializeEditors] No cached editors, activating "all" role by default');
        editorState.all.active = true;
    }

    // STEP 3: Check viewport width to set correct mobile/desktop state
    checkViewportWidth();

    // STEP 4: Build the toggle bar for current viewport (mobile/desktop)
    rebuildToggleBar();

    // STEP 4: Now create the UI with the loaded content
    const activeRoles = Object.keys(editorState).filter(role => editorState[role].active);
    if (activeRoles.length > 0) {
        console.log('[initializeEditors] Creating editors for restored roles:', activeRoles);
        updateGrid();
        updateToggleButtons();
    }

    // STEP 5: Initialize live preview with current content (only if enabled)
    const isLivePreviewEnabled = window.cssEditorEnableLivePreview || false;
    if (isLivePreviewEnabled) {
        performLivePreviewUpdate();
    }
}

async function loadCSS() {
    console.log('[loadCSS] ===== LOAD CSS STARTED =====');

    document.getElementById('loading').style.display = 'block';
    document.getElementById('message-area').innerHTML = '';

    // Check localStorage first
    const localData = loadCSSFromLocalStorage();
    if (localData) {
        console.log('[loadCSS] Found CSS in localStorage, using cached content');

        // If we have original baseline in localStorage, use it. Otherwise fetch from API.
        let apiOriginalContent = localData.original;

        if (!apiOriginalContent) {
            console.log('[loadCSS] No baseline in localStorage, fetching from API');
            try {
                const url = '/deki/cp/custom_css.php?params=%2F';
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'max-age=0'
                    },
                    credentials: 'include'
                });

                if (response.ok) {
                    const html = await response.text();
                    const parsedData = parseHTML(html);
                    csrfToken = parsedData.csrf_token;
                    apiOriginalContent = parsedData.css;
                    console.log('[loadCSS] Fetched baseline and CSRF token from API');
                }
            } catch (error) {
                console.warn('[loadCSS] Failed to fetch from API:', error);
            }
        } else {
            // Still need to fetch CSRF token for saves
            console.log('[loadCSS] Have baseline in localStorage, just fetching CSRF token');
            try {
                const url = '/deki/cp/custom_css.php?params=%2F';
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'max-age=0'
                    },
                    credentials: 'include'
                });

                if (response.ok) {
                    const html = await response.text();
                    const parsedData = parseHTML(html);
                    csrfToken = parsedData.csrf_token;
                    console.log('[loadCSS] CSRF token fetched:', csrfToken?.substring(0, 20) + '...');
                }
            } catch (error) {
                console.warn('[loadCSS] Failed to fetch CSRF token, saves will not work:', error);
            }
        }

        // Create parsedData structure with modified content and original baseline
        const parsedData = {
            csrf_token: csrfToken,
            css: localData.modified,
            original: apiOriginalContent
        };

        // Ensure Monaco is loaded before initializing
        if (!monacoReady) {
            console.log('[loadCSS] Monaco not ready, loading now...');
            await new Promise((resolve) => {
                initializeMonaco(() => {
                    console.log('[loadCSS] Monaco loaded via callback');
                    resolve();
                });
            });
        }

        // Load CSS into state with proper original baseline
        console.log('[loadCSS] Loading CSS from localStorage into state');
        initializeEditors(parsedData);

        document.getElementById('loading').style.display = 'none';
        document.getElementById('editor-container').style.display = 'block';
        console.log('[loadCSS] ===== LOAD CSS COMPLETE (from localStorage) =====');
        return;
    }

    // No localStorage data, fetch from API
    const url = '/deki/cp/custom_css.php?params=%2F';
    console.log('[loadCSS] No localStorage data, fetching from URL:', url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'max-age=0'
            },
            credentials: 'include'
        });

        console.log('[loadCSS] Response status:', response.status, response.statusText);
        console.log('[loadCSS] Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        console.log('[loadCSS] HTML received, length:', html.length);

        const parsedData = parseHTML(html);
        csrfToken = parsedData.csrf_token;

        if (!csrfToken) {
            console.error('[loadCSS] CSRF token missing after parsing');
            throw new Error('Failed to extract CSRF token. Check your authentication.');
        }

        console.log('[loadCSS] CSRF token stored:', csrfToken.substring(0, 20) + '...');

        // Ensure Monaco is loaded before initializing
        if (!monacoReady) {
            console.log('[loadCSS] Monaco not ready, loading now...');
            await new Promise((resolve) => {
                initializeMonaco(() => {
                    console.log('[loadCSS] Monaco loaded via callback');
                    resolve();
                });
            });
        }

        // Load CSS into state
        console.log('[loadCSS] Loading CSS into state');
        initializeEditors(parsedData);

        document.getElementById('loading').style.display = 'none';
        document.getElementById('editor-container').style.display = 'block';
        console.log('[loadCSS] ===== LOAD CSS COMPLETE =====');

    } catch (error) {
        console.error('[loadCSS] ===== ERROR =====');
        console.error('[loadCSS] Error details:', error);
        console.error('[loadCSS] Error stack:', error.stack);
        document.getElementById('loading').style.display = 'none';
        showMessage('Error loading CSS: ' + error.message, 'error');
    }
}
window.loadCSS = loadCSS;
console.log('[CSS Editor] loadCSS assigned to window, typeof window.loadCSS:', typeof window.loadCSS);

function buildMultipartBody(cssData) {
    console.log('[buildMultipartBody] Building multipart form data');
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
    console.log('[buildMultipartBody] Boundary:', boundary);
    let body = '';

    // Add CSRF token
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="csrf_token"\r\n\r\n`;
    body += `${cssData.csrf_token}\r\n`;
    console.log('[buildMultipartBody] Added CSRF token');

    // Add CSS templates
    const fields = {
        'css_template_all': cssData.css_template_all,
        'css_template_anonymous': cssData.css_template_anonymous,
        'css_template_viewer': cssData.css_template_viewer,
        'css_template_seated': cssData.css_template_seated,
        'css_template_admin': cssData.css_template_admin,
        'css_template_grape': cssData.css_template_grape
    };

    Object.entries(fields).forEach(([name, value]) => {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
        body += `${value}\r\n`;
        console.log(`[buildMultipartBody] Added ${name}: ${value?.length || 0} characters`);
    });

    // Add submit button
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="deki_buttons[submit][submit]"\r\n\r\n`;
    body += `submit\r\n`;
    body += `--${boundary}--\r\n`;

    console.log('[buildMultipartBody] Total body length:', body.length);
    return { body, boundary };
}

async function saveSinglePane(role) {
    console.log(`[saveSinglePane] ===== SAVE SINGLE PANE STARTED: ${role} =====`);

    if (!csrfToken) {
        console.error('[saveSinglePane] No CSRF token available');
        showMessage('Please reload the page first', 'error');
        return;
    }

    const state = editorState[role];
    if (!state.isDirty) {
        console.log(`[saveSinglePane] ${role} has no changes, skipping save`);
        showMessage(`"${state.label}" has no unsaved changes`, 'success');
        return;
    }

    console.log(`[saveSinglePane] Using CSRF token:`, csrfToken.substring(0, 20) + '...');

    const saveBtn = document.querySelector(`[data-save-role="${role}"]`);
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }

    try {
        console.log(`[saveSinglePane] Collecting CSS for ${role}`);

        // Sync active editor to state
        if (state.active && state.editor) {
            state.content = state.editor.getValue();
            console.log(`[saveSinglePane] Synced ${role} from editor to state: ${state.content.length} chars`);
        }

        // Build CSS data with all roles (only updating the specific role)
        const cssData = {
            csrf_token: csrfToken,
            css_template_all: editorState.all.content,
            css_template_anonymous: editorState.anonymous.content,
            css_template_viewer: editorState.viewer.content,
            css_template_seated: editorState.seated.content,
            css_template_admin: editorState.admin.content,
            css_template_grape: editorState.grape.content
        };

        console.log(`[saveSinglePane] Saving ${role} with ${cssData[`css_template_${role}`]?.length || 0} chars`);

        const { body, boundary } = buildMultipartBody(cssData);

        const url = '/deki/cp/custom_css.php?params=%2F';
        console.log(`[saveSinglePane] Posting to URL:`, url);

        const response = await fetch(url, {
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

        console.log(`[saveSinglePane] Response status:`, response.status, response.statusText);

        if (response.ok || response.redirected) {
            console.log(`[saveSinglePane] Save successful for ${role}!`);

            // Update original content and mark as clean
            originalContent[role] = state.content;
            state.isDirty = false;
            updateStatusIcon(role);

            // Check if all editors are now clean - if so, clear localStorage
            const allClean = Object.values(editorState).every(s => !s.isDirty);
            if (allClean) {
                console.log(`[saveSinglePane] All editors are clean, clearing localStorage`);
                clearCSSFromLocalStorage();
            }

            showMessage(`"${state.label}" saved successfully!`, 'success');
        } else {
            throw new Error(`Failed to save: ${response.status} ${response.statusText}`);
        }

        console.log(`[saveSinglePane] ===== SAVE SINGLE PANE COMPLETE: ${role} =====`);

    } catch (error) {
        console.error(`[saveSinglePane] ===== ERROR =====`);
        console.error(`[saveSinglePane] Error details:`, error);
        showMessage(`Error saving ${state.label}: ${error.message}`, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    }
}
window.saveSinglePane = saveSinglePane;

async function saveCSS() {
    console.log('[saveCSS] ===== SAVE CSS STARTED =====');

    if (!csrfToken) {
        console.error('[saveCSS] No CSRF token available');
        showMessage('Please load CSS first before saving', 'error');
        return;
    }

    console.log('[saveCSS] Using CSRF token:', csrfToken.substring(0, 20) + '...');

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        console.log('[saveCSS] Collecting CSS from state');

        // Sync active editors back to state first
        Object.keys(editorState).forEach(role => {
            const state = editorState[role];
            if (state.active && state.editor) {
                state.content = state.editor.getValue();
                console.log(`[saveCSS] Synced ${role} from editor to state: ${state.content.length} chars`);
            }
        });

        const cssData = {
            csrf_token: csrfToken,
            css_template_all: editorState.all.content,
            css_template_anonymous: editorState.anonymous.content,
            css_template_viewer: editorState.viewer.content,
            css_template_seated: editorState.seated.content,
            css_template_admin: editorState.admin.content,
            css_template_grape: editorState.grape.content
        };

        console.log('[saveCSS] CSS data collected from state:', {
            all: cssData.css_template_all?.length || 0,
            anonymous: cssData.css_template_anonymous?.length || 0,
            viewer: cssData.css_template_viewer?.length || 0,
            seated: cssData.css_template_seated?.length || 0,
            admin: cssData.css_template_admin?.length || 0,
            grape: cssData.css_template_grape?.length || 0
        });

        const { body, boundary } = buildMultipartBody(cssData);

        const url = '/deki/cp/custom_css.php?params=%2F';
        console.log('[saveCSS] Posting to URL:', url);

        const response = await fetch(url, {
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

        console.log('[saveCSS] Response status:', response.status, response.statusText);
        console.log('[saveCSS] Response redirected:', response.redirected);
        console.log('[saveCSS] Response URL:', response.url);

        if (response.ok || response.redirected) {
            console.log('[saveCSS] Save successful!');

            // Update original content for all roles and mark as clean
            Object.keys(editorState).forEach(role => {
                originalContent[role] = editorState[role].content;
                editorState[role].isDirty = false;
                updateStatusIcon(role);
            });

            // Clear localStorage since everything is now saved
            clearCSSFromLocalStorage();

            showMessage('CSS saved successfully!', 'success');
        } else {
            throw new Error(`Failed to save: ${response.status} ${response.statusText}`);
        }

        console.log('[saveCSS] ===== SAVE CSS COMPLETE =====');

    } catch (error) {
        console.error('[saveCSS] ===== ERROR =====');
        console.error('[saveCSS] Error details:', error);
        console.error('[saveCSS] Error stack:', error.stack);
        showMessage('Error saving CSS: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save All';
    }
}
window.saveCSS = saveCSS;


function revertSinglePane(role) {
    console.log(`[revertSinglePane] Reverting ${role} to original content`);

    if (!originalContent[role]) {
        showMessage('No original content to revert to', 'error');
        return;
    }

    const state = editorState[role];
    const revertBtn = document.querySelector(`[data-revert-role="${role}"]`);

    // If there are unsaved changes, show confirmation
    if (state.isDirty) {
        if (revertBtn && !revertBtn.classList.contains('confirming')) {
            // Show inline confirmation
            showInlineConfirmation(revertBtn, () => {
                // Confirmed - do the revert
                performRevert(role);
            });
        }
        return;
    }

    // No unsaved changes - show "no changes" message in button
    if (revertBtn && !revertBtn.classList.contains('showing-no-changes')) {
        showNoChangesMessage(revertBtn);
    }
}

function performRevert(role) {
    const state = editorState[role];

    // Revert content to original
    state.content = originalContent[role];

    // If editor is active, update its content
    if (state.editor) {
        state.editor.setValue(state.content);
        console.log(`[performRevert] Reverted ${role} editor: ${state.content.length} chars`);
    }

    // Mark as clean
    state.isDirty = false;
    updateStatusIcon(role);

    // Check if all editors are now clean - if so, clear localStorage
    const allClean = Object.values(editorState).every(s => !s.isDirty);
    if (allClean) {
        console.log(`[performRevert] All editors are clean, clearing localStorage`);
        clearCSSFromLocalStorage();
    }

    // Close dropdown menu
    const menu = document.querySelector(`[data-menu-role="${role}"]`);
    if (menu) menu.classList.remove('show');

    showMessage(`"${state.label}" reverted to original content.`, 'success');
    console.log(`[performRevert] Revert complete for ${role}`);
}
window.revertSinglePane = revertSinglePane;

function toggleEditorDropdown(role) {
    const menu = document.querySelector(`[data-menu-role="${role}"]`);
    if (!menu) return;

    // Close all other editor dropdowns AND the global dropdown
    document.querySelectorAll('.editor-save-dropdown-menu.show').forEach(m => {
        if (m !== menu) m.classList.remove('show');
    });
    const globalDropdown = document.getElementById('save-dropdown-menu');
    if (globalDropdown) globalDropdown.classList.remove('show');

    menu.classList.toggle('show');
}

// Close editor dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.editor-save-dropdown')) {
        document.querySelectorAll('.editor-save-dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
    }
});

function discardChanges() {
    console.log('[discardChanges] Reverting all changes to original content');

    if (Object.keys(originalContent).length === 0) {
        showMessage('No original content to revert to', 'error');
        return;
    }

    // Check if any editors have unsaved changes
    const hasUnsavedChanges = Object.values(editorState).some(state => state.isDirty);
    const discardBtn = document.getElementById('discard-btn');

    if (hasUnsavedChanges) {
        if (discardBtn && !discardBtn.classList.contains('confirming')) {
            // Show inline confirmation
            showInlineConfirmation(discardBtn, () => {
                // Confirmed - do the discard
                performDiscardChanges();
            });
        }
        return;
    }

    // No unsaved changes - show "no changes" message in button
    if (discardBtn && !discardBtn.classList.contains('showing-no-changes')) {
        showNoChangesMessage(discardBtn);
    }
}

function performDiscardChanges() {
    // Revert all state to original content
    Object.keys(editorState).forEach(role => {
        const state = editorState[role];
        state.content = originalContent[role] || '';
        state.isDirty = false;

        // If editor is active, update its content
        if (state.editor) {
            state.editor.setValue(state.content);
            console.log(`[performDiscardChanges] Reverted ${role} editor: ${state.content.length} chars`);
        }

        updateStatusIcon(role);
    });

    // Clear localStorage since we reverted all changes
    clearCSSFromLocalStorage();

    // Close dropdown menu
    const dropdown = document.querySelector('.save-dropdown');
    const dropdownMenu = document.getElementById('save-dropdown-menu');
    if (dropdownMenu) dropdownMenu.classList.remove('show');
    if (dropdown) dropdown.classList.remove('open');

    showMessage('All changes discarded. CSS reverted to original content.', 'success');
    console.log('[performDiscardChanges] Discard complete');
}
window.discardChanges = discardChanges;

function showInlineConfirmation(button, onConfirm) {
    // Mark button as confirming
    button.classList.add('confirming');

    // Store original button content and dimensions
    const originalText = button.textContent;
    const originalColor = button.style.color;
    const originalHeight = button.offsetHeight + 'px';
    const originalMinHeight = button.style.minHeight;

    // Replace button content with confirm UI
    button.innerHTML = '';
    button.style.display = 'flex';
    button.style.alignItems = 'stretch';
    button.style.gap = '0';
    button.style.justifyContent = 'space-between';
    button.style.padding = '0';
    button.style.height = originalHeight;
    button.style.minHeight = originalHeight;

    const confirmText = document.createElement('span');
    confirmText.textContent = 'Confirm?';
    confirmText.style.fontSize = '0.7rem';
    confirmText.style.display = 'flex';
    confirmText.style.alignItems = 'center';
    confirmText.style.paddingLeft = '1rem';
    confirmText.style.paddingRight = '0.5rem';
    confirmText.style.flex = '1';

    const buttonGroup = document.createElement('span');
    buttonGroup.style.display = 'flex';
    buttonGroup.style.alignItems = 'stretch';
    buttonGroup.style.marginLeft = 'auto';

    const tickBtn = document.createElement('span');
    tickBtn.textContent = '✓';
    tickBtn.className = 'confirm-tick';
    tickBtn.style.cursor = 'pointer';
    tickBtn.style.padding = '0 0.75rem';
    tickBtn.style.borderRadius = '0';
    tickBtn.style.background = 'rgba(76, 175, 80, 0.2)';
    tickBtn.style.color = '#4caf50';
    tickBtn.style.fontWeight = 'bold';
    tickBtn.style.display = 'flex';
    tickBtn.style.alignItems = 'center';
    tickBtn.style.justifyContent = 'center';
    tickBtn.style.minWidth = '2.5rem';
    tickBtn.style.transition = 'all 0.15s';

    const crossBtn = document.createElement('span');
    crossBtn.textContent = '×';
    crossBtn.className = 'confirm-cross';
    crossBtn.style.cursor = 'pointer';
    crossBtn.style.padding = '0 0.75rem';
    crossBtn.style.borderRadius = '0';
    crossBtn.style.background = 'rgba(244, 67, 54, 0.2)';
    crossBtn.style.color = '#f44336';
    crossBtn.style.fontWeight = 'bold';
    crossBtn.style.fontSize = '1.2rem';
    crossBtn.style.lineHeight = '1';
    crossBtn.style.display = 'flex';
    crossBtn.style.alignItems = 'center';
    crossBtn.style.justifyContent = 'center';
    crossBtn.style.minWidth = '2.5rem';
    crossBtn.style.transition = 'all 0.15s';

    // Add hover effects
    tickBtn.addEventListener('mouseenter', () => {
        tickBtn.style.background = 'rgba(76, 175, 80, 0.35)';
    });
    tickBtn.addEventListener('mouseleave', () => {
        tickBtn.style.background = 'rgba(76, 175, 80, 0.2)';
    });

    crossBtn.addEventListener('mouseenter', () => {
        crossBtn.style.background = 'rgba(244, 67, 54, 0.35)';
    });
    crossBtn.addEventListener('mouseleave', () => {
        crossBtn.style.background = 'rgba(244, 67, 54, 0.2)';
    });

    buttonGroup.appendChild(tickBtn);
    buttonGroup.appendChild(crossBtn);

    button.appendChild(confirmText);
    button.appendChild(buttonGroup);

    // Reset function
    const resetButton = () => {
        button.classList.remove('confirming');
        button.textContent = originalText;
        button.style.color = originalColor;
        button.style.display = '';
        button.style.alignItems = '';
        button.style.gap = '';
        button.style.justifyContent = '';
        button.style.padding = '';
        button.style.height = '';
        button.style.minHeight = originalMinHeight;
    };

    // Tick click handler
    tickBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetButton();
        onConfirm();
    });

    // Cross click handler
    crossBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetButton();

        // Close the dropdown menu
        // Check if this is an editor dropdown button or global dropdown button
        if (button.hasAttribute('data-revert-role')) {
            // Editor-specific dropdown
            const role = button.getAttribute('data-revert-role');
            const menu = document.querySelector(`[data-menu-role="${role}"]`);
            if (menu) menu.classList.remove('show');
        } else if (button.id === 'discard-btn') {
            // Global dropdown
            const dropdownMenu = document.getElementById('save-dropdown-menu');
            if (dropdownMenu) dropdownMenu.classList.remove('show');
        }
    });

    // Click outside handler
    const clickOutsideHandler = (e) => {
        if (!button.contains(e.target)) {
            resetButton();
            document.removeEventListener('click', clickOutsideHandler);
        }
    };

    // Add click outside listener after a brief delay to avoid immediate trigger
    setTimeout(() => {
        document.addEventListener('click', clickOutsideHandler);
    }, 100);
}

function showNoChangesMessage(button) {
    // Mark button as showing no changes message
    button.classList.add('showing-no-changes');

    // Store original button content and dimensions
    const originalText = button.textContent;
    const originalColor = button.style.color;
    const originalHeight = button.offsetHeight + 'px';
    const originalMinHeight = button.style.minHeight;
    const originalFontSize = button.style.fontSize;
    const originalBackground = button.style.background;

    // Replace button content with "no changes" message
    button.innerHTML = '';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'flex-start';
    button.style.padding = '0.5rem 0.75rem';
    button.style.height = originalHeight;
    button.style.minHeight = originalHeight;
    button.style.color = '#ff9800';
    button.style.cursor = 'default';
    button.textContent = 'No changes';

    // Flash animation
    button.style.background = 'rgba(255, 152, 0, 0.15)';
    button.style.transition = 'background 0.3s ease';
    setTimeout(() => {
        button.style.background = originalBackground;
    }, 300);

    // Reset function
    const resetButton = () => {
        button.classList.remove('showing-no-changes');
        button.textContent = originalText;
        button.style.color = originalColor;
        button.style.display = '';
        button.style.alignItems = '';
        button.style.justifyContent = '';
        button.style.padding = '';
        button.style.height = '';
        button.style.minHeight = originalMinHeight;
        button.style.fontSize = originalFontSize;
        button.style.cursor = '';
        button.style.background = originalBackground;
        button.style.transition = '';
    };

    // Auto-reset after 2 seconds
    setTimeout(() => {
        resetButton();
    }, 2000);

    // Click outside handler
    const clickOutsideHandler = (e) => {
        if (!button.contains(e.target)) {
            resetButton();
            document.removeEventListener('click', clickOutsideHandler);
        }
    };

    // Add click outside listener after a brief delay
    setTimeout(() => {
        document.addEventListener('click', clickOutsideHandler);
    }, 100);
}

function toggleDropdown() {
    const dropdown = document.querySelector('.save-dropdown');
    const dropdownMenu = document.getElementById('save-dropdown-menu');

    // Close all editor dropdowns when opening global dropdown
    document.querySelectorAll('.editor-save-dropdown-menu.show').forEach(m => {
        m.classList.remove('show');
    });

    dropdownMenu.classList.toggle('show');
    dropdown.classList.toggle('open');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.querySelector('.save-dropdown');
    const dropdownMenu = document.getElementById('save-dropdown-menu');

    if (dropdown && dropdownMenu && !dropdown.contains(e.target)) {
        dropdownMenu.classList.remove('show');
        dropdown.classList.remove('open');
    }
});

// Function to attach event listeners (called after DOM is ready)
function attachEventListeners() {
    console.log('[attachEventListeners] Attaching event listeners to buttons');

    const saveBtn = document.getElementById('save-btn');
    const dropdownToggle = document.getElementById('save-dropdown-toggle');
    const discardBtn = document.getElementById('discard-btn');

    if (saveBtn) {
        saveBtn.addEventListener('click', saveCSS);
        console.log('[attachEventListeners] Save button listener attached');
    }

    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });
        console.log('[attachEventListeners] Dropdown toggle listener attached');
    } else {
        console.warn('[attachEventListeners] Dropdown toggle button not found!');
    }

    if (discardBtn) {
        discardBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent dropdown from closing
            discardChanges();
        });
        console.log('[attachEventListeners] Discard button listener attached');
    }

    // Add toggle button listeners
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    console.log(`[attachEventListeners] Found ${toggleBtns.length} toggle buttons`);
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const role = btn.getAttribute('data-role');

            // Check if we're in mobile view - if so, use old behavior
            if (isMobileView) {
                toggleEditor(role);
                return;
            }

            // Desktop behavior:
            // - Regular click: Open solo (close all others)
            // - Ctrl+click: Toggle split view (add/remove from active set)
            if (e.ctrlKey || e.metaKey) {
                // Ctrl+click: Toggle this editor in split view
                toggleEditor(role);
            } else {
                // Regular click: Open solo (close all others, open this one)
                openEditorSolo(role);
            }
        });
    });

    console.log('[CSS Editor] All event listeners registered');
}
// Expose for overlay embed to call after injecting HTML
window.attachEventListeners = attachEventListeners;

// Handle window resize to update editor layouts and check viewport width
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        console.log('[resize] Window resized, checking viewport and updating editor layouts');

        // Check if we need to switch between mobile/desktop view
        checkViewportWidth();

        const activeEditors = Object.keys(editorState).filter(role => editorState[role].active && editorState[role].editor);
        console.log('[resize] Active editors:', activeEditors);

        activeEditors.forEach(role => {
            const state = editorState[role];
            const container = document.getElementById(`editor-${role}`);
            if (container) {
                const rect = container.getBoundingClientRect();
                // Floor dimensions to avoid sub-pixel issues
                const width = Math.floor(rect.width);
                const height = Math.floor(rect.height);
                console.log(`[resize] ${role} container size: ${width}x${height}`);
                state.editor.layout({ width, height });
                console.log(`[resize] Layout updated for ${role}`);
            }
        });
    }, 100);
});

// Initialize Monaco Editor on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log('[DOMContentLoaded] Page ready, waiting for Monaco loader');

    // Set initial mobile view flag WITHOUT rebuilding toggle bar yet
    // (we'll rebuild after editors are loaded)
    // Check if we're in overlay mode
    const editorApp = document.getElementById('css-editor-app');
    const isInOverlay = editorApp && editorApp.closest('#css-editor-overlay');

    if (isInOverlay) {
        const overlay = document.getElementById('css-editor-overlay');
        isMobileView = overlay ? overlay.offsetWidth < 1080 : false;
        console.log(`[DOMContentLoaded] Initial view mode (overlay): ${isMobileView ? 'mobile' : 'desktop'}`);
    } else {
        // Direct page embed mode - clear any existing live preview
        isMobileView = window.innerWidth < 1080;
        console.log(`[DOMContentLoaded] Initial view mode (page): ${isMobileView ? 'mobile' : 'desktop'}`);
        console.log(`[DOMContentLoaded] Direct embed mode detected - clearing any existing live preview`);
        const existingPreviewTag = document.getElementById('css-editor-live-preview');
        if (existingPreviewTag) {
            existingPreviewTag.remove();
            console.log(`[DOMContentLoaded] Removed existing live preview style tag`);
        }
    }

    // Wait for Monaco's require to be available (stored separately)
    const waitForMonaco = setInterval(() => {
        if (typeof window.monacoRequire !== 'undefined' && typeof window.monacoRequire.config === 'function') {
            clearInterval(waitForMonaco);
            console.log('[DOMContentLoaded] Monaco require ready, initializing');
            initializeMonaco(() => {
                console.log('[DOMContentLoaded] Monaco initialization complete');
                // Attach event listeners after Monaco is ready
                attachEventListeners();
                // Automatically load CSS
                console.log('[DOMContentLoaded] Automatically loading CSS');
                loadCSS();
            });
        }
    }, 50);
});
