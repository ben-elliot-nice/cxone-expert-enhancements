# Testing Methodology Handover

## Context

You are working on `feature/testing-methodology` branch to establish a comprehensive testing strategy for the CXone Expert Enhancements project. This project is a browser extension/overlay that provides CSS and HTML editing capabilities with Monaco editors.

## Recent Work: DRY Refactoring & Live Testing

The codebase recently underwent a major DRY refactoring (PR on `refactor/dry-principles-apps` branch) that extracted ~800 lines of duplicated code from CSS Editor and HTML Editor into a shared BaseEditor class. During this refactoring:

### Live Testing Approach Used

We performed live testing on https://help.benelliot-nice.com/ using the **Chrome DevTools MCP server** (`mcp__chrome-devtools-remote__*` tools):

1. **Navigation & Setup**
   - Navigate to test URL
   - Take snapshots to identify UI elements
   - Click buttons using UIDs from snapshots
   - Use `evaluate_script` to execute JavaScript in the page context

2. **Testing Flow**
   - Open overlay → Switch apps → Verify UI loaded
   - Make edits to Monaco editors
   - Click save buttons
   - Monitor console logs (`list_console_messages`)
   - Check network requests (`list_network_requests`, `get_network_request`)
   - Verify POST payloads contain edits

3. **Bug Discovery Through Live Testing**
   - HTML Editor saves were failing silently (no POST request)
   - Console logs showed save initiated but no network activity
   - Root cause: `formatItemIfNeeded()` calls `editor.setValue()` which triggers `onDidChangeModelContent` listener, recalculating `isDirty`
   - If formatted content matched original, `isDirty` became false → save aborted early
   - **Fix**: Capture dirty state BEFORE formatting (commits `f870f9f`)

### Smoke Tests Created

Created `tests/smoke-test.js` (now in local files, not tracked in git) to verify:
- Application loads without errors
- CSS Editor loads with 6 roles
- HTML Editor loads with 2 fields
- Monaco editor initialization
- State management works
- UI components render
- Code formatter loads

**Key Limitation**: Smoke tests did NOT cover save operations, which is why the bug wasn't caught until live testing.

## Current Testing Gaps

1. **No automated save operation tests**
   - Save button clicks
   - Network request verification
   - POST payload validation
   - Success/failure handling
   - Concurrent edit detection

2. **No integration tests for BaseEditor hooks**
   - `buildFormDataForSave`
   - `buildFormDataForSaveAll`
   - `onSaveItem`, `onSaveAll`
   - `onFormatItem`

3. **No keyboard shortcut tests**
   - Cmd+S / Ctrl+S (save active)
   - Cmd+Shift+S / Ctrl+Shift+S (save all)
   - Cmd+Shift+F / Ctrl+Shift+F (format)

4. **No cross-browser testing strategy**
   - Mac vs Windows keyboard shortcuts
   - Different Chrome versions
   - Platform-specific behaviors

5. **No regression test suite**
   - Tests that would have caught the dirty state bug
   - Tests for format-on-save edge cases
   - Tests for state persistence

## Key Testing Insights Learned

### 1. Live Testing vs Unit Tests
- **Live testing** (Chrome DevTools MCP) caught a critical bug that smoke tests missed
- Real browser environment reveals integration issues
- Network layer testing is essential for save operations
- Console logs provide valuable debugging information

### 2. Testing Save Operations Requires
- Monaco editor interaction (typing, setValue)
- State tracking (isDirty, content changes)
- Formatter integration (format-on-save behavior)
- Network request interception
- Response handling verification

### 3. BaseEditor Testing Challenges
- BaseEditor is abstract and delegates to child classes via hooks
- Must test both CSS Editor and HTML Editor implementations
- Hook implementations vary (6 roles vs 2 fields)
- Some bugs only manifest in specific hook implementations

### 4. Multi-Layer Testing Needed
```
┌─────────────────────────────────────┐
│  E2E Tests (Chrome DevTools MCP)    │ ← Caught the dirty state bug
├─────────────────────────────────────┤
│  Integration Tests (jsdom/happy-dom)│ ← Missing: hook interactions
├─────────────────────────────────────┤
│  Unit Tests (Vitest)                │ ← Missing: BaseEditor methods
├─────────────────────────────────────┤
│  Smoke Tests (basic functionality)  │ ← Exists but incomplete
└─────────────────────────────────────┘
```

## Current Codebase Architecture

### BaseEditor (`src/base-editor.js`)
Shared functionality extracted from editors:
- Monaco editor lifecycle
- State management (editorState, originalContent)
- Save operations (`saveItem`, `saveAll`)
- Format operations (`formatItemIfNeeded`)
- UI management (toggle buttons, dropdowns)
- Keyboard shortcuts
- Active editor tracking

