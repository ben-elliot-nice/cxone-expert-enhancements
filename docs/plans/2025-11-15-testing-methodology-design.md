# Testing Methodology Design

**Date:** 2025-11-15
**Status:** Approved
**Author:** Design session with user

## Overview

This document outlines a comprehensive testing strategy for the CXone Expert Enhancements project. The methodology supports Test-Driven Development (TDD) locally while enforcing quality gates on PRs through automated testing against deployed artifacts.

## Goals & Priorities

### Primary Goals
- **Catch breaking changes before production** - Prevent regressions in existing functionality
- **Verify CXone Expert integration** - Ensure the toolkit works correctly when embedded in the platform
- **Support TDD workflow** - Fast local testing for rapid development cycles
- **Gate PR merges on quality** - Automated testing prevents broken code from merging

### Secondary Goals
- Cross-browser compatibility verification (Chrome, Firefox, Safari)
- Comprehensive UI testing of all features
- Error scenario and edge case coverage
- Security testing (CSRF, XSS prevention)
- Performance benchmarking

## Testing Architecture

### Three-Layer Strategy

The testing infrastructure consists of three distinct layers, each optimized for different purposes:

#### Layer 1: Unit Tests (Fast & Focused)
- **Tool:** Vitest (integrates seamlessly with Vite, extremely fast)
- **Scope:** Individual functions and modules in isolation
- **Mocking:** Monaco, DOM, localStorage, fetch
- **Location:** `tests/unit/` directory
- **Run time:** Seconds (sub-second with watch mode)
- **Coverage targets:** Business logic, utilities, state management

#### Layer 2: Integration Tests (Monaco + Core Systems)
- **Tool:** Vitest or Playwright Component Testing
- **Scope:** Monaco wrapper, editor initialization, event handling
- **Monaco:** Bundled locally (download once, use offline)
- **Location:** `tests/integration/` directory
- **Run time:** ~10-30 seconds
- **Coverage targets:** Core.Monaco, BaseEditor Monaco interactions, editor lifecycle

#### Layer 3: E2E Tests (Full User Journeys)
- **Tool:** Playwright
- **Scope:** Complete workflows as users experience them
- **Monaco:** Real CDN (production-like)
- **API:** Mocked with real payloads (switchable to real site)
- **Location:** `tests/e2e/` directory
- **Run time:** 1-3 minutes locally, parallel in CI
- **Coverage targets:** User journeys, cross-browser compatibility, integration with host page

## Test Organization & File Structure

### Unit Tests (`tests/unit/`)

```
tests/unit/
├── core/
│   ├── storage.test.js          # localStorage wrapper, namespacing
│   ├── ui.test.js               # Toast, messages, alerts
│   ├── dom.test.js              # DOM utilities
│   ├── api.test.js              # HTTP requests, form handling, CSRF
│   └── config.test.js           # Configuration management
├── editors/
│   ├── base-editor.test.js      # State management, import/export logic
│   ├── css-editor.test.js       # CSS-specific logic, role switching
│   └── html-editor.test.js      # HTML field switching
└── helpers/
    └── test-utils.js            # Shared mocks, fixtures, utilities
```

**Focus Areas:**
- Business logic isolated from DOM/Monaco
- State management algorithms
- Data transformation and validation
- Configuration parsing and merging
- Storage operations (mocked localStorage)
- API request construction (mocked fetch)

### Integration Tests (`tests/integration/`)

```
tests/integration/
├── monaco-wrapper.test.js       # Core.Monaco initialization, caching
├── editor-lifecycle.test.js     # BaseEditor + Monaco integration
└── formatting.test.js           # Prettier integration with Monaco
```

**Focus Areas:**
- Monaco editor initialization and configuration
- Event handler attachment (onChange, onBlur, etc.)
- getValue/setValue operations
- Monaco API calls (formatting, syntax highlighting)
- Editor caching and reuse logic
- Monaco loading and error scenarios

### E2E Tests (`tests/e2e/`)

