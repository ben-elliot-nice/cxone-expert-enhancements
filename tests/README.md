# CXone Expert Enhancements - Test Suite

This directory contains comprehensive testing for the project.

## Test Structure

```
tests/
├── unit/              # Fast, isolated unit tests
│   ├── core/          # Core toolkit functionality
│   ├── editors/       # Editor-specific tests
│   └── helpers/       # Shared test helpers and setup
├── integration/       # Monaco wrapper integration tests
│   ├── editor-lifecycle.test.js
│   ├── formatting.test.js
│   ├── monaco-wrapper.test.js
│   └── helpers/       # Integration test utilities
├── e2e/              # Full user journey E2E tests
│   ├── helpers/       # Page objects and mock server
│   └── fixtures/      # Test fixtures and data
└── reference/        # Reference implementations and examples
```

## Running Tests Locally

```bash
# All tests (unit + integration + E2E)
npm test

# Unit tests only
npm run test:unit
npm run test:unit:watch    # Watch mode for TDD
npm run test:unit:ui        # Interactive UI mode

# Integration tests
npm run test:integration
npm run test:integration:watch

# E2E tests
npm run test:e2e
npm run test:e2e:ui        # Interactive UI mode
npm run test:e2e:headed    # See browser

# Coverage
npm run test:coverage
```

## Test Framework Details

### Unit & Integration Tests (Vitest)

- **Framework**: Vitest with happy-dom environment
- **Config**: `vitest.config.js` (unit), `vitest.integration.config.js` (integration)
- **Coverage Target**: 80% (statements, branches, functions, lines)
- **Environment**: happy-dom (fast DOM simulation)
- **Globals**: Enabled for `describe`, `it`, `expect`

### E2E Tests (Playwright)

- **Framework**: Playwright
- **Config**: `playwright.config.js`
- **Browsers**: Chromium, Firefox, WebKit
- **Parallel**: Fully parallel execution
- **Retries**: 2 retries in CI, 0 locally
- **Artifacts**: Screenshots on failure, video on failure, trace on retry

## Writing New Tests

### Unit Tests

Place in `tests/unit/` following the existing structure (core/, editors/, helpers/).

Example:
```javascript
import { describe, it, expect } from 'vitest';

describe('MyModule', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

**Best Practices:**
- Keep tests fast and isolated
- Mock external dependencies
- Use descriptive test names
- Test edge cases and error conditions
- Aim for 80%+ coverage

### Integration Tests

Place in `tests/integration/` for testing Monaco wrapper and complex interactions.

Example:
```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMonacoWrapper } from '../helpers/monaco-test-utils.js';

describe('Monaco Integration', () => {
  let wrapper;

  beforeEach(async () => {
    wrapper = await createMonacoWrapper();
  });

  afterEach(() => {
    wrapper.cleanup();
  });

  it('should integrate properly', async () => {
    // Test Monaco wrapper integration
  });
});
```

### E2E Tests

Use page objects from `tests/e2e/helpers/page-objects.js` for maintainable tests.

Example:
```javascript
import { test, expect } from '@playwright/test';
import { CXoneExpertPage } from '../helpers/page-objects.js';

test('should do something', async ({ page }) => {
  const expertPage = new CXoneExpertPage(page);
  await expertPage.openToolkit();
  // ... rest of test
});
```

**Best Practices:**
- Use page objects for UI interactions
- Avoid hard-coded waits (`waitForTimeout`)
- Use proper locators and waits
- Test complete user journeys
- Keep tests independent and isolated

## Available Page Objects

### CXoneExpertPage
Main page object for CXone Expert interactions:
- `openToolkit()` - Opens the enhancement toolkit
- `selectModule(name)` - Selects a specific module
- `waitForEditor()` - Waits for Monaco editor to load
- `getEditorContent()` - Gets current editor content
- `setEditorContent(content)` - Sets editor content
- `saveChanges()` - Saves editor changes

### Mock Server
E2E tests include a mock server (`tests/e2e/helpers/mock-server.js`) for simulating backend responses.

## CI/CD

Tests run automatically on push/PR. All must pass to merge.

### CI Configuration
- **Platform**: GitHub Actions
- **Triggers**: Push and Pull Request
- **Retries**: 2 retries for flaky tests
- **Workers**: 1 worker in CI for stability
- **Artifacts**: HTML reports, screenshots, videos, traces

### PR Requirements
- All unit tests must pass
- All integration tests must pass
- All E2E tests must pass
- Coverage must meet 80% threshold

## Troubleshooting

### Common Issues

**Playwright browsers not installed**
```bash
npx playwright install
```

**Tests timing out**
- Increase timeout in config
- Check for network issues
- Review test logs for blocking operations

**Flaky tests**
- Use proper waits (not `waitForTimeout`)
- Ensure test isolation
- Check for race conditions
- Review retry logic

**Coverage not meeting threshold**
```bash
# Run coverage report to see gaps
npm run test:coverage

# Open HTML report
open coverage/index.html
```

**Monaco wrapper tests failing**
- Ensure Monaco is properly initialized
- Check DOM environment setup
- Review integration test helpers

**E2E tests failing in CI but passing locally**
- Check CI environment differences
- Review GitHub Actions logs
- Use `trace: 'on'` for debugging
- Check timing/race conditions

## Test Maintenance

### When to Update Tests

1. **Feature Changes**: Update corresponding tests
2. **Bug Fixes**: Add regression tests
3. **API Changes**: Update integration tests
4. **UI Changes**: Update page objects and E2E tests

### Keeping Tests Fast

- Use unit tests for most logic
- Reserve integration tests for Monaco wrapper
- Use E2E tests sparingly for critical paths
- Mock external dependencies
- Keep test data minimal

### Test Organization

- Group related tests in describe blocks
- Use consistent naming conventions
- Keep test files focused and cohesive
- Share utilities in helpers/
- Document complex test setups

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Project Testing Methodology](../docs/plans/2025-11-15-testing-methodology-implementation.md)
