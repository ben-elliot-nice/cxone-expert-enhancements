# DRY Refactoring Implementation Plan

## Overview

This document provides a detailed, step-by-step plan for refactoring the CSS Editor and HTML Editor to eliminate code duplication using a **Hybrid Approach** with a `BaseEditor` class.

**Goal**: Reduce codebase from 3,925 to ~2,500 lines (36% reduction) while maintaining 100% backward compatibility.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Refactoring Phases](#refactoring-phases)
3. [Testing Strategy](#testing-strategy)
4. [Rollback Procedures](#rollback-procedures)
5. [Success Criteria](#success-criteria)

---

## Prerequisites

### Development Environment

- ✅ Node.js and npm installed
- ✅ Vite build system configured
- ✅ Git repository on branch `refactor/dry-principles-apps`
- ✅ Documentation created (this file)

### Pre-Refactoring Checklist

- [ ] All tests passing
- [ ] No uncommitted changes
- [ ] Branch synced with `develop`
- [ ] Local build successful: `npm run build`
- [ ] Editors working in development

### Backup Strategy

```bash
# Create backup branch before starting
git checkout -b refactor/dry-principles-apps-backup
git checkout refactor/dry-principles-apps
```

---

## Refactoring Phases

### Phase 0: Documentation & Setup ✅

**Status**: Complete

**Deliverables**:
- [x] `docs/REFACTOR_ANALYSIS.md` - Code duplication analysis
- [x] `docs/REFACTOR_PLAN.md` - This implementation plan
- [x] Branch created and pushed
- [x] PR created to `develop`

---

### Phase 1: Create Base Editor Foundation

**Goal**: Create `src/base-editor.js` with basic structure and configuration

**Complexity**: Low | **Risk**: Low | **Est. Time**: 1-2 hours

#### 1.1 Create Base File Structure

Create `src/base-editor.js`:

```javascript
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

        return config;
    }

    /**
     * Get configuration value
     */
    getConfig(key) {
        return this.config[key];
    }
}
```

#### 1.2 Testing

```bash
# Build and check for syntax errors
npm run build
```

**Test Cases**:
- [ ] File compiles without errors
- [ ] Can import BaseEditor in test file
- [ ] Config validation works (missing fields throw errors)

#### 1.3 Commit

```bash
git add src/base-editor.js
git commit -m "refactor: Create BaseEditor foundation

- Add BaseEditor class structure
- Add configuration validation
- Prepare for shared functionality extraction

Part of DRY refactoring to eliminate 1,400+ lines of duplication
between CSS and HTML editors.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Phase 2: Extract Grid & Layout Utilities

**Goal**: Extract shared UI layout functions (lowest risk)

**Complexity**: Low | **Risk**: Low | **Est. Time**: 1-2 hours

#### 2.1 Extract Functions

Add to `BaseEditor`:

```javascript
/**
 * Update editors grid
 */
updateGrid() {
    const grid = document.getElementById('editors-grid');
    if (!grid) return;

    const itemLabel = this.config.itemLabel; // 'role' or 'field'
    const activeItems = Object.keys(this.editorState).filter(
        id => this.editorState[id].active
    );

    grid.innerHTML = '';
    grid.className = 'editors-grid cols-' + activeItems.length;

    activeItems.forEach(itemId => {
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
            const item = this.editorState[itemId];
            if (item) {
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
```

#### 2.2 Update CSS/HTML Editors

Update `src/css-editor.js` and `src/html-editor.js` to import and use:

```javascript
// At top of file
import { BaseEditor } from './base-editor.js';

// In app object, replace methods:
const CSSEditorApp = {
    // ... existing properties

    _baseEditor: null,

    async init(ctx) {
        // Create base editor instance
        this._baseEditor = new BaseEditor({
            editorType: 'css',
            itemsConfig: ROLE_CONFIG,
            maxActiveEditors: MAX_ACTIVE_EDITORS,
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

        // Initialize state on base editor
        this._baseEditor.editorState = editorState;
        this._baseEditor.originalContent = originalContent;
        this._baseEditor.monacoEditors = monacoEditors;
        // ... other shared state

        // Keep existing init logic
        // ...
    },

    // Delegate to base editor
    updateGrid() {
        return this._baseEditor.updateGrid();
    },

    updateHeights() {
        return this._baseEditor.updateHeights();
    },

    updateToggleButtons() {
        return this._baseEditor.updateToggleButtons();
    }
};
```

#### 2.3 Testing

**Manual Test Cases**:
- [ ] CSS Editor: Open/close editors, verify grid updates
- [ ] CSS Editor: Resize window, verify heights recalculate
- [ ] CSS Editor: Make edits, verify dirty indicators appear
- [ ] CSS Editor: Switch to mobile view (< 920px), verify dropdown works
- [ ] HTML Editor: Repeat all above tests
- [ ] Both: Toggle between apps, verify no errors

**Build Test**:
```bash
npm run build
# Verify no errors
```

#### 2.4 Commit

```bash
git add src/base-editor.js src/css-editor.js src/html-editor.js
git commit -m "refactor: Extract grid and layout utilities to BaseEditor

- Extract updateGrid(), updateHeights(), updateToggleButtons()
- Both editors now delegate to BaseEditor for layout
- Reduces duplication by ~150 lines

Tested:
- Grid updates on editor open/close
- Height calculations on resize
- Dirty indicators update correctly
- Mobile/desktop view switching

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Phase 3: Extract State Management

**Goal**: Extract state persistence functions

**Complexity**: Low | **Risk**: Low | **Est. Time**: 1 hour

#### 3.1 Extract Functions

Add to `BaseEditor`:

```javascript
/**
 * Get current state for persistence
 */
getState() {
    const itemLabel = this.config.itemLabel;
    const activeKey = itemLabel === 'role' ? 'activeRoles' : 'activeFields';

    const state = {
        [activeKey]: Object.keys(this.editorState).filter(
            id => this.editorState[id].active
        ),
        content: {},
        isDirty: {},
        originalContent: {}
    };

    Object.keys(this.editorState).forEach(itemId => {
        const itemState = this.editorState[itemId];
        state.content[itemId] = itemState.content;
        state.isDirty[itemId] = itemState.isDirty;
        state.originalContent[itemId] = this.originalContent[itemId];
    });

    return state;
}

/**
 * Restore state
 */
setState(state) {
    if (!state) return;

    const itemLabel = this.config.itemLabel;
    const activeKey = itemLabel === 'role' ? 'activeRoles' : 'activeFields';

    // Restore active items
    if (state[activeKey]) {
        state[activeKey].forEach(itemId => {
            if (this.editorState[itemId]) {
                this.editorState[itemId].active = true;
            }
        });
    }

    // Restore content
    if (state.content) {
        Object.keys(state.content).forEach(itemId => {
            if (this.editorState[itemId]) {
                this.editorState[itemId].content = state.content[itemId];
            }
        });
    }

    // Restore dirty state
    if (state.isDirty) {
        Object.keys(state.isDirty).forEach(itemId => {
            if (this.editorState[itemId]) {
                this.editorState[itemId].isDirty = state.isDirty[itemId];
            }
        });
    }

    // Restore original content (server baseline)
    if (state.originalContent) {
        Object.keys(state.originalContent).forEach(itemId => {
            this.originalContent[itemId] = state.originalContent[itemId];
        });
    }
}

/**
 * Save current state to storage
 */
saveState() {
    const appId = `${this.config.editorType}-editor`;
    const state = this.getState();
    this.context.Storage.setAppState(appId, state);
}
```

#### 3.2 Update Editors

Both editors should delegate state methods:

```javascript
getState() {
    const state = this._baseEditor.getState();
    // CSS Editor: Add live preview state
    if (this.livePreviewEnabled !== undefined) {
        state.livePreview = {
            enabled: this.livePreviewEnabled,
            selectedRole: this.livePreviewRole
        };
    }
    return state;
},

setState(state) {
    this._baseEditor.setState(state);
    // CSS Editor: Restore live preview state
    if (state.livePreview) {
        this.livePreviewEnabled = state.livePreview.enabled || false;
        this.livePreviewRole = state.livePreview.selectedRole || 'anonymous';
    }
},

saveState() {
    return this._baseEditor.saveState();
}
```

#### 3.3 Testing

**Test Cases**:
- [ ] Make edits, reload page, verify state restored
- [ ] Switch apps, verify state persists per app
- [ ] Clear localStorage, verify clean state
- [ ] CSS Editor: Verify live preview state persists

#### 3.4 Commit

```bash
git add src/base-editor.js src/css-editor.js src/html-editor.js
git commit -m "refactor: Extract state management to BaseEditor

- Extract getState(), setState(), saveState()
- Centralizes localStorage persistence logic
- Reduces duplication by ~100 lines

Tested:
- State persists across page reloads
- App-specific state isolated (CSS live preview)
- State clears correctly

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Phase 4: Extract Viewport & Mobile Detection

**Goal**: Extract mobile/desktop view switching logic

**Complexity**: Low | **Risk**: Low | **Est. Time**: 1 hour

#### 4.1 Extract Functions

Add to `BaseEditor`:

```javascript
/**
 * Check viewport width and switch between mobile/desktop view
 */
checkViewportWidth() {
    const wasMobileView = this.isMobileView;

    // Get overlay width to determine mobile/desktop view
    const overlay = document.getElementById('expert-enhancements-overlay');
    if (overlay) {
        const containerWidth = overlay.offsetWidth;
        this.isMobileView = containerWidth < 920;
    }

    // If view mode changed, rebuild the toggle bar
    if (wasMobileView !== this.isMobileView) {
        this.buildToggleBar();

        // If switching to mobile and multiple editors are active, keep only the first
        if (this.isMobileView) {
            const activeItems = Object.keys(this.editorState).filter(
                id => this.editorState[id].active
            );
            if (activeItems.length > 1) {
                // Deactivate all except the first
                activeItems.slice(1).forEach(itemId => {
                    this.editorState[itemId].active = false;
                });
                this.updateGrid();
                this.saveState();
            }
        }
        this.updateToggleButtons();
    }

    return this.isMobileView;
}

/**
 * Handle mobile dropdown editor change
 */
handleMobileEditorChange(newItemId) {
    const itemLabel = this.config.itemLabel;
    console.log(`[${this.config.editorType.toUpperCase()} Editor] handleMobileEditorChange to: ${newItemId}`);

    const currentActiveItem = Object.keys(this.editorState).find(
        id => this.editorState[id].active
    );

    // If selecting the same item, do nothing
    if (newItemId === currentActiveItem) {
        return;
    }

    // Deactivate all editors
    Object.keys(this.editorState).forEach(itemId => {
        this.editorState[itemId].active = false;
    });

    // Activate selected editor
    this.editorState[newItemId].active = true;

    this.updateGrid();
    this.saveState();

    // Update option text to reflect current status icons
    const mobileSelect = document.getElementById('mobile-editor-select');
    if (mobileSelect) {
        this.updateToggleButtons();
    }
}
```

#### 4.2 Testing

**Test Cases**:
- [ ] Resize browser < 920px, verify mobile dropdown appears
- [ ] Resize browser > 920px, verify desktop buttons appear
- [ ] Mobile: Change dropdown, verify editor switches
- [ ] Mobile: Verify only one editor active at a time

#### 4.3 Commit

```bash
git commit -am "refactor: Extract viewport detection to BaseEditor

- Extract checkViewportWidth(), handleMobileEditorChange()
- Centralizes mobile/desktop view logic
- Reduces duplication by ~50 lines

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Phase 5: Extract Monaco Editor Operations

**Goal**: Extract Monaco editor creation and initialization

**Complexity**: Medium | **Risk**: Medium | **Est. Time**: 2-3 hours

#### 5.1 Extract Functions

Add to `BaseEditor`:

```javascript
/**
 * Create Monaco editor instance
 */
createMonacoEditor(itemId, container) {
    const item = this.editorState[itemId];
    const monaco = this.context.Monaco.get();

    const editor = monaco.editor.create(container, {
        value: item.content || '',
        language: this.config.monacoLanguage,
        theme: 'vs-dark',
        automaticLayout: false,
        minimap: { enabled: true },
        fontSize: 14,
        wordWrap: 'on',
        scrollBeyondLastLine: false
    });

    this.monacoEditors[itemId] = editor;

    // Track changes
    editor.onDidChangeModelContent(() => {
        item.content = editor.getValue();
        item.isDirty = item.content !== this.originalContent[itemId];
        this.updateToggleButtons();
        this.onEditorContentChange?.(itemId, editor);
    });

    const editorType = this.config.editorType.toUpperCase();
    console.log(`[${editorType} Editor] Created Monaco editor for: ${itemId}`);
}

/**
 * Initialize editors (activate default if none active)
 */
initializeEditors(skipDefault = false) {
    const hasActive = Object.values(this.editorState).some(item => item.active);

    // Only set default if we should not skip and nothing is active
    if (!skipDefault && !hasActive) {
        // Activate first item by default
        const firstItem = this.config.itemsConfig[0];
        this.editorState[firstItem.id].active = true;
        const editorType = this.config.editorType.toUpperCase();
        console.log(`[${editorType} Editor] No saved state, activating default: ${firstItem.id}`);
    } else {
        const editorType = this.config.editorType.toUpperCase();
        console.log(`[${editorType} Editor] Skipping default activation, skipDefault: ${skipDefault}, hasActive: ${hasActive}`);
    }

    this.updateGrid();
}
```

#### 5.2 Update CSS Editor

Add hook for live preview:

```javascript
async init(ctx) {
    // ... existing code

    // Set hook for content changes (live preview)
    this._baseEditor.onEditorContentChange = (itemId, editor) => {
        this.updateLivePreview();
    };
}
```

#### 5.3 Testing

**Critical Test Cases**:
- [ ] CSS Editor: Monaco loads with CSS syntax highlighting
- [ ] HTML Editor: Monaco loads with HTML syntax highlighting
- [ ] Both: Editor content changes update dirty state
- [ ] Both: Undo/redo works correctly
- [ ] CSS: Live preview updates on content change
- [ ] Both: Multiple editors can be open simultaneously

**Build Test**:
```bash
npm run build
# Test in browser
```

#### 5.4 Commit

```bash
git commit -am "refactor: Extract Monaco operations to BaseEditor

- Extract createMonacoEditor(), initializeEditors()
- Configurable Monaco language (css/html)
- Adds onEditorContentChange hook for CSS live preview
- Reduces duplication by ~100 lines

Tested:
- CSS syntax highlighting in CSS Editor
- HTML syntax highlighting in HTML Editor
- Content changes update dirty state
- Undo/redo functionality preserved
- CSS live preview triggered on change

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Phase 6: Extract Import/Export Operations

**Goal**: Extract file import/export functionality

**Complexity**: Medium | **Risk**: Low | **Est. Time**: 2 hours

#### 6.1 Extract Functions

Add to `BaseEditor`:

```javascript
/**
 * Export content to file
 */
exportItem(itemId) {
    const item = this.editorState[itemId];
    if (!item) return;

    try {
        const content = item.content || '';
        const blob = new Blob([content], { type: this.config.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.config.formFieldPrefix}${itemId}${this.config.fileExtension}`;
        a.click();
        URL.revokeObjectURL(url);

        this.context.UI.showToast(`Exported ${item.label}`, 'success');
    } catch (error) {
        this.context.UI.showToast(`Failed to export: ${error.message}`, 'error');
    }
}

/**
 * Import file content (appends with timestamp separator)
 */
importItem(itemId, file) {
    const item = this.editorState[itemId];
    if (!item) return;

    const expectedExt = this.config.fileExtension;

    // Validate file type
    if (!file.name.endsWith(expectedExt)) {
        this.context.UI.showToast(`Please select a ${expectedExt.toUpperCase()} file (${expectedExt})`, 'error');
        return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        this.context.UI.showToast(
            `File too large. Maximum size is 5MB (file is ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
            'error'
        );
        return;
    }

    // Check for empty files
    if (file.size === 0) {
        this.context.UI.showToast('Cannot import empty file', 'error');
        return;
    }

    // Show loading state
    this.context.LoadingOverlay.show(`Importing ${file.name}...`);

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const importedContent = e.target.result;

            // Create separator comment
            const commentStyle = this.config.commentStyle;
            let separator;
            if (commentStyle === '/* */') {
                separator = `\n\n/* ========================================\n   Imported from: ${file.name}\n   Date: ${new Date().toLocaleString()}\n   ======================================== */\n`;
            } else {
                separator = `\n\n<!-- ========================================\n     Imported from: ${file.name}\n     Date: ${new Date().toLocaleString()}\n     ======================================== -->\n`;
            }

            // Append content to existing
            const currentContent = item.content || '';
            const newContent = currentContent + separator + importedContent;

            // Update state
            item.content = newContent;
            item.isDirty = true;

            // Update Monaco editor using executeEdits for undo support
            if (this.monacoEditors[itemId]) {
                const editor = this.monacoEditors[itemId];
                const model = editor.getModel();
                const lineCount = model.getLineCount();
                const lastLineLength = model.getLineLength(lineCount);

                editor.executeEdits('import', [{
                    range: new monaco.Range(lineCount, lastLineLength + 1, lineCount, lastLineLength + 1),
                    text: separator + importedContent
                }]);
            }

            // Save state and update UI
            this.saveState();
            this.updateToggleButtons();

            this.context.LoadingOverlay.hide();
            this.context.UI.showToast(
                `Content from ${file.name} appended to ${item.label}`,
                'success',
                5000
            );
        } catch (error) {
            this.context.LoadingOverlay.hide();
            this.context.UI.showToast(`Failed to import: ${error.message}`, 'error');
        }
    };

    reader.onerror = () => {
        this.context.LoadingOverlay.hide();
        this.context.UI.showToast('Failed to read file', 'error');
    };

    reader.readAsText(file);
}

/**
 * Import file via drag & drop (with item selector)
 */
async importFile(fileContent, fileName) {
    try {
        // Hide loading overlay before showing selector (waiting for user input)
        this.context.LoadingOverlay.hide();

        // Prepare item list for selector
        const items = Object.keys(this.editorState).map(itemId => ({
            id: itemId,
            label: this.editorState[itemId].label
        }));

        // Show item selector dialog
        const selectedItemId = await this.context.FileImport.showRoleSelector(
            items,
            this.config.editorType
        );

        if (!selectedItemId) {
            this.context.LoadingOverlay.hide();
            this.context.UI.showToast('Import cancelled', 'info');
            return;
        }

        const item = this.editorState[selectedItemId];
        if (!item) {
            this.context.LoadingOverlay.hide();
            this.context.UI.showToast(`Selected ${this.config.itemLabel} not found`, 'error');
            return;
        }

        // Ensure target editor is active and created before import
        if (!item.active) {
            item.active = true;
            this.updateGrid();
            // Give the editor time to fully initialize
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Create separator comment
        const commentStyle = this.config.commentStyle;
        let separator;
        if (commentStyle === '/* */') {
            separator = `\n\n/* ========================================\n   Imported from: ${fileName}\n   Date: ${new Date().toLocaleString()}\n   ======================================== */\n`;
        } else {
            separator = `\n\n<!-- ========================================\n     Imported from: ${fileName}\n     Date: ${new Date().toLocaleString()}\n     ======================================== -->\n`;
        }

        // Append content to existing
        const currentContent = item.content || '';
        const newContent = currentContent + separator + fileContent;

        // Update state
        item.content = newContent;
        item.isDirty = true;

        // Update Monaco editor using executeEdits for undo support
        if (this.monacoEditors[selectedItemId]) {
            const editor = this.monacoEditors[selectedItemId];
            const model = editor.getModel();
            const lineCount = model.getLineCount();
            const lastLineLength = model.getLineLength(lineCount);

            editor.executeEdits('import', [{
                range: new monaco.Range(lineCount, lastLineLength + 1, lineCount, lastLineLength + 1),
                text: separator + fileContent
            }]);

            // Focus editor and ensure proper layout after import
            setTimeout(() => {
                editor.layout();
                editor.focus();

                // Ensure editor captures scroll events
                const editorDom = editor.getDomNode();
                if (editorDom) {
                    editorDom.style.pointerEvents = 'auto';
                }
            }, 50);
        }

        // Save state and update UI
        this.saveState();
        this.updateToggleButtons();

        this.context.LoadingOverlay.hide();
        this.context.UI.showToast(
            `Content from ${fileName} appended to ${item.label}`,
            'success',
            5000
        );
    } catch (error) {
        this.context.LoadingOverlay.hide();
        this.context.UI.showToast(`Failed to import: ${error.message}`, 'error');
    }
}
```

#### 6.2 Testing

**Test Cases**:
- [ ] Export: Downloads file with correct extension and MIME type
- [ ] Import: Validates file type (reject wrong extensions)
- [ ] Import: Validates file size (reject > 5MB)
- [ ] Import: Appends content with correct comment style
- [ ] Import: Preserves undo history (can undo import)
- [ ] Drag & drop: Shows role/field selector
- [ ] Drag & drop: Activates target editor if inactive

#### 6.3 Commit

```bash
git commit -am "refactor: Extract import/export to BaseEditor

- Extract exportItem(), importItem(), importFile()
- Configurable MIME types and comment styles
- Reduces duplication by ~150 lines

Tested:
- Export creates correct file type
- Import validates file type and size
- Import preserves undo history
- Drag & drop shows selector and activates editor

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Phase 7: Extract Formatting Operations

**Goal**: Extract code formatting functionality

**Complexity**: Low | **Risk**: Low | **Est. Time**: 1 hour

#### 7.1 Extract Functions

Add to `BaseEditor`:

```javascript
/**
 * Format code for a specific item
 * @param {string} itemId - Item identifier
 * @param {boolean} silent - If true, suppress success toast
 * @returns {Object|null} - { changed: boolean, label: string } or null on error/empty
 */
async formatItem(itemId, silent = false) {
    if (!this.context.Formatter.isReady()) {
        this.context.UI.showToast('Code formatting is currently unavailable', 'warning');
        return null;
    }

    const item = this.editorState[itemId];
    const editor = this.monacoEditors[itemId];

    if (!item || !editor) return null;

    try {
        const editorType = this.config.editorType.toUpperCase();
        console.log(`[${editorType} Editor] Formatting ${itemId}...`);

        // Get current content
        const content = editor.getValue();

        if (!content || content.trim() === '') {
            this.context.UI.showToast('Nothing to format', 'warning');
            return null;
        }

        // Format using Prettier
        const formatterMethod = this.config.formatterMethod; // 'formatCSS' or 'formatHTML'
        const formatted = await this.context.Formatter[formatterMethod](content);

        // Check if content actually changed
        const changed = content !== formatted;

        // Update editor with formatted content
        editor.setValue(formatted);

        // Mark as dirty if content changed
        item.content = formatted;
        item.isDirty = item.content !== this.originalContent[itemId];
        this.updateToggleButtons();

        if (!silent) {
            const message = changed
                ? `${item.label} formatted`
                : `${item.label} already formatted`;
            this.context.UI.showToast(message, 'success');
        }

        return { changed, label: item.label };
    } catch (error) {
        const editorType = this.config.editorType.toUpperCase();
        console.error(`[${editorType} Editor] Format ${itemId} failed:`, error);
        this.context.UI.showToast(`Formatting failed: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Format all active editors
 */
async formatAllActive() {
    if (!this.context.Formatter.isReady()) {
        this.context.UI.showToast('Code formatting is currently unavailable', 'warning');
        return;
    }

    const activeItems = Object.keys(this.editorState).filter(
        id => this.editorState[id].active
    );

    if (activeItems.length === 0) {
        this.context.UI.showToast('No editors open to format', 'warning');
        return;
    }

    try {
        const editorType = this.config.editorType.toUpperCase();
        console.log(`[${editorType} Editor] Formatting ${activeItems.length} active editor(s)...`);

        // Format each active editor (silent mode to avoid duplicate toasts)
        const results = [];
        for (const itemId of activeItems) {
            const result = await this.formatItem(itemId, true);
            if (result) {
                results.push(result);
            }
        }

        // Build appropriate toast message based on what actually changed
        const changedResults = results.filter(r => r.changed);
        const changedCount = changedResults.length;

        let message;
        if (changedCount === 0) {
            message = results.length === 1
                ? `${results[0].label} already formatted`
                : 'Already formatted';
        } else if (changedCount === 1) {
            message = `${changedResults[0].label} formatted`;
        } else {
            message = `${changedCount} editors formatted`;
        }

        this.context.UI.showToast(message, 'success');
    } catch (error) {
        const editorType = this.config.editorType.toUpperCase();
        console.error(`[${editorType} Editor] Format all active failed:`, error);
        this.context.UI.showToast(`Formatting failed: ${error.message}`, 'error');
    }
}
```

#### 7.2 Testing

**Test Cases**:
- [ ] Format: CSS uses formatCSS(), HTML uses formatHTML()
- [ ] Format: Reports "already formatted" if no changes
- [ ] Format: Updates dirty state correctly
- [ ] Format all: Formats multiple editors
- [ ] Format all: Reports accurate change count

#### 7.3 Commit

```bash
git commit -am "refactor: Extract formatting to BaseEditor

- Extract formatItem(), formatAllActive()
- Dynamically calls correct formatter method (CSS/HTML)
- Reduces duplication by ~100 lines

Tested:
- CSS uses formatCSS method
- HTML uses formatHTML method
- Dirty state updates correctly
- Batch formatting works

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Phase 8: Extract Save/Revert Operations (HIGH RISK)

**Goal**: Extract save, discard, and revert functionality

**Complexity**: High | **Risk**: HIGH | **Est. Time**: 4-6 hours

⚠️ **CRITICAL PHASE** - This handles user data persistence. Extra thorough testing required.

#### 8.1 Extract Save Operations

Add to `BaseEditor`:

```javascript
/**
 * Save a single item
 */
async saveItem(itemId) {
    try {
        const editorType = this.config.editorType.toUpperCase();
        console.log(`[${editorType} Editor] Saving ${itemId}...`);

        const item = this.editorState[itemId];
        if (!item) {
            throw new Error(`${this.config.itemLabel} ${itemId} not found`);
        }

        // Sync editor value to state
        const editor = this.monacoEditors[itemId];
        if (editor) {
            item.content = editor.getValue();
        }

        // Format on save if enabled
        const settings = this.context.Storage.getFormatterSettings();
        if (settings.formatOnSave && this.context.Formatter.isReady() &&
            item.content && item.content.trim() !== '') {
            try {
                console.log(`[${editorType} Editor] Auto-formatting ${itemId} before save...`);
                const formatterMethod = this.config.formatterMethod;
                const formatted = await this.context.Formatter[formatterMethod](item.content);
                item.content = formatted;
                if (editor) {
                    editor.setValue(formatted);
                }
            } catch (formatError) {
                console.warn(`[${editorType} Editor] Auto-format failed for ${itemId}:`, formatError);
                // Continue with save even if formatting fails
            }
        }

        // Check if this item has changes
        if (!item.isDirty && item.content === this.originalContent[itemId]) {
            this.context.UI.showToast(`${item.label} has no changes to save`, 'warning');
            return;
        }

        // Capture content being saved (to detect edits during save)
        const contentBeingSaved = item.content;

        // Build form data - send the edited item + original content for others
        const formData = { csrf_token: this.csrfToken };

        this.config.itemsConfig.forEach(({ id }) => {
            const fieldName = `${this.config.formFieldPrefix}${id}`;
            formData[fieldName] = id === itemId
                ? this.editorState[id].content
                : this.originalContent[id];
        });

        const { body, boundary } = this.context.API.buildMultipartBody(formData);

        const response = await this.context.API.fetch(this.config.apiEndpoint, {
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
            this.context.UI.showToast(`${item.label} saved successfully!`, 'success');

            // Update original content to what was actually saved
            this.originalContent[itemId] = contentBeingSaved;

            // Only mark clean if content hasn't changed during save
            const currentContent = editor ? editor.getValue() : item.content;
            if (currentContent === contentBeingSaved) {
                item.isDirty = false;
            } else {
                item.isDirty = true;
                console.log(`[${editorType} Editor] ${itemId} content changed during save, keeping dirty state`);
            }

            this.updateToggleButtons();
            this.saveState();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

    } catch (error) {
        const editorType = this.config.editorType.toUpperCase();
        console.error(`[${editorType} Editor] Save ${itemId} failed:`, error);
        this.context.UI.showToast(`Failed to save: ${error.message}`, 'error');
    }
}

/**
 * Save all items
 */
async saveAll() {
    try {
        const editorType = this.config.editorType.toUpperCase();
        console.log(`[${editorType} Editor] Saving all...`);

        // Sync editor values to state
        Object.keys(this.monacoEditors).forEach(itemId => {
            const editor = this.monacoEditors[itemId];
            if (editor) {
                this.editorState[itemId].content = editor.getValue();
            }
        });

        // Format on save if enabled
        const settings = this.context.Storage.getFormatterSettings();
        if (settings.formatOnSave && this.context.Formatter.isReady()) {
            for (const itemId of Object.keys(this.editorState)) {
                const item = this.editorState[itemId];
                if (item.content && item.content.trim() !== '') {
                    try {
                        console.log(`[${editorType} Editor] Auto-formatting ${itemId} before save...`);
                        const formatterMethod = this.config.formatterMethod;
                        const formatted = await this.context.Formatter[formatterMethod](item.content);
                        item.content = formatted;
                        const editor = this.monacoEditors[itemId];
                        if (editor) {
                            editor.setValue(formatted);
                        }
                    } catch (formatError) {
                        console.warn(`[${editorType} Editor] Auto-format failed for ${itemId}:`, formatError);
                    }
                }
            }
        }

        // Check if any item has changes
        const hasChanges = Object.keys(this.editorState).some(itemId => {
            return this.editorState[itemId].isDirty ||
                   this.editorState[itemId].content !== this.originalContent[itemId];
        });

        if (!hasChanges) {
            this.context.UI.showToast('No changes to save', 'warning');
            return;
        }

        // Capture content being saved for all items
        const contentBeingSaved = {};
        Object.keys(this.editorState).forEach(itemId => {
            contentBeingSaved[itemId] = this.editorState[itemId].content;
        });

        // Build form data
        const formData = { csrf_token: this.csrfToken };

        this.config.itemsConfig.forEach(({ id }) => {
            const fieldName = `${this.config.formFieldPrefix}${id}`;
            formData[fieldName] = this.editorState[id].content;
        });

        const { body, boundary } = this.context.API.buildMultipartBody(formData);

        const response = await this.context.API.fetch(this.config.apiEndpoint, {
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
            const fileType = this.config.editorType.toUpperCase();
            this.context.UI.showToast(`${fileType} saved successfully!`, 'success');

            // Update original content and dirty flags
            Object.keys(this.editorState).forEach(itemId => {
                this.originalContent[itemId] = contentBeingSaved[itemId];

                const editor = this.monacoEditors[itemId];
                const currentContent = editor ? editor.getValue() : this.editorState[itemId].content;
                if (currentContent === contentBeingSaved[itemId]) {
                    this.editorState[itemId].isDirty = false;
                } else {
                    this.editorState[itemId].isDirty = true;
                    console.log(`[${editorType} Editor] ${itemId} content changed during save, keeping dirty state`);
                }
            });

            this.updateToggleButtons();
            this.saveState();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

    } catch (error) {
        const editorType = this.config.editorType.toUpperCase();
        const fileType = this.config.editorType.toUpperCase();
        console.error(`[${editorType} Editor] Save failed:`, error);
        this.context.UI.showToast(`Failed to save ${fileType}: ${error.message}`, 'error');
    }
}

/**
 * Save only the currently open tabs
 */
async saveOpenTabs() {
    try {
        const openItems = Object.keys(this.editorState).filter(
            id => this.editorState[id].active
        );

        if (openItems.length === 0) {
            this.context.UI.showToast('No tabs open to save', 'warning');
            return;
        }

        const editorType = this.config.editorType.toUpperCase();
        console.log(`[${editorType} Editor] Saving ${openItems.length} open tab(s):`, openItems);

        // Sync editor values to state for open tabs
        openItems.forEach(itemId => {
            const editor = this.monacoEditors[itemId];
            if (editor) {
                this.editorState[itemId].content = editor.getValue();
            }
        });

        // Format on save if enabled
        const settings = this.context.Storage.getFormatterSettings();
        if (settings.formatOnSave && this.context.Formatter.isReady()) {
            for (const itemId of openItems) {
                const item = this.editorState[itemId];
                if (item.content && item.content.trim() !== '') {
                    try {
                        console.log(`[${editorType} Editor] Auto-formatting ${itemId} before save...`);
                        const formatterMethod = this.config.formatterMethod;
                        const formatted = await this.context.Formatter[formatterMethod](item.content);
                        item.content = formatted;
                        const editor = this.monacoEditors[itemId];
                        if (editor) {
                            editor.setValue(formatted);
                        }
                    } catch (formatError) {
                        console.warn(`[${editorType} Editor] Auto-format failed for ${itemId}:`, formatError);
                    }
                }
            }
        }

        // Check if any open tab has changes
        const hasChanges = openItems.some(itemId => {
            return this.editorState[itemId].isDirty ||
                   this.editorState[itemId].content !== this.originalContent[itemId];
        });

        if (!hasChanges) {
            const tabLabel = openItems.length === 1
                ? this.editorState[openItems[0]].label
                : `${openItems.length} tabs`;
            this.context.UI.showToast(`${tabLabel} have no changes to save`, 'warning');
            return;
        }

        // Capture content being saved for open tabs
        const contentBeingSaved = {};
        openItems.forEach(itemId => {
            contentBeingSaved[itemId] = this.editorState[itemId].content;
        });

        // Build form data - send edited content for open tabs, original for closed tabs
        const formData = { csrf_token: this.csrfToken };

        this.config.itemsConfig.forEach(({ id }) => {
            const fieldName = `${this.config.formFieldPrefix}${id}`;
            formData[fieldName] = openItems.includes(id)
                ? this.editorState[id].content
                : this.originalContent[id];
        });

        const { body, boundary } = this.context.API.buildMultipartBody(formData);

        const response = await this.context.API.fetch(this.config.apiEndpoint, {
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
            const tabLabel = openItems.length === 1
                ? this.editorState[openItems[0]].label
                : `${openItems.length} tabs`;
            this.context.UI.showToast(`${tabLabel} saved successfully!`, 'success');

            // Update original content and dirty flags for saved tabs
            openItems.forEach(itemId => {
                this.originalContent[itemId] = contentBeingSaved[itemId];

                const editor = this.monacoEditors[itemId];
                const currentContent = editor ? editor.getValue() : this.editorState[itemId].content;
                if (currentContent === contentBeingSaved[itemId]) {
                    this.editorState[itemId].isDirty = false;
                } else {
                    this.editorState[itemId].isDirty = true;
                    console.log(`[${editorType} Editor] ${itemId} content changed during save, keeping dirty state`);
                }
            });

            this.updateToggleButtons();
            this.saveState();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

    } catch (error) {
        const editorType = this.config.editorType.toUpperCase();
        console.error(`[${editorType} Editor] Save open tabs failed:`, error);
        this.context.UI.showToast('Failed to save: ' + error.message, 'error');
    }
}
```

#### 8.2 Extract Revert/Discard Operations

```javascript
/**
 * Discard all changes (with inline confirmation)
 */
discardAll() {
    const hasUnsavedChanges = Object.values(this.editorState).some(item => item.isDirty);
    const discardBtn = document.getElementById('discard-btn');

    if (hasUnsavedChanges) {
        if (discardBtn && !discardBtn.classList.contains('confirming')) {
            this.context.UI.showInlineConfirmation(discardBtn, () => {
                this.performDiscardAll();
            });
        }
        return;
    }

    // No changes - show "No changes" message
    if (discardBtn && !discardBtn.classList.contains('showing-no-changes')) {
        this.context.UI.showNoChangesMessage(discardBtn);
    }
}

/**
 * Execute discard all (after confirmation)
 */
performDiscardAll() {
    const editorType = this.config.editorType.toUpperCase();
    console.log(`[${editorType} Editor] performDiscardAll executing`);

    Object.keys(this.editorState).forEach(itemId => {
        this.editorState[itemId].content = this.originalContent[itemId] || '';
        this.editorState[itemId].isDirty = false;

        const editor = this.monacoEditors[itemId];
        if (editor) {
            editor.setValue(this.editorState[itemId].content);
        }
    });

    this.updateToggleButtons();

    // Check if all editors are now clean - if so, clear app state
    const allClean = Object.values(this.editorState).every(s => !s.isDirty);
    if (allClean) {
        const appId = `${this.config.editorType}-editor`;
        console.log(`[${editorType} Editor] All editors clean, clearing app state`);
        this.context.Storage.clearAppState(appId);
    } else {
        this.saveState();
    }

    this.context.UI.showToast('All changes discarded', 'success');
}

/**
 * Revert changes for a specific item (with inline confirmation)
 */
revertItem(itemId) {
    const editorType = this.config.editorType.toUpperCase();
    const dataAttr = this.config.dataAttribute;
    console.log(`[${editorType} Editor] revertItem called for: ${itemId}`);

    const item = this.editorState[itemId];
    if (!item) return;

    const revertBtn = document.querySelector(`[data-revert-${dataAttr}="${itemId}"]`);
    if (!revertBtn) return;

    if (item.isDirty) {
        if (!revertBtn.classList.contains('confirming')) {
            this.context.UI.showInlineConfirmation(revertBtn, () => {
                this.performRevert(itemId);
            });
        }
        return;
    }

    // No changes - show "No changes" message
    if (!revertBtn.classList.contains('showing-no-changes')) {
        this.context.UI.showNoChangesMessage(revertBtn);
    }
}

/**
 * Execute revert (after confirmation)
 */
performRevert(itemId) {
    const editorType = this.config.editorType.toUpperCase();
    const dataAttr = this.config.dataAttribute;
    console.log(`[${editorType} Editor] performRevert executing for: ${itemId}`);

    const item = this.editorState[itemId];
    if (!item) return;

    item.content = this.originalContent[itemId] || '';
    item.isDirty = false;

    const editor = this.monacoEditors[itemId];
    if (editor) {
        editor.setValue(item.content);
    }

    // Close the dropdown
    const menu = document.querySelector(`[data-menu-${dataAttr}="${itemId}"]`);
    if (menu) {
        menu.classList.remove('show');
    }

    this.updateToggleButtons();

    // Check if all editors are now clean - if so, clear app state
    const allClean = Object.values(this.editorState).every(s => !s.isDirty);
    if (allClean) {
        const appId = `${this.config.editorType}-editor`;
        console.log(`[${editorType} Editor] All editors clean, clearing app state`);
        this.context.Storage.clearAppState(appId);
    } else {
        this.saveState();
    }

    this.context.UI.showToast(`${item.label} reverted`, 'success');
}
```

#### 8.3 COMPREHENSIVE Testing (CRITICAL)

**Save Operations Test Matrix**:

| Test Case | CSS Editor | HTML Editor | Expected Result |
|-----------|-----------|-------------|-----------------|
| Save single role/field | ✅ | ✅ | Saves to server |
| Save all | ✅ | ✅ | All items saved |
| Save open tabs (1 tab) | ✅ | ✅ | Single tab saved |
| Save open tabs (multiple) | ✅ | ✅ | Multiple tabs saved |
| Save with no changes | ✅ | ✅ | Warning toast shown |
| Save with format-on-save enabled | ✅ | ✅ | Code formatted before save |
| Save while typing (race condition) | ✅ | ✅ | Dirty state preserved (Issue #85) |
| Save fails (network error) | ✅ | ✅ | Error toast shown |
| Discard all | ✅ | ✅ | Content reverted |
| Discard with no changes | ✅ | ✅ | "No changes" message |
| Revert single item | ✅ | ✅ | Item reverted |
| Revert with no changes | ✅ | ✅ | "No changes" message |

**Manual Testing Checklist**:
- [ ] Make edits to CSS role, save individual → verify saved to server
- [ ] Make edits to multiple CSS roles, save all → verify all saved
- [ ] Make edits to HTML field, save individual → verify saved to server
- [ ] Make edits to both HTML fields, save all → verify all saved
- [ ] Start typing in editor, immediately click save → verify dirty state preserved (race condition test)
- [ ] Enable format-on-save, make messy edits, save → verify formatted before save
- [ ] Make edits, discard all → verify reverted to original
- [ ] Make edits to one role, revert it → verify only that role reverted
- [ ] Reload page after save → verify changes persisted
- [ ] Switch apps after save → verify state isolated

#### 8.4 Commit

```bash
git commit -am "refactor: Extract save/revert operations to BaseEditor

⚠️ HIGH RISK CHANGE - Thoroughly tested ⚠️

- Extract saveItem(), saveAll(), saveOpenTabs()
- Extract discardAll(), performDiscardAll()
- Extract revertItem(), performRevert()
- Configurable API endpoints and form field names
- Preserves Issue #85 race condition fix
- Reduces duplication by ~400 lines

Tested (see REFACTOR_PLAN.md for full test matrix):
✅ Save single item (CSS & HTML)
✅ Save all items (CSS & HTML)
✅ Save open tabs (CSS & HTML)
✅ Race condition handling (typing during save)
✅ Format-on-save integration
✅ Discard all with confirmation
✅ Revert individual items
✅ Network error handling
✅ State persistence across reloads

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Phase 9: Extract Remaining UI & Lifecycle

**Goal**: Extract final shared methods (mount, unmount, etc.)

**Complexity**: Medium | **Risk**: Medium | **Est. Time**: 3-4 hours

#### 9.1 Extract loadData()

```javascript
/**
 * Load data from API
 * @param {boolean} skipContent - If true, only fetch CSRF token (checkpoint protection)
 */
async loadData(skipContent = false) {
    try {
        const response = await this.context.API.fetch(this.config.apiEndpoint);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const { doc, data } = this.context.API.parseFormHTML(html);

        // Always extract CSRF token
        this.csrfToken = data.csrf_token;

        if (skipContent) {
            // Checkpoint protection: we have dirty edits, so don't fetch content
        } else {
            // No dirty edits - safe to fetch fresh content from server
            this.config.itemsConfig.forEach(({ id }) => {
                const fieldName = `${this.config.formFieldPrefix}${id}`;
                const textarea = doc.querySelector(`textarea[name="${fieldName}"]`);
                if (textarea) {
                    const content = textarea.textContent;
                    this.editorState[id].content = content;
                    this.originalContent[id] = content;
                }
            });
        }

        // Show editor container
        const containerId = `${this.config.editorType}-editor-container`;
        document.getElementById(containerId).style.display = 'block';

        const editorType = this.config.editorType.toUpperCase();
        console.log(`[${editorType} Editor] Data loaded`);

    } catch (error) {
        const editorType = this.config.editorType.toUpperCase();
        console.error(`[${editorType} Editor] Failed to load data:`, error);
        this.context.UI.showToast(`Failed to load ${editorType}: ${error.message}`, 'error');
    }
}
```

*(Continue with buildToggleBar, createEditorPane, setupKeyboardShortcuts, etc.)*

#### 9.2 Testing

Test all extracted methods individually.

#### 9.3 Commit

---

### Phase 10: Finalize & Document

**Goal**: Complete refactoring, update documentation

**Complexity**: Low | **Risk**: Low | **Est. Time**: 2 hours

#### 10.1 Final Code Review

- [ ] All duplicated code extracted
- [ ] Both editors working correctly
- [ ] All tests passing
- [ ] No console errors

#### 10.2 Update Documentation

Update `docs/ARCHITECTURE.md`:

```markdown
### Base Editor Pattern

The CSS Editor and HTML Editor both extend from a shared `BaseEditor` class,
eliminating ~1,400 lines of code duplication.

**Architecture**:
```
BaseEditor (src/base-editor.js)
  ├── CSS Editor (src/css-editor.js) - Adds live preview
  └── HTML Editor (src/html-editor.js) - Minimal overrides
```

**Configuration**:
Each editor provides configuration that customizes BaseEditor behavior:
- Data model (roles vs fields)
- API endpoints
- Form field names
- Monaco language
- File types
- Formatter methods
```

#### 10.3 Create Summary Document

Create `docs/REFACTOR_COMPLETE.md`:

```markdown
# DRY Refactoring - Completion Report

## Summary

Successfully refactored CSS Editor and HTML Editor to eliminate code duplication
using a BaseEditor class.

## Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Lines | 3,925 | 2,500 | -36% |
| CSS Editor | 2,133 | 700 | -67% |
| HTML Editor | 1,792 | 300 | -83% |
| Duplicated Functions | 36 | 0 | -100% |

## Files Modified

- Created: `src/base-editor.js` (1,500 lines)
- Modified: `src/css-editor.js` (-1,433 lines)
- Modified: `src/html-editor.js` (-1,492 lines)

## Testing

All features verified working:
- ✅ Save/load operations
- ✅ Import/export
- ✅ Formatting
- ✅ State persistence
- ✅ Mobile/desktop views
- ✅ Keyboard shortcuts
- ✅ CSS live preview (unique feature preserved)

## Benefits

1. **Maintainability**: Fix bugs once, applies to both editors
2. **Consistency**: Guaranteed identical behavior
3. **Extensibility**: Easy to add new editor types
4. **Testing**: Test shared logic once
5. **Readability**: Each editor focuses on unique features
```

#### 10.4 Final Commit

```bash
git commit -am "refactor: Complete DRY refactor - reduce codebase by 1,400+ lines

Summary:
- Created BaseEditor class with all shared functionality
- CSS Editor reduced from 2,133 to 700 lines (-67%)
- HTML Editor reduced from 1,792 to 300 lines (-83%)
- Total reduction: 1,425 lines (-36%)
- Zero duplicated functions (was 36)

Benefits:
- Single source of truth for editor logic
- Easier maintenance and bug fixes
- Foundation for future editor types
- Improved code organization
- 100% backward compatible

Documentation:
- Updated ARCHITECTURE.md
- Created REFACTOR_COMPLETE.md with metrics

All tests passing. Ready for review.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com}"
```

---

## Testing Strategy

### Automated Testing

**Build Test** (run after each phase):
```bash
npm run build
# Should complete without errors
```

### Manual Testing Checklist

**Run after Phase 8 (Save Operations) and Phase 10 (Final)**:

#### CSS Editor Tests

- [ ] Open CSS Editor app
- [ ] Open/close multiple role editors
- [ ] Make edits to "All Roles", verify dirty indicator
- [ ] Save individual role → reload → verify persisted
- [ ] Save all roles → reload → verify persisted
- [ ] Import CSS file → verify appended with timestamp
- [ ] Export role → verify downloads correct file
- [ ] Format code → verify Prettier formatting applied
- [ ] Enable live preview → make edits → verify styles apply to page
- [ ] Switch to mobile view (< 920px) → verify dropdown appears
- [ ] Test keyboard shortcuts: Ctrl+S, Ctrl+Shift+S, Ctrl+Shift+F
- [ ] Discard all changes → verify reverted
- [ ] Revert single role → verify reverted
- [ ] Race condition: Type while clicking save → verify dirty state preserved

#### HTML Editor Tests

- [ ] Open HTML Editor app
- [ ] Open/close Head/Tail editors
- [ ] Make edits to "Head", verify dirty indicator
- [ ] Save individual field → reload → verify persisted
- [ ] Save all fields → reload → verify persisted
- [ ] Import HTML file → verify appended with timestamp
- [ ] Export field → verify downloads correct file
- [ ] Format code → verify Prettier formatting applied
- [ ] Switch to mobile view (< 920px) → verify dropdown appears
- [ ] Test keyboard shortcuts: Ctrl+S, Ctrl+Shift+S, Ctrl+Shift+F
- [ ] Discard all changes → verify reverted
- [ ] Revert single field → verify reverted
- [ ] Race condition: Type while clicking save → verify dirty state preserved

#### Cross-App Tests

- [ ] Make edits in CSS Editor → switch to HTML Editor → verify CSS state persists
- [ ] Make edits in HTML Editor → switch to CSS Editor → verify HTML state persists
- [ ] Reload page → verify last active app restored

---

## Rollback Procedures

### Rollback Single Phase

```bash
# Revert last commit
git revert HEAD

# Or reset to previous commit (destructive)
git reset --hard HEAD~1
```

### Rollback to Specific Phase

```bash
# Find commit hash for desired phase
git log --oneline

# Reset to that commit
git reset --hard <commit-hash>

# Force push (if already pushed)
git push --force
```

### Complete Rollback

```bash
# Restore from backup branch
git checkout refactor/dry-principles-apps-backup
git branch -D refactor/dry-principles-apps
git checkout -b refactor/dry-principles-apps
```

---

## Success Criteria

### Phase Completion Criteria

Each phase is complete when:
- [ ] Code compiles without errors (`npm run build`)
- [ ] All phase-specific tests pass
- [ ] Commit created with clear message
- [ ] No console errors in browser

### Overall Success Criteria

Refactoring is complete when:
- [ ] All 10 phases completed
- [ ] Build successful: `npm run build`
- [ ] All manual tests passing
- [ ] Documentation updated
- [ ] Code review completed
- [ ] PR approved and merged to `develop`

### Quality Gates

**Must achieve**:
- ✅ 100% backward compatibility
- ✅ All existing features working
- ✅ No new console errors
- ✅ State persistence working
- ✅ Save operations reliable (Issue #85 fix preserved)

**Nice to have**:
- ✅ Improved code coverage
- ✅ Performance improvements
- ✅ Better error messages

---

## Risk Mitigation

### High-Risk Areas

1. **Save Operations** (Phase 8)
   - **Risk**: Data loss or corruption
   - **Mitigation**: Extensive testing, preserve race condition fix
   - **Rollback**: Revert Phase 8 commit

2. **Monaco Integration** (Phase 5)
   - **Risk**: Editor initialization failures
   - **Mitigation**: Test with both CSS and HTML modes
   - **Rollback**: Revert Phase 5 commit

3. **State Management** (Phase 3)
   - **Risk**: Lost state across reloads
   - **Mitigation**: Test persistence thoroughly
   - **Rollback**: Revert Phase 3 commit

### Monitoring

**After each phase, check for**:
- Console errors
- Network request failures
- localStorage corruption
- UI rendering issues

---

**Document Version**: 1.0
**Date**: 2025-01-03
**Status**: Ready for implementation
**Estimated Total Time**: 20-25 hours
**Estimated Completion**: Atomic (can be done incrementally)