```
tests/e2e/
├── fixtures/
│   ├── api-responses/
│   │   ├── css/
│   │   │   ├── load-all-roles.json
│   │   │   ├── save-success.json
│   │   │   └── save-error.json
│   │   ├── html/
│   │   │   ├── load-body-footer.json
│   │   │   └── save-success.json
│   │   └── csrf/
│   │       └── token-response.json
│   ├── api-error-responses.json
│   └── test-page.html           # Host page for testing
│
├── helpers/
│   ├── mock-server.js           # API mocking utilities
│   └── page-objects.js          # Reusable page interactions
│
├── journeys/
│   ├── css-editor-workflow.spec.js
│   ├── html-editor-workflow.spec.js
│   ├── cross-tab-workflow.spec.js
│   └── keyboard-shortcuts.spec.js
│
├── ui-components/
│   ├── overlay-drag-resize.spec.js
│   ├── app-switcher.spec.js
│   └── mobile-responsive.spec.js
│
├── error-handling/
│   ├── monaco-load-failure.spec.js
│   ├── network-failures.spec.js
│   ├── storage-corruption.spec.js
│   └── csrf-token-issues.spec.js
│
├── security/
│   ├── csrf-protection.spec.js
│   └── input-sanitization.spec.js
│
├── performance/
│   ├── load-time.spec.js
│   └── bundle-size.spec.js
│
└── playwright.config.js
```

## Comprehensive E2E Test Scenarios

### State Management & Data Persistence
- Unsaved changes warnings when switching tabs/apps
- Close overlay with dirty state → warn user
- Refresh page with unsaved changes → localStorage preserves
- Switch apps with unsaved changes → warn/preserve
- localStorage vs server data conflicts → resolution
- Multiple browser tabs/windows → state synchronization
- Browser crash recovery → restore from localStorage
- Clear localStorage while app open → graceful handling

### Live CSS Preview
- CSS applies in real-time while typing
- Invalid CSS doesn't break page
- CSS that hides toolkit UI → recovery mechanism
- Preview updates when switching role tabs
- Preview disabled in HTML editor
- Malformed CSS → graceful error handling

### Import/Export Workflows
- Import .css/.html files → populate editor correctly
- Import wrong file extension → validation error
- Import huge files (>1MB) → handle gracefully
- Export from dirty editor → captures current state
- Export from all 6 CSS roles → correct filenames
- Re-import exported file → round-trip integrity
- Import overwrites dirty content → warning shown

### Code Formatting (Prettier)
- Format on save (automatic)
- Manual format (Ctrl+Shift+F) → formats current tab
- Format All → formats all tabs
- Invalid code Prettier can't parse → error handling
- Format during typing → doesn't interrupt user
- Format preserves cursor position

### Message/Toast System
- Success toasts on save → appear and auto-dismiss
- Error toasts on failure → persist until dismissed
- Multiple toasts stack correctly
- In-app message banner vs toast notification
- Messages don't block UI interaction

### Multi-App Interactions
- Switch CSS → HTML → Settings → back to CSS
- State preserved when switching away and back
- Dirty state tracked independently per app
- App switcher shows all available apps
- Settings changes apply to editors immediately

### Keyboard Shortcuts
- Ctrl+S / Cmd+S → Save All
- Ctrl+Shift+S / Cmd+Shift+S → Save Open Tab
- Ctrl+Shift+F / Cmd+Shift+F → Format All
- Shortcuts work with Monaco focused
- Shortcuts work with overlay focused
- Mac (Cmd) vs Windows/Linux (Ctrl) detection
- Shortcuts don't conflict with host page

### Initialization & Loading
- Script loads before DOM ready → waits correctly
- Script loads after DOM ready → initializes immediately
- Script injected multiple times → idempotent
- Host page conflicting CSS → toolkit CSS wins
- Host page conflicting JavaScript → no conflicts
- Slow network → loading indicators shown

### Visual States & Accessibility
- All tabs show dirty indicator (*) when modified
- Dirty indicator clears after save
- Disabled states (save button while saving)
- Loading spinners during async operations
- Focus states visible for keyboard navigation
- Logical tab order for keyboard users

### Edge Cases & Stress Testing
- Very long CSS/HTML (10,000+ lines) → performance
- Rapid typing → no lag, proper debouncing
- Rapid tab switching → no race conditions
- Simultaneous save requests → queued or prevented
- Empty editors → save succeeds with empty data
- Special characters (Unicode, emoji) → preserved correctly
- Copy/paste large content → handles gracefully

### Session & Authentication
- CSRF token expires during session → auto-refresh
- Session timeout → graceful error, prompts re-login
- Work on multiple CXone sites → isolated state per site

### Browser-Specific Testing
- Test on Chromium, Firefox, WebKit (Safari)
- Browser-specific CSS rendering differences
- Browser-specific Monaco quirks
- Different screen sizes and resolutions

## API Mocking Strategy

### Real Payload Capture

Capture actual API responses from CXone Expert and store as fixtures:

