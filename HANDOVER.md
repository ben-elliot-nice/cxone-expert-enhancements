# CSS Editor Project - Handover Document
**Date:** October 11, 2025
**Branch:** `feature/auto-load-css`
**Status:** In progress - uncommitted changes exist

---

## 🚨 Current State

### Uncommitted Changes
There are **significant uncommitted changes** in the working directory:
- `dist/css-editor.js` - ~400 lines added (mobile responsive features)
- `dist/css-editor.css` - ~88 lines modified (mobile styling)
- `dist/index.html` - Removed active count element
- `dist/cxone-embed.html` - Removed active count element

### What Was Added (Uncommitted)
**Mobile Responsive Features:**
1. **Viewport detection** - Switches UI at 1080px breakpoint
2. **Mobile selector dropdown** - Replaces toggle buttons with dropdown on small screens
3. **Single editor constraint** - Forces only one active editor in mobile view
4. **Status icons in dropdown** - Shows ✓/● in mobile selector options
5. **Inline confirmation UI** - Replaces browser `confirm()` dialogs with styled tick/cross buttons

---

## 📚 Project Overview

### Purpose
A modern Monaco-based CSS editor that replaces the legacy CXone Expert control panel CSS editor. Allows editing role-specific CSS templates for community customization.

### Key Features
- ✅ Monaco Editor integration with CSS linting
- ✅ Multi-editor support (up to 3 simultaneous editors)
- ✅ Role-based CSS editing (all, anonymous, viewer, seated, admin, grape)
- ✅ Individual pane save/revert functionality
- ✅ Global save/discard functionality
- ✅ Dirty state tracking with visual indicators (✓ = saved, ● = dirty)
- ✅ Auto-load CSS from legacy system on page load
- ✅ Window resize handling for Monaco editors
- ✅ Popover flash messages (bottom-center, semi-transparent)
- ✅ localStorage persistence of active editors
- ✅ CSS export functionality per editor
- ⚠️ Mobile responsive UI (UNCOMMITTED)
- ⚠️ Inline confirmation dialogs (UNCOMMITTED)

---

## 🏗️ Architecture

### File Structure
```
expert-css-editor/
├── dist/
│   ├── css-editor.js       # Main application logic (~1300 lines)
│   ├── css-editor.css      # Scoped styles (#css-editor-app)
│   ├── index.html          # Standalone page
│   └── cxone-embed.html    # Embeddable version (no <html>/<body>)
├── deploy.js               # Digital Ocean Spaces deployment script
├── package.json            # Dependencies: @aws-sdk/client-s3, dotenv
├── .env                    # AWS credentials (not in git)
└── README.md               # Project documentation
```

### Technology Stack
- **Monaco Editor** v0.44.0 - VS Code's editor component
- **Monaco CSS Linter** - Stylelint integration
- **Vanilla JavaScript** - No framework dependencies
- **Digital Ocean Spaces** - CDN hosting for dist files
- **Node.js** - Deployment script only

### AMD Conflict Resolution
The legacy CXone page uses AMD (RequireJS), which conflicts with Monaco's loader. Solution:
1. Temporarily hide `window.define` and `window.require`
2. Load Monaco's loader script
3. Store Monaco's require as `window.monacoRequire`
4. Restore page's AMD immediately

**Location:** `dist/css-editor.js:1-34` (IIFE at top of file)

---

## 🔑 Key Components

### State Management
**`editorState` object** - Tracks all 6 editors:
```javascript
{
  all: { active: false, editor: null, content: '', label: 'All Roles', isDirty: false },
  anonymous: { active: false, editor: null, content: '', label: 'Anonymous', isDirty: false },
  // ... 4 more roles
}
```

**`originalContent` object** - Stores pristine CSS from API for dirty comparison

**`isMobileView` boolean** - Tracks viewport state (< 1080px = mobile)

### Core Functions

#### Initialization Flow
1. **`DOMContentLoaded`** - Entry point
2. **`checkViewportWidth()`** - Set initial mobile/desktop state
3. **`initializeMonaco(callback)`** - Load Monaco with isolated AMD
4. **`loadCSS()`** - Fetch CSS from `/deki/cp/custom_css.php?params=%2F`
5. **`parseHTML(html)`** - Extract CSRF token + 6 CSS textareas
6. **`initializeEditors(cssData)`** - Load CSS into state, restore from localStorage
7. **`updateGrid()`** - Render active editors

#### Editor Lifecycle
- **`toggleEditor(role)`** - Activate/deactivate editor (desktop)
- **`handleMobileEditorChange(newRole)`** - Switch editors (mobile)
- **`createMonacoEditor(role)`** - Create Monaco instance with linting
- **`updateGrid()`** - Rebuild DOM for active editors, dispose old instances
- **`updateToggleButtons()`** - Update button states and dropdown options