**Critical Methods to Test:**
- `saveItem(itemId, triggerButton)` - Lines 1551-1616
- `saveAll(triggerButton)` - Lines 1625-1716
- `prepareSaveUI(triggerButton)` - Lines 1494-1536
- `formatItemIfNeeded(itemId, item, editor)` - Lines 1496-1527
- `setupKeyboardShortcuts()` - Lines 1151-1186

### CSS Editor (`src/css-editor.js`)
Implements BaseEditor hooks:
- `buildFormDataForSave` - Builds form data for single role save
- `buildFormDataForSaveAll` - Builds form data for all 6 roles
- `onFormatItem` - Delegates to `formatRole(roleId)`

### HTML Editor (`src/html-editor.js`)
Implements BaseEditor hooks:
- `buildFormDataForSave` - Builds form data for single field save
- `buildFormDataForSaveAll` - Builds form data for both fields (head, tail)
- `onFormatItem` - Delegates to `formatField(fieldId)`

## Your Task: Establish Testing Methodology

### Primary Objectives

1. **Document Testing Strategy**
   - Define testing layers (unit, integration, E2E)
   - Specify when to use each testing approach
   - Document Chrome DevTools MCP testing workflow
   - Create testing guidelines for future features

2. **Create Testing Infrastructure**
   - Set up test framework (Vitest recommended)
   - Configure test environment (jsdom or happy-dom)
   - Create test utilities for BaseEditor testing
   - Set up network mocking for save operation tests

3. **Write Critical Tests**
   - Save operation tests (prevent regression of dirty state bug)
   - Keyboard shortcut tests (verify Cmd vs Ctrl, with/without Shift)
   - Hook integration tests (BaseEditor ↔ CSS/HTML Editor)
   - State management tests (isDirty, content tracking)

4. **Document Live Testing Workflow**
   - How to use Chrome DevTools MCP for manual testing
   - Common testing patterns (snapshots, clicks, script evaluation)
   - Debugging techniques (console logs, network inspection)
   - When to use live testing vs automated tests

### Secondary Objectives

1. **Test Coverage Strategy**
   - Define minimum coverage requirements
   - Identify critical paths requiring 100% coverage
   - Document untestable/hard-to-test areas

2. **CI/CD Integration**
   - Propose automated test execution strategy
   - Define passing criteria for PRs
   - Consider performance testing (load times, memory usage)

3. **Testing Best Practices**
   - Test naming conventions
   - Test organization (file structure)
   - Mock vs real dependencies
   - Testing private methods via public interfaces

## Files and Directories

### Current State
```
tests/                          # Local only (gitignored)
├── smoke-test.js              # Basic functionality tests
├── advanced-smoke-test.js     # More comprehensive checks
└── README.md                  # Test documentation

src/
├── base-editor.js             # 1787 lines - needs unit tests
├── css-editor.js              # Reduced from 2100 to 653 lines
└── html-editor.js             # Reduced from 1841 to 550 lines

docs/
├── ARCHITECTURE.md            # System architecture
├── BUILD_SYSTEM_PROGRESS.md   # Build tooling history
└── IMPLEMENTATION_SUMMARY.md  # Feature implementation notes
```

### Recommended Structure
```
tests/
├── unit/
│   ├── base-editor.test.js    # BaseEditor unit tests
│   ├── css-editor.test.js     # CSS Editor-specific tests
│   └── html-editor.test.js    # HTML Editor-specific tests
├── integration/
│   ├── save-operations.test.js
│   ├── keyboard-shortcuts.test.js
│   └── formatter.test.js
├── e2e/
│   ├── live-testing-guide.md  # Chrome DevTools MCP workflow
│   └── regression.test.js     # Critical regression tests
└── utils/
    ├── test-helpers.js
    ├── mocks.js
    └── fixtures.js
```

## Known Issues to Test Against

1. **Dirty State Bug** (Fixed in `f870f9f`)
   - Test: Edit content → format → verify save proceeds
   - Test: Content matches original after format → verify no save

2. **Keyboard Shortcut Bug** (Fixed in `7f42cb9`)
   - Test: Cmd+Shift+S works on Mac
   - Test: Ctrl+Shift+S works on Windows
   - Verify using `e.code` instead of `e.key`

3. **Format-on-Save Edge Cases**
   - Already formatted content
   - Invalid syntax (format fails)
   - Empty content
   - Very large content

## Testing Tools Available

### Chrome DevTools MCP Server
Tools for live browser testing:
- `mcp__chrome-devtools-remote__take_snapshot` - Get page accessibility tree
- `mcp__chrome-devtools-remote__click` - Click UI elements by UID
- `mcp__chrome-devtools-remote__evaluate_script` - Run JavaScript in page
- `mcp__chrome-devtools-remote__list_console_messages` - Get console logs
- `mcp__chrome-devtools-remote__list_network_requests` - Get network activity
- `mcp__chrome-devtools-remote__get_network_request` - Get request details

### Build Tools
- **Vite**: Build system (already configured)
- **npm scripts**: `npm run build`, `npm run dev`