**Fixture organization:**
```
tests/e2e/fixtures/api-responses/
├── css/
│   ├── load-all-roles.json          # GET response for CSS data
│   ├── save-all-roles-success.json  # POST success response
│   └── save-all-roles-error.json    # POST error response
├── html/
│   ├── load-body-footer.json
│   └── save-success.json
├── csrf/
│   └── token-response.json
└── metadata.json                     # Endpoint URLs, request formats
```

### Mock Server Implementation

Playwright's route interception handles API mocking:

```javascript
// tests/e2e/helpers/mock-server.js
export class CXoneAPIMock {
  constructor(page) {
    this.page = page;
    this.mode = 'mock'; // or 'real' for live site testing
  }

  async enableMocking() {
    if (this.mode !== 'mock') return;

    // Intercept CSS save requests
    await this.page.route('**/api/css/save', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify(fixtures.css.saveSuccess)
      });
    });

    // Intercept CSS load requests
    await this.page.route('**/api/css/load', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify(fixtures.css.loadAllRoles)
      });
    });
  }

  async injectError(endpoint, errorType) {
    // Can inject timeouts, 500s, malformed responses on demand
  }
}
```

### Switchable Testing Modes

**Mock Mode (Default):**
```bash
npm run test:e2e              # Uses mocked API
```
- Intercepts all CXone API calls
- Returns fixture data
- No actual server changes
- Fast, reliable, safe for development

**Real Site Mode (Optional):**
```bash
TEST_MODE=real npm run test:e2e    # Uses real CXone site
```
- No route interception
- Hits actual API endpoints
- Verifies real integration
- **Use on staging/test CXone site only**

### Test Example

```javascript
// tests/e2e/journeys/css-editor-workflow.spec.js
test('Edit CSS, save, verify persistence', async ({ page }) => {
  const mockAPI = new CXoneAPIMock(page);
  await mockAPI.enableMocking();

  await page.goto('http://localhost:5173');

  // Open CSS editor
  await page.click('[data-testid="toggle-button"]');
  await page.selectOption('[data-testid="app-switcher"]', 'css-editor');

  // Edit "All Roles" CSS
  await page.click('[data-testid="tab-all-roles"]');
  await editor.type('body { background: red; }');

  // Verify dirty state indicator
  await expect(page.locator('[data-testid="tab-all-roles"]'))
    .toContainText('*');

  // Save
  await page.keyboard.press('Control+S');

  // Verify save request made (mock) or succeeded (real)
  if (mockAPI.mode === 'mock') {
    expect(mockAPI.capturedRequests).toContainEqual({
      endpoint: '/api/css/save',
      payload: expect.objectContaining({
        role: 'all',
        css: 'body { background: red; }'
      })
    });
  }

  // Verify dirty indicator cleared
  await expect(page.locator('[data-testid="tab-all-roles"]'))
    .not.toContainText('*');
});
```

## CI/CD Integration & Workflow

### Local Development (TDD Workflow)

Developers work with fast feedback loops:

```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Unit tests in watch mode
npm run test:unit:watch         # Vitest watch, instant feedback

# Terminal 3: Run E2E when needed
npm run test:e2e                # Full Playwright suite
npm run test:e2e -- css-editor  # Single test file
npm run test:e2e:ui             # Playwright UI mode (interactive)
```

**Key principles:**
- No pre-commit hooks → developers commit freely
- Tests available on-demand for TDD
- Fast unit tests (<1s) encourage frequent running
- E2E tests available for testing full flows

### GitHub Actions Workflow

New workflow: `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [develop, main, 'feature/**', 'bugfix/**', 'hotfix/**']
  pull_request:
    branches: [develop, main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build

      # Deploy to S3 (reuse existing deploy logic)
      - name: Deploy test build
        run: npm run deploy
        env:
          DO_SPACES_KEY: ${{ secrets.DO_SPACES_KEY }}
          DO_SPACES_SECRET: ${{ secrets.DO_SPACES_SECRET }}

      # Run E2E tests against deployed build
      - name: Install Playwright
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Run E2E tests
        run: npm run test:e2e -- --project=${{ matrix.browser }}
        env:
          BASE_URL: https://releases.benelliot-nice.com/cxone-expert-enhancements/${{ github.ref_name }}/

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results-${{ matrix.browser }}
          path: test-results/
```

### PR Merge Gates

**Branch protection rules for `develop`:**
- ✅ Unit tests must pass
- ✅ Integration tests must pass
- ✅ E2E tests must pass (all 3 browsers)
- ✅ No merge until all checks green

**Branch protection rules for `main`:**
- Same as develop, plus version bump check (existing)

### Workflow Diagram