#### Save/Revert
- **`saveSinglePane(role)`** - POST single editor's CSS with multipart form
- **`saveCSS()`** - Save all editors (global)
- **`revertSinglePane(role)`** - Restore editor to `originalContent[role]`
- **`discardChanges()`** - Revert all editors (global)
- **`performRevert(role)`** - Execute revert after confirmation
- **`performDiscardChanges()`** - Execute discard after confirmation

#### Dirty State Tracking
- **`updateStatusIcon(role)`** - Update ✓/● in pane header
- **`updateMobileDropdownOption(role)`** - Update ✓/● in mobile dropdown
- Monaco's `onDidChangeModelContent` - Compares `content !== originalContent[role]`

#### Mobile Responsive
- **`checkViewportWidth()`** - Detect 1080px breakpoint changes
- **`rebuildToggleBar()`** - Swap between buttons and dropdown
- **`handleMobileEditorChange(newRole)`** - Single-editor switching

#### UI Utilities
- **`showMessage(message, type)`** - Display popover flash message (5s auto-dismiss)
- **`showInlineConfirmation(button, onConfirm)`** - Tick/cross confirm UI
- **`exportCSS(role)`** - Download CSS as .css file

### CSS Scoping
**Everything is scoped to `#css-editor-app`** to avoid conflicts with legacy page styles.

Example:
```css
#css-editor-app .toggle-btn { /* styles */ }
#css-editor-app .editor-pane { /* styles */ }
```

---

## 🔄 API Integration

### Endpoints
**GET `/deki/cp/custom_css.php?params=%2F`**
- Fetches HTML form with 6 CSS textareas + CSRF token
- Requires authentication cookies (sent via `credentials: 'include'`)

**POST `/deki/cp/custom_css.php?params=%2F`**
- Saves CSS with multipart/form-data
- Fields: `csrf_token`, `css_template_all`, `css_template_anonymous`, etc.
- Returns redirect on success (302/303)

### Authentication
Uses session cookies from legacy system. No explicit auth in this codebase.

---

## 🎨 UI Layout

### Desktop View (≥ 1080px)
```
[All Roles] [Anonymous] [Viewer] [Seated] [Admin] [Legacy]  [Save All ▼]
┌─────────────────────┬─────────────────────┬─────────────────────┐
│ ✓ All Roles         │ ● Anonymous         │ ✓ Viewer            │
│ [Save ▼] [Export]   │ [Save ▼] [Export]   │ [Save ▼] [Export]   │
│                     │                     │                     │
│   Monaco Editor     │   Monaco Editor     │   Monaco Editor     │
│                     │                     │                     │
└─────────────────────┴─────────────────────┴─────────────────────┘
                        [Flash Message Popover]
```

### Mobile View (< 1080px)
```
Editor: [✓ All Roles ▼]                                [Save All ▼]
┌───────────────────────────────────────────────────────────────┐
│ ✓ All Roles                                                    │
│ [Save ▼] [Export]                                              │
│                                                                │
│                     Monaco Editor                              │
│                                                                │
└───────────────────────────────────────────────────────────────┘
                        [Flash Message Popover]
```

---

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Load CSS successfully on page load
- [ ] Toggle editors on/off (desktop)
- [ ] Switch editors (mobile dropdown)
- [ ] Edit CSS and see dirty indicator (●)
- [ ] Save individual editor - see saved indicator (✓)
- [ ] Revert individual editor - confirm prompt appears
- [ ] Save all editors - all indicators turn to ✓
- [ ] Discard all changes - confirm prompt appears
- [ ] Export individual editor CSS
- [ ] Flash messages appear and auto-dismiss

### Responsive Behavior
- [ ] Resize window from desktop → mobile (buttons → dropdown)
- [ ] Resize window from mobile → desktop (dropdown → buttons)
- [ ] Multiple editors active → shrink to mobile (only leftmost remains)
- [ ] Monaco editors resize correctly on window resize

### Edge Cases
- [ ] Try activating 4th editor (should show error)
- [ ] Reload page - active editors restored from localStorage
- [ ] Save with no changes - shows "no unsaved changes" message
- [ ] Revert with no changes - no confirmation prompt
- [ ] Click outside inline confirmation - resets button

---

## 🚀 Deployment

### Manual Deployment
```bash
npm run deploy
```

This uploads to Digital Ocean Spaces:
- `dist/css-editor.css` → `media/misc/expert-css/css-editor.css`
- `dist/css-editor.js` → `media/misc/expert-css/css-editor.js`

