# Save Operations DRY Refactor Design

**Date:** 2025-11-13
**Status:** Approved for implementation
**Estimated Effort:** 4-6 hours

## Overview

Extract duplicated save operations from CSS Editor and HTML Editor to BaseEditor, eliminating the largest remaining DRY violation (~300-400 lines of duplicated code) from the editor refactoring.

## Goals

1. **Eliminate duplication** in save operations (`saveItem`, `saveAll`, `saveOpenTabs`)
2. **Improve UX** with better Ctrl+S behavior (save active editor, not all open tabs)
3. **Standardize button state management** (spinner + disable all buttons during save)
4. **Quick win** - Extract `injectFormatButtons()` first to validate pattern

## Current State

### Duplicated Code

**Three save methods duplicated across both editors:**
- `saveRole()`/`saveField()` - saves single item (~120 lines each)
- `saveAll()` - saves all items (~130 lines each)
- `saveOpenTabs()` - saves open tabs (~100 lines each)

**Shared patterns in all methods:**
- Button state management (disable all, show spinner, restore)
- Sync editor values to state
- Format-on-save logic (identical except formatter method name)
- Change detection
- Content capture for concurrent edit detection
- Form data building (structure differs, pattern identical)
- HTTP request with identical headers
- Response handling with dirty state tracking
- Error handling and finally blocks

**Also duplicated:**
- `injectFormatButtons()` - 33 lines, differs only in data attribute name

### Problems

1. **Violates DRY principle** - any bug fix must be applied 6 times (3 methods × 2 editors)
2. **Inconsistent behavior** - HTML Editor `saveField()` lacks button management
3. **Suboptimal UX** - Ctrl+S saves all open tabs instead of active editor
4. **Testing burden** multiplied across duplicate implementations

## Proposed Solution

### Phase 1: Quick Win - Extract `injectFormatButtons()`

**Effort:** 30 minutes

Move `injectFormatButtons()` to BaseEditor to validate extraction pattern.

**Implementation:**

```javascript
// In BaseEditor
injectFormatButtons() {
    const dataAttr = this.config.dataAttribute; // 'role' or 'field'
    const editorTypeUpper = this.getEditorTypeUpper();

    this.log('Injecting format buttons into rendered panes');

    const panes = document.querySelectorAll('.editor-pane');

    panes.forEach(pane => {
        const actions = pane.querySelector('.editor-pane-actions');
        const exportBtn = pane.querySelector('.editor-pane-export');

        if (!actions || !exportBtn) return;
        if (pane.querySelector('.editor-pane-format')) return;

        const itemId = exportBtn.getAttribute(`data-export-${dataAttr}`);
        if (!itemId) return;

        const formatBtn = this.context.DOM.create('button', {
            className: 'editor-pane-format',
            [`data-format-${dataAttr}`]: itemId,
            title: `Format ${editorTypeUpper} (Ctrl+Shift+F)`
        }, ['Format']);

        formatBtn.addEventListener('click', () => {
            if (this.onFormatItem) {
                this.onFormatItem(itemId);
            }
        });

        actions.insertBefore(formatBtn, exportBtn);
    });
}
```

**Child editors:**
```javascript
// In css-editor.js and html-editor.js init():
this._baseEditor.onFormatItem = (itemId) => this.formatItem(itemId);
```

### Phase 2: Active Editor Tracking

**Effort:** 1 hour

Track which Monaco editor has focus to enable better Ctrl+S behavior.

**Implementation:**

```javascript
// In BaseEditor constructor
this.activeEditorId = null;

// New method
setupEditorFocusTracking(itemId, editor) {
    editor.onDidFocusEditorWidget(() => {
        this.activeEditorId = itemId;
        this.log(`Editor focus: ${itemId}`);
    });

    editor.onDidBlurEditorWidget(() => {
        if (this.activeEditorId === itemId) {
            this.activeEditorId = null;
        }
    });
}

// Integration in createMonacoEditor()
createMonacoEditor(itemId, container, initialValue) {
    // ... existing monaco creation ...
    const editor = monaco.editor.create(container, options);
    this.setupEditorFocusTracking(itemId, editor);
    // ... rest ...
    return editor;
}
```

**Updated keyboard shortcuts:**