```
Developer commits → Push to feature branch
                    ├─→ Unit tests run (30s)
                    ├─→ Integration tests run (1min)
                    └─→ Build & deploy to S3
                        └─→ E2E tests run in container (3min)
                            ├─→ Chromium tests
                            ├─→ Firefox tests
                            └─→ WebKit tests
                                └─→ All pass → PR can merge ✅
                                └─→ Any fail → PR blocked ❌
```

### Test Reporting

- Test results posted as PR comment
- Failed tests show screenshots/videos
- Coverage report shows what's tested
- Performance metrics tracked over time

## Implementation Rollout

### Phase 1: Foundation Setup (Week 1)

**Tasks:**
1. Install testing dependencies (Vitest, Playwright, coverage tools)
2. Set up test directories and basic configuration
3. Create test utilities and shared mocks
4. Write first 5-10 unit tests for critical utilities (Storage, DOM helpers)
5. Get unit tests running in CI

**Deliverables:**
- `vitest.config.js` configured
- `tests/unit/` directory structure created
- First unit tests passing
- GitHub Actions running unit tests

### Phase 2: Unit Test Coverage (Week 2)

**Tasks:**
- Complete unit tests for all core modules
- Target: 80%+ coverage on business logic
- Focus on: state management, config, API wrapper, import/export
- Integrate coverage reporting in PRs

**Deliverables:**
- Full unit test suite for `src/core.js`
- Unit tests for `src/base-editor.js` (business logic)
- Unit tests for `src/css-editor.js` and `src/html-editor.js`
- Coverage reports in GitHub Actions

### Phase 3: Integration Tests (Week 3)

**Tasks:**
- Download and bundle Monaco locally
- Write Monaco wrapper integration tests
- Test BaseEditor + Monaco interactions
- Test formatting pipeline

**Deliverables:**
- `tests/integration/` suite complete
- Monaco bundled for offline testing
- Integration tests in CI pipeline

### Phase 4: API Payload Capture (Week 3-4)

**Tasks:**
- Open CXone Expert in browser DevTools
- Capture real API requests/responses for:
  - CSS load/save operations (all 6 roles)
  - HTML load/save operations
  - CSRF token requests
  - Error responses (simulate failures)
- Document API endpoints and payload structures
- Create fixture files

**Deliverables:**
- `tests/e2e/fixtures/api-responses/` populated
- API documentation in fixtures metadata
- Real payload examples for all endpoints

### Phase 5: E2E Test Suite (Week 4-5)

**Tasks:**
- Set up Playwright configuration
- Create mock server with real payloads
- Write page objects for reusable interactions
- Implement core user journey tests
- Add UI component tests (drag/resize, app switching)
- Add error handling tests

**Deliverables:**
- `playwright.config.js` configured for 3 browsers
- Mock server with real payload support
- Full E2E test suite covering all scenarios
- Page objects for maintainability

### Phase 6: CI/CD Integration (Week 5)

**Tasks:**
- Create GitHub Actions workflow
- Configure matrix testing (3 browsers)
- Set up PR deployment + E2E testing
- Configure branch protection rules
- Test full pipeline end-to-end

**Deliverables:**
- `.github/workflows/test.yml` complete
- E2E tests running against deployed builds
- PR merge gates enforced
- Test reporting on PRs

### Phase 7: Comprehensive Coverage (Ongoing)

**Tasks:**
- Add remaining edge cases and scenarios
- Security testing (CSRF, XSS)
- Performance benchmarks
- Mobile responsive testing
- Cross-browser quirk testing

**Deliverables:**
- 100% feature coverage
- Security test suite
- Performance regression detection
- Mobile test scenarios

### Phase 8: Repository Cleanup & Test Migration Finalization (Week 6)

**Tasks:**

1. **Update `.gitignore`**
   - Remove `tests/` from gitignore
   - Remove `src/` from gitignore if present
   - Ensure only test artifacts ignored:
     ```gitignore
     # Test artifacts (keep these ignored)
     test-results/
     playwright-report/
     coverage/
     .nyc_output/
     ```

2. **Migrate Knowledge from Old Tests**
   - Review `smoke-test.js` - extract scenarios not in new suite
   - Review `advanced-smoke-test.js` - same extraction
   - Document timing/flakiness workarounds
   - Capture useful helper methods

3. **Remove Legacy Test Files**
   - Delete `tests/smoke-test.js`
   - Delete `tests/advanced-smoke-test.js`
   - Delete old test README if manual-testing focused
   - Remove orphaned test-related files

4. **Create New Test Documentation**
   - Write `tests/README.md` with:
     - How to run tests locally
     - How to write new tests
     - Test organization explanation
     - Troubleshooting guide
   - Update root `README.md` with testing section

