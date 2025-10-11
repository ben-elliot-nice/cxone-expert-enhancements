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

const MAX_ACTIVE_EDITORS = 3;
let csrfToken = '';
let monacoReady = false;
let linterReady = false;
let originalContent = {}; // Store original CSS from API

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

function updateActiveCount() {
    const count = getActiveCount();
    const countEl = document.querySelector('.active-count');
    if (count === 0) {
        countEl.textContent = 'No editors active';
    } else {
        countEl.textContent = `${count} editor${count === 1 ? '' : 's'} active`;
    }
}

function updateToggleButtons() {
    const activeCount = getActiveCount();
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
}

function updateStatusIcon(role) {
    const statusIcon = document.querySelector(`[data-status-role="${role}"]`);
    if (!statusIcon) return;

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
                        <button class="editor-pane-save" data-save-role="${role}">Save</button>
                        <button class="editor-pane-export" data-export-role="${role}">Export</button>
                    </div>
                </div>
                <div id="editor-${role}" class="editor-instance"></div>
            `;
        grid.appendChild(pane);

        // Add click listener to save button
        const saveBtn = pane.querySelector('.editor-pane-save');
        saveBtn.addEventListener('click', () => saveSinglePane(role));

        // Add click listener to export button
        const exportBtn = pane.querySelector('.editor-pane-export');
        exportBtn.addEventListener('click', () => exportCSS(role));

        // Always create a fresh Monaco editor
        console.log(`[updateGrid] Creating Monaco editor for ${role}`);
        createMonacoEditor(role);
    });

    console.log('[updateGrid] Grid update complete');
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
        }
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
    updateActiveCount();
    saveActiveEditors();
}
window.toggleEditor = toggleEditor;

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

    // STEP 1: Load CSS data into state first and store original
    Object.keys(editorState).forEach(role => {
        const state = editorState[role];
        state.content = cssData.css[role] || '';
        originalContent[role] = cssData.css[role] || ''; // Store original
        console.log(`[initializeEditors] Loaded ${role}: ${state.content.length} characters`);
    });

    console.log('[initializeEditors] CSS loaded into state and original content stored');

    // STEP 2: Restore previously active editors from localStorage (just marks them active)
    const restored = loadActiveEditors();
    if (restored > 0) {
        console.log(`[initializeEditors] Restored ${restored} active editor(s) from cache`);
    }

    // STEP 3: Now create the UI with the loaded content
    const activeRoles = Object.keys(editorState).filter(role => editorState[role].active);
    if (activeRoles.length > 0) {
        console.log('[initializeEditors] Creating editors for restored roles:', activeRoles);
        updateGrid();
        updateToggleButtons();
        updateActiveCount();
    }
}

async function loadCSS() {
    console.log('[loadCSS] ===== LOAD CSS STARTED =====');

    document.getElementById('loading').style.display = 'block';
    document.getElementById('message-area').innerHTML = '';

    const url = '/deki/cp/custom_css.php?params=%2F';
    console.log('[loadCSS] Fetching from URL:', url);

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
        showMessage('CSS loaded successfully! Click editor buttons below to toggle editors on/off.', 'success');
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
        showMessage(`${state.label} has no unsaved changes`, 'success');
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

            showMessage(`${state.label} saved successfully!`, 'success');
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
        saveBtn.textContent = 'Save All Changes';
    }
}
window.saveCSS = saveCSS;


function discardChanges() {
    console.log('[discardChanges] Reverting all changes to original content');

    if (Object.keys(originalContent).length === 0) {
        showMessage('No original content to revert to', 'error');
        return;
    }

    // Confirm with user
    if (!confirm('Are you sure you want to discard all changes? This will revert all CSS to the originally loaded content.')) {
        console.log('[discardChanges] User cancelled discard');
        return;
    }

    // Revert all state to original content
    Object.keys(editorState).forEach(role => {
        const state = editorState[role];
        state.content = originalContent[role] || '';

        // If editor is active, update its content
        if (state.editor) {
            state.editor.setValue(state.content);
            console.log(`[discardChanges] Reverted ${role} editor: ${state.content.length} chars`);
        }
    });

    showMessage('All changes discarded. CSS reverted to original content.', 'success');
    console.log('[discardChanges] Discard complete');
}
window.discardChanges = discardChanges;

function toggleDropdown() {
    const dropdown = document.querySelector('.save-dropdown');
    const dropdownMenu = document.getElementById('save-dropdown-menu');
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
    }

    if (discardBtn) {
        discardBtn.addEventListener('click', () => {
            discardChanges();
            // Close dropdown after action
            const dropdown = document.querySelector('.save-dropdown');
            document.getElementById('save-dropdown-menu').classList.remove('show');
            dropdown.classList.remove('open');
        });
        console.log('[attachEventListeners] Discard button listener attached');
    }

    // Add toggle button listeners
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    console.log(`[attachEventListeners] Found ${toggleBtns.length} toggle buttons`);
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.getAttribute('data-role');
            toggleEditor(role);
        });
    });

    console.log('[CSS Editor] All event listeners registered');
}

// Handle window resize to update editor layouts
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        console.log('[resize] Window resized, updating editor layouts');
        const activeEditors = Object.keys(editorState).filter(role => editorState[role].active && editorState[role].editor);
        console.log('[resize] Active editors:', activeEditors);

        activeEditors.forEach(role => {
            const state = editorState[role];
            const container = document.getElementById(`editor-${role}`);
            if (container) {
                const rect = container.getBoundingClientRect();
                console.log(`[resize] ${role} container size: ${rect.width}x${rect.height}`);
                state.editor.layout({ width: rect.width, height: rect.height });
                console.log(`[resize] Layout updated for ${role}`);
            }
        });
    }, 100);
});

// Initialize Monaco Editor on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log('[DOMContentLoaded] Page ready, waiting for Monaco loader');

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