```javascript
// In BaseEditor.setupKeyboardShortcuts()
this.keyboardHandler = (e) => {
    // Ctrl+S - Save active editor (NEW BEHAVIOR)
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        const activeId = this.getActiveEditorId();
        if (activeId && this.onSaveItem) {
            const dataAttr = this.config.dataAttribute;
            const saveBtn = document.querySelector(`[data-save-${dataAttr}="${activeId}"]`);
            this.onSaveItem(activeId, saveBtn);
        } else {
            this.context.UI.showToast('No editor focused', 'info');
        }
    }
    // Ctrl+Shift+S - Save all (unchanged)
    else if ((e.ctrlKey || e.metaKey) && e.key === 'S' && e.shiftKey) {
        e.preventDefault();
        if (this.onSaveAll) {
            const saveAllBtn = document.getElementById('save-btn');
            this.onSaveAll(saveAllBtn);
        }
    }
    // ... rest unchanged ...
};
```

**Eliminates:** `saveOpenTabs()` method entirely (100+ lines per editor)

### Phase 3: Button State Management

**Effort:** 1 hour

Centralize button state management for consistent UX and state protection.

**UX Principles:**
1. **Visual feedback** - Show spinner on button that triggered action
2. **State protection** - Disable ALL save/discard buttons during any save operation

**Implementation:**

```javascript
// In BaseEditor

prepareSaveUI(triggerButton) {
    const dataAttr = this.config.dataAttribute;

    // Find all buttons
    const saveAllBtn = document.getElementById('save-btn');
    const saveItemBtns = document.querySelectorAll(`[data-save-${dataAttr}]`);
    const discardBtns = document.querySelectorAll(`[data-discard-${dataAttr}], #discard-btn`);

    const restoreData = {
        triggerButton: null,
        allButtons: []
    };

    // Show spinner on trigger button
    if (triggerButton) {
        restoreData.triggerButton = {
            element: triggerButton,
            text: triggerButton.textContent,
            disabled: triggerButton.disabled
        };

        triggerButton.disabled = true;
        triggerButton.classList.add('saving');
        triggerButton.innerHTML = '<span class="spinner"></span> Saving...';
    }

    // Disable all buttons
    const allButtons = [
        saveAllBtn,
        ...Array.from(saveItemBtns),
        ...Array.from(discardBtns)
    ].filter(btn => btn);

    allButtons.forEach(btn => {
        restoreData.allButtons.push({
            element: btn,
            disabled: btn.disabled
        });
        btn.disabled = true;
    });

    return restoreData;
}

restoreSaveUI(restoreData) {
    // Restore trigger button
    if (restoreData.triggerButton) {
        const { element, text, disabled } = restoreData.triggerButton;
        element.disabled = disabled;
        element.classList.remove('saving');
        element.textContent = text;
    }

    // Restore all buttons
    restoreData.allButtons.forEach(({ element, disabled }) => {
        element.disabled = disabled;
    });
}
```

### Phase 4: Save Operations Extraction

**Effort:** 2-3 hours

Extract `saveItem()` and `saveAll()` to BaseEditor with hook-based form data construction.

#### Save Methods

**Two methods (not three - `saveOpenTabs` eliminated):**

```javascript
// In BaseEditor