5. **Commit Test Infrastructure**
   ```bash
   git add tests/
   git add .github/workflows/test.yml
   git add vitest.config.js
   git add playwright.config.js
   git add .gitignore
   git commit -m "feat: Add comprehensive test infrastructure"
   ```

6. **Verify CI/CD**
   - Push to feature branch
   - Confirm all tests run in GitHub Actions
   - Confirm PR gates work correctly
   - Merge to develop

**Deliverables:**
- ✅ All new tests committed and tracked
- ✅ Old manual tests removed (knowledge preserved)
- ✅ `.gitignore` cleaned up and documented
- ✅ Test documentation complete
- ✅ CI/CD running successfully
- ✅ Team can run tests locally without issues

## Success Metrics

### Coverage Targets
- **Unit tests:** 80%+ line coverage on business logic
- **Integration tests:** 100% of Monaco wrapper code
- **E2E tests:** 100% of user-facing features and journeys

### Quality Targets
- All tests pass on all 3 browsers before merge
- No flaky tests (tests must be deterministic)
- Test suite completes in <5 minutes in CI
- Zero production bugs not caught by tests (aspirational)

### Developer Experience
- Unit tests run in <5 seconds locally
- E2E tests easy to run and debug locally
- Clear error messages when tests fail
- Easy to add new tests (good patterns established)

## Tools & Dependencies

### New Dependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@vitest/coverage-v8": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "vitest": "^1.0.0",
    "happy-dom": "^12.0.0"
  }
}
```

### NPM Scripts

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:unit:ui": "vitest --ui",
    "test:integration": "vitest run --config vitest.integration.config.js",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Migration from Existing Tests

### Current State
- Manual smoke tests in `tests/smoke-test.js` and `tests/advanced-smoke-test.js`
- ~85% pass rate (some timing/automation issues)
- Run in browser console
- Cover basic functionality

### Migration Strategy
- Keep existing tests as reference during migration
- Port each test to Playwright with proper assertions
- Add `data-testid` attributes to make tests more reliable
- Expand coverage beyond what smoke tests check
- Delete old tests once new suite is comprehensive

### Example Conversion

**Old smoke test:**
```javascript
async function testCSSEditorLoad() {
  const editor = document.querySelector('.css-editor');
  if (!editor) throw new Error('CSS Editor not found');
  console.log('✅ CSS Editor loaded');
}
```

**New Playwright test:**
```javascript
test('CSS Editor loads and displays', async ({ page }) => {
  await page.goto(baseURL);
  await page.click('[data-testid="toggle-button"]');
  await expect(page.locator('.css-editor')).toBeVisible();
});
```

## Risks & Mitigation

### Risk: Tests become flaky
**Mitigation:**
- Use Playwright's auto-waiting features
- Avoid arbitrary timeouts
- Use proper assertions (toBeVisible, toHaveText)
- Test in CI to catch environment-specific issues

### Risk: E2E tests too slow
**Mitigation:**
- Run in parallel (matrix across 3 browsers)
- Only run E2E on PR/push, not on every commit
- Keep unit tests fast for TDD workflow
- Use Playwright's trace viewer to debug failures quickly

### Risk: Mock API diverges from real API
**Mitigation:**
- Use real captured payloads
- Document CXone API version in fixtures
- Periodically run tests against real site (staging)
- Update fixtures when API changes

### Risk: Too much maintenance overhead
**Mitigation:**
- Use page objects to reduce duplication
- Good test organization for easy navigation
- Clear documentation for adding new tests
- Coverage reports show what's already tested

## Future Enhancements

### Potential Additions
- Visual regression testing (screenshot comparison)
- Accessibility testing (axe-core integration)
- Performance budgets (lighthouse CI)
- Bundle size tracking over time
- Mutation testing (test quality assessment)
- Contract testing for CXone API

### Scalability
- As project grows, consider splitting E2E tests into critical vs comprehensive
- Add smoke test suite (subset of E2E) for faster feedback
- Implement test sharding for even faster CI
- Add per-commit testing for critical paths only

## Conclusion

This testing methodology provides comprehensive coverage while supporting rapid TDD workflows. The three-layer approach balances speed and confidence: fast unit tests for quick iteration, integration tests for critical dependencies, and E2E tests for real-world validation.

By testing against deployed artifacts in CI, we ensure that what passes tests is exactly what gets deployed to production. The phased rollout allows for incremental adoption without disrupting current development.

The infrastructure supports both mocked and real-site testing, giving flexibility for development (fast, safe mocks) and validation (real integration testing when needed).