### Recommended Test Frameworks
- **Vitest**: Fast, Vite-native test runner
- **jsdom** or **happy-dom**: DOM simulation
- **@testing-library**: DOM testing utilities
- **nock** or **msw**: HTTP mocking

## Key Questions to Answer

1. **Test Framework Selection**
   - Vitest vs Jest vs others?
   - Why? (Consider Vite integration, speed, features)

2. **DOM Environment**
   - jsdom vs happy-dom vs real browser?
   - Monaco editor compatibility?

3. **Mock Strategy**
   - Mock Monaco entirely or use real instance?
   - Mock network requests or use fixtures?
   - Mock Prettier formatter or use real?

4. **Coverage Goals**
   - What's a reasonable coverage target?
   - Which files need 100% coverage?
   - How to handle hard-to-test code?

5. **Live Testing Integration**
   - When should developers use Chrome DevTools MCP?
   - Should live tests be automated or manual?
   - How to document live test scenarios?

6. **Test Execution**
   - Run tests on every commit?
   - Run E2E tests only on PR?
   - Performance benchmarks?

## Success Criteria

Your testing methodology should:

1. ✅ **Prevent regression of known bugs**
   - Dirty state capture bug would be caught
   - Keyboard shortcut issues would be caught

2. ✅ **Provide fast feedback**
   - Unit tests run in < 5 seconds
   - Integration tests run in < 30 seconds

3. ✅ **Be maintainable**
   - Clear test organization
   - Easy to add new tests
   - Minimal test brittleness

4. ✅ **Cover critical paths**
   - Save operations (CSS + HTML)
   - Keyboard shortcuts
   - State management
   - Format-on-save

5. ✅ **Document clearly**
   - How to run tests
   - How to write tests
   - When to use live testing vs automated

## Next Steps

1. **Research & Proposal** (30-60 min)
   - Research test frameworks compatible with Vite + Monaco
   - Propose testing stack with rationale
   - Draft test file structure

2. **Infrastructure Setup** (1-2 hours)
   - Install and configure test framework
   - Create test utilities and helpers
   - Set up mocks for Monaco, network, etc.

3. **Write Critical Tests** (2-3 hours)
   - Save operation tests (prevent dirty state regression)
   - Keyboard shortcut tests (prevent e.key regression)
   - Basic integration tests

4. **Documentation** (1 hour)
   - Testing guide for developers
   - Live testing workflow with Chrome DevTools MCP
   - Contributing guidelines (how to write tests)

5. **Commit & PR** (30 min)
   - Commit testing infrastructure
   - Create PR with testing documentation
   - Include examples of new tests

## Important Constraints

- **Do not break existing functionality** - All builds must still work
- **Keep it simple** - Avoid over-engineering, start minimal
- **Document decisions** - Explain why you chose specific tools/approaches
- **Focus on value** - Prioritize tests that prevent real bugs
- **Consider CI/CD** - Tests should be automatable

## Reference: The Bug We Caught

This is the exact bug live testing revealed (for reference when writing tests):

**Before Fix:**
```javascript
// Sync editor value
item.content = editor.getValue();

// Format on save
await this.formatItemIfNeeded(itemId, item, editor);
// ^ This calls editor.setValue() which triggers onDidChangeModelContent
// ^ Which recalculates: item.isDirty = content !== originalContent
// ^ If formatted content matches original, isDirty becomes false

// Check for changes
if (!item.isDirty && item.content === this.originalContent[itemId]) {
    showToast('No changes to save', 'warning');
    return; // ← Save aborted!
}
```

**After Fix:**
```javascript
// Sync editor value
item.content = editor.getValue();

// Capture dirty state BEFORE formatting
const hadChanges = item.isDirty || item.content !== this.originalContent[itemId];

// Format on save
await this.formatItemIfNeeded(itemId, item, editor);

// Check using captured state
if (!hadChanges) {
    showToast('No changes to save', 'warning');
    return;
}
```

**Test Case Needed:**
```javascript
test('save proceeds when content was edited then formatted to match original', async () => {
    // 1. Load original content: "<!-- Release -->"
    // 2. Edit to: "<!--Release-->" (isDirty = true)
    // 3. Format to: "<!-- Release -->" (matches original)
    // 4. Save should SUCCEED (because hadChanges was captured as true)
    // 5. Verify POST request was sent
});
```

## Git Information

- **Current Branch**: `feature/testing-methodology`
- **Base Branch**: `develop` (includes all DRY refactoring)
- **Recent Commits**:
  - `1df083d` - Remove tests/ and scripts/ from git tracking
  - `7f42cb9` - Fix keyboard shortcuts (e.code vs e.key)
  - `f870f9f` - Fix dirty state capture bug
  - `31607ea` - Extract save operations to BaseEditor (main DRY refactor)

---

**Ready to begin!** Start by researching testing frameworks and proposing your approach.