async saveItem(itemId, triggerButton) {
    const restoreData = this.prepareSaveUI(triggerButton);

    try {
        this.log(`Saving ${itemId}...`);

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
        await this.formatItemIfNeeded(itemId, item, editor);

        // Check for changes
        if (!item.isDirty && item.content === this.originalContent[itemId]) {
            this.context.UI.showToast(`${item.label} has no changes to save`, 'warning');
            return;
        }

        // Capture content (concurrent edit detection)
        const contentBeingSaved = item.content;

        // Build form data via hook
        if (!this.buildFormDataForSave) {
            throw new Error('buildFormDataForSave hook not implemented');
        }
        const formData = this.buildFormDataForSave(itemId);

        // POST
        const response = await this.postFormData(formData);

        if (response.ok || response.redirected) {
            this.context.UI.showToast(`${item.label} saved successfully!`, 'success');

            // Update state
            this.originalContent[itemId] = contentBeingSaved;

            // Only mark clean if content unchanged during save
            const currentContent = editor ? editor.getValue() : item.content;
            if (currentContent === contentBeingSaved) {
                item.isDirty = false;
            } else {
                item.isDirty = true;
                this.log(`${itemId} changed during save, keeping dirty`);
            }

            this.updateToggleButtons();
            this.saveState();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

    } catch (error) {
        this.logError(`Save ${itemId} failed:`, error);
        this.context.UI.showToast(`Failed to save: ${error.message}`, 'error');
    } finally {
        this.restoreSaveUI(restoreData);
    }
}

async saveAll(triggerButton) {
    const restoreData = this.prepareSaveUI(triggerButton);

    try {
        this.log('Saving all...');

        // Sync ALL editor values to state
        for (const config of this.config.itemsConfig) {
            const itemId = config.id;
            const item = this.editorState[itemId];
            const editor = this.monacoEditors[itemId];

            if (editor && item) {
                item.content = editor.getValue();
            }
        }

        // Format all items if needed
        for (const config of this.config.itemsConfig) {
            const itemId = config.id;
            const item = this.editorState[itemId];
            const editor = this.monacoEditors[itemId];

            if (item) {
                await this.formatItemIfNeeded(itemId, item, editor);
            }
        }

        // Check for any changes
        const hasChanges = this.config.itemsConfig.some(config => {
            const item = this.editorState[config.id];
            return item && (item.isDirty || item.content !== this.originalContent[config.id]);
        });

        if (!hasChanges) {
            this.context.UI.showToast('No changes to save', 'warning');
            return;
        }

        // Capture all content being saved
        const contentBeingSaved = {};
        this.config.itemsConfig.forEach(config => {
            const item = this.editorState[config.id];
            if (item) {
                contentBeingSaved[config.id] = item.content;
            }
        });

        // Build form data via hook
        if (!this.buildFormDataForSaveAll) {
            throw new Error('buildFormDataForSaveAll hook not implemented');
        }
        const formData = this.buildFormDataForSaveAll();

        // POST
        const response = await this.postFormData(formData);

        if (response.ok || response.redirected) {
            this.context.UI.showToast('All saved successfully!', 'success');

            // Update all state
            this.config.itemsConfig.forEach(config => {
                const itemId = config.id;
                const item = this.editorState[itemId];
                const editor = this.monacoEditors[itemId];

                if (item) {
                    this.originalContent[itemId] = contentBeingSaved[itemId];

                    const currentContent = editor ? editor.getValue() : item.content;
                    if (currentContent === contentBeingSaved[itemId]) {
                        item.isDirty = false;
                    } else {
                        item.isDirty = true;
                        this.log(`${itemId} changed during save, keeping dirty`);
                    }
                }
            });

            this.updateToggleButtons();
            this.saveState();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

    } catch (error) {
        this.logError('Save all failed:', error);
        this.context.UI.showToast(`Failed to save: ${error.message}`, 'error');
    } finally {
        this.restoreSaveUI(restoreData);
    }
}
```

#### Helper Methods

```javascript
// In BaseEditor

async formatItemIfNeeded(itemId, item, editor) {
    const settings = this.context.Storage.getFormatterSettings();

    if (!settings.formatOnSave || !this.context.Formatter.isReady()) {
        return;
    }

    if (!item.content || item.content.trim() === '') {
        return;
    }

    try {
        this.log(`Auto-formatting ${itemId} before save...`);

        const formatterMethod = this.config.formatterMethod;
        const formatted = await this.context.Formatter[formatterMethod](item.content);

        item.content = formatted;
        if (editor) {
            editor.setValue(formatted);
        }
    } catch (formatError) {
        console.warn(`[${this.getEditorTypeUpper()} Editor] Auto-format failed for ${itemId}:`, formatError);
    }
}

async postFormData(formData) {
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

    return response;
}
```

#### Hooks

```javascript
// In BaseEditor constructor - add these hooks
this.onFormatItem = null;           // Format single item
this.onSaveItem = null;             // Called by keyboard shortcut
this.onSaveAll = null;              // Called by keyboard shortcut
this.buildFormDataForSave = null;   // Build form data for single item
this.buildFormDataForSaveAll = null; // Build form data for all items
```

#### Configuration Updates

Add two new config fields:

```javascript
// In css-editor.js config
const config = {
    // ... existing fields ...
    apiEndpoint: '/deki/cp/custom_css.php?params=%2F',
    formatterMethod: 'formatCSS'
};

// In html-editor.js config
const config = {
    // ... existing fields ...
    apiEndpoint: '/deki/cp/custom_html.php?params=%2F',
    formatterMethod: 'formatHTML'
};
```

Update config validation:

```javascript
// In BaseEditor.validateConfig()
const required = [
    'editorType', 'itemsConfig', 'maxActiveEditors', 'apiEndpoint',
    'formFieldPrefix', 'monacoLanguage', 'fileExtension', 'mimeType',
    'commentStyle', 'formatterMethod', 'dataAttribute', 'itemLabel'
];
```

## Child Editor Changes

### Removed Code

**From both css-editor.js and html-editor.js:**
- `saveRole()`/`saveField()` methods (~120 lines each)
- `saveAll()` methods (~130 lines each)
- `saveOpenTabs()` methods (~100 lines each)
- `injectFormatButtons()` methods (~33 lines each)

**Total removed:** ~380 lines per editor = **~760 lines removed**

### Added Code

**In css-editor.js init():**

```javascript
// Hook implementations (~45 lines)
this._baseEditor.onSaveItem = (roleId, btn) => this._baseEditor.saveItem(roleId, btn);
this._baseEditor.onSaveAll = (btn) => this._baseEditor.saveAll(btn);
this._baseEditor.onFormatItem = (roleId) => this.formatRole(roleId);

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
```

**In html-editor.js init():**

```javascript
// Hook implementations (~30 lines)
this._baseEditor.onSaveItem = (fieldId, btn) => this._baseEditor.saveItem(fieldId, btn);
this._baseEditor.onSaveAll = (btn) => this._baseEditor.saveAll(btn);
this._baseEditor.onFormatItem = (fieldId) => this.formatField(fieldId);

this._baseEditor.buildFormDataForSave = (fieldId) => {
    return {
        csrf_token: csrfToken,
        html_template_head: fieldId === 'head' ? editorState.head.content : originalContent.head,
        html_template_tail: fieldId === 'tail' ? editorState.tail.content : originalContent.tail
    };
};

this._baseEditor.buildFormDataForSaveAll = () => {
    return {
        csrf_token: csrfToken,
        html_template_head: editorState.head.content,
        html_template_tail: editorState.tail.content
    };
};
```

**Updated click handlers:**

```javascript
// Change save button handlers from:
saveBtn.addEventListener('click', () => this.saveRole(roleId));

// To:
saveBtn.addEventListener('click', (e) => this._baseEditor.saveItem(roleId, e.target));
```

### Net Result

**Per editor:**
- Removed: ~380 lines
- Added: ~45 lines (CSS) / ~30 lines (HTML)
- Net reduction: ~335-350 lines per editor

**Total:**
- Removed: ~760 lines
- Added: ~75 lines in child editors + ~200 lines in BaseEditor
- **Net reduction: ~485 lines**

## Benefits

1. **Eliminates 300-400 lines of duplication** - largest remaining DRY violation
2. **Single source of truth** for save operations
3. **Consistent UX** - standardized button states and error handling
4. **Better keyboard UX** - Ctrl+S saves active editor (standard behavior)
5. **Simplified codebase** - removed `saveOpenTabs()` entirely
6. **Easier maintenance** - bug fixes in one place
7. **Easier testing** - test save logic once in BaseEditor

## Testing Strategy

**Smoke tests to verify:**
- Save single role/field (button click)
- Save all (button click)
- Ctrl+S saves active editor
- Ctrl+Shift+S saves all
- Format-on-save works for both methods
- Button states (spinner, disabled) work correctly
- Concurrent edit detection still works
- Error handling shows proper toasts
- Dirty state tracking accurate after save

**Manual testing:**
1. Edit CSS role, click individual Save → verify only that role saved
2. Edit multiple roles, click Save All → verify all saved
3. Edit role, press Ctrl+S → verify that role saved
4. Edit multiple roles, press Ctrl+Shift+S → verify all saved
5. No focused editor, press Ctrl+S → verify toast shown
6. Enable format-on-save → verify formatting happens
7. Edit during save operation → verify dirty state preserved
8. Verify all buttons disabled during save
9. Verify spinner shows on correct button

## Implementation Order

1. ✅ **Quick win:** Extract `injectFormatButtons()` (30 min)
2. ✅ **Active editor tracking:** Add focus tracking (1 hour)
3. ✅ **Button management:** Add `prepareSaveUI`/`restoreSaveUI` (1 hour)
4. ✅ **Save operations:** Extract `saveItem()` and `saveAll()` (2-3 hours)
5. ✅ **Child updates:** Update child editors, remove old methods (1 hour)
6. ✅ **Testing:** Smoke tests + manual verification (1 hour)

**Total estimated effort:** 4-6 hours

## Risks and Mitigations

**Risk:** Breaking existing save functionality
**Mitigation:** Comprehensive smoke tests, manual testing before merge

**Risk:** Edge cases in concurrent edit detection
**Mitigation:** Preserve exact existing logic, test carefully

**Risk:** Button state bugs (stuck disabled)
**Mitigation:** Always use try/finally for restoration, test error paths

**Risk:** Form data construction errors
**Mitigation:** Hook pattern keeps API knowledge in child editors where it belongs

## Success Criteria

- ✅ All smoke tests pass
- ✅ Manual testing confirms no regressions
- ✅ ~485 lines of code removed (net)
- ✅ Save operations work identically to before
- ✅ Ctrl+S behavior improved (saves active editor)
- ✅ No duplicate save logic in child editors
- ✅ Consistent button state management