**CDN URLs:**
- `https://releases.benelliot-nice.com/cxone-expert-enhancements/latest/css-editor.css`
- `https://releases.benelliot-nice.com/cxone-expert-enhancements/latest/css-editor.js`

**Cache Control:** `no-cache, no-store, must-revalidate`

### Embedding in CXone
Use `cxone-embed.html` content in legacy control panel page.

---

## 📝 Git History (Recent Commits)

```
c90dfef Add popover-style flash messages at bottom of editor
c912291 Add individual pane revert with split-button dropdown
fb3e25b Add individual pane save with real-time dirty state tracking
2b6d419 Add responsive window resize support for Monaco editors
918f6eb Refactor UI: sleek tab-style design with split-button controls
```

---

## 🔧 Known Issues / TODOs

### Current TODOs (from todo list)
1. ✅ Replace browser confirm dialogs with inline confirm UI (DONE - uncommitted)
2. ⏳ Add localStorage persistence for unsaved CSS changes (PENDING)

### Potential Improvements
- Add keyboard shortcuts (Ctrl+S to save, etc.)
- Add diff view to compare current vs original
- Add undo/redo functionality
- Add search/replace across all editors
- Add CSS validation warnings in UI
- Add dark/light theme toggle
- Add full-screen mode for editors
- Improve mobile UX (tabs instead of dropdown?)

---

## 🤔 Decision Log

### Why Monaco over CodeMirror?
Monaco provides better out-of-box CSS support and VS Code familiarity.

### Why `automaticLayout: false`?
Automatic layout causes performance issues with multiple editors. Manual `layout()` calls on resize work better.

### Why localStorage for active editors?
User convenience - restores their workspace on page reload without server-side persistence.

### Why split-button design?
Provides quick access to save with advanced options (revert) in dropdown - common UI pattern.

### Why 1080px breakpoint?
Monaco editors need ~350px width minimum for usability. 1080px allows 3 editors comfortably.

### Why inline confirmation?
Less disruptive than browser `confirm()` dialogs. Keeps user in flow.

---

## 🐛 Debugging Tips

### Monaco Not Loading
Check console for AMD conflicts. Look for `[CSS Editor]` prefixed logs.

### Editors Not Appearing
1. Check `monacoReady` flag in console
2. Verify `editorState[role].active === true`
3. Check `updateGrid()` was called
4. Inspect DOM for `#editor-${role}` containers

### Save Failing
1. Check `csrfToken` is present in console logs
2. Verify fetch credentials: 'include'
3. Check network tab for 302/303 redirects (success)
4. Verify `buildMultipartBody()` output

### Dirty State Not Updating
1. Check `originalContent[role]` exists
2. Verify `onDidChangeModelContent` listener attached
3. Check `updateStatusIcon(role)` is called

### Mobile View Not Switching
1. Check `checkViewportWidth()` is called on resize
2. Verify `rebuildToggleBar()` executes
3. Look for `.mobile-selector-wrapper` in DOM

---

## 🔗 External Resources

- **Monaco Editor Docs:** https://microsoft.github.io/monaco-editor/
- **Monaco CSS Linter:** https://github.com/remcohaszing/monaco-stylelint
- **Digital Ocean Spaces:** https://docs.digitalocean.com/products/spaces/

---

## 📞 Next Steps for New Developer

### Immediate Actions
1. **Review uncommitted changes** - Decide if mobile responsive features should be committed
2. **Test mobile responsive thoroughly** - Especially the viewport switching logic
3. **Commit or revert** - Don't leave working directory dirty

### Priority Features (If Desired)
1. **localStorage for unsaved changes** - Persist dirty content across reloads
2. **Keyboard shortcuts** - Ctrl+S, Ctrl+Z, etc.
3. **Better mobile UX** - Consider tabs instead of dropdown
4. **Diff view** - Visual comparison of changes

### Code Quality
- Add JSDoc comments to key functions
- Extract magic numbers to constants (1080px breakpoint, etc.)
- Split `css-editor.js` into modules (too large at 1300+ lines)
- Add unit tests for state management
- Add E2E tests with Playwright/Cypress

---

## 🎯 Summary for Quick Context

**What it does:** Modern CSS editor for CXone Expert control panel with Monaco editor

**Current state:** Feature-complete but uncommitted mobile responsive work in progress

**Key files:** `dist/css-editor.js` (logic), `dist/css-editor.css` (styles), `deploy.js` (deployment)

**To deploy:** `npm run deploy` (requires .env with AWS credentials)

**To test:** Open `dist/index.html` locally or embed `dist/cxone-embed.html` in CXone

**Biggest gotcha:** AMD conflicts with Monaco - handled by IIFE at top of JS file

**Most complex feature:** Mobile responsive viewport switching with single-editor constraint

---

**End of Handover Document**
