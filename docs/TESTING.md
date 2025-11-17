# Testing Documentation

This document provides comprehensive information about the testing infrastructure, branch protection requirements, and testing workflows for the CXOne Expert Enhancements project.

## Table of Contents

1. [Branch Protection Configuration](#branch-protection-configuration)
2. [Local Testing Before Push](#local-testing-before-push)
3. [Testing Architecture](#testing-architecture)
4. [CI/CD Testing Workflow](#cicd-testing-workflow)
5. [Test Commands Reference](#test-commands-reference)

---

## Branch Protection Configuration

### Required Status Checks

Configure branch protection for `develop` and `main` branches to ensure code quality and prevent breaking changes.

### Status Checks (all must pass):

- Unit Tests
- Integration Tests
- E2E Tests (chromium)
- E2E Tests (firefox)
- E2E Tests (webkit)

### Settings

**For `develop` branch:**

1. Go to Repository Settings → Branches
2. Add branch protection rule for `develop`:
   - Require status checks to pass before merging
   - Require branches to be up to date before merging
   - Select all test jobs as required:
     - `Unit Tests`
     - `Integration Tests`
     - `E2E Tests (chromium)`
     - `E2E Tests (firefox)`
     - `E2E Tests (webkit)`
   - Require linear history (optional but recommended)

**For `main` branch:**

1. Add branch protection rule for `main`:
   - Same settings as develop branch
   - Additionally require pull request reviews (1 approval minimum)
   - Dismiss stale pull request approvals when new commits are pushed
   - Require review from Code Owners (if CODEOWNERS file exists)

---

## Local Testing Before Push

Always run tests locally before pushing to ensure code quality and catch issues early.

### Quick Test Commands

```bash
# Run all tests (unit, integration, and E2E)
npm run test

# Run only unit tests (fastest, recommended for quick checks)
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests (requires build and deployment)
npm run test:e2e
```

### Development Testing Commands

```bash
# Watch mode for unit tests during development
npm run test:unit:watch

# Interactive UI for unit tests
npm run test:unit:ui

# Watch mode for integration tests
npm run test:integration:watch

# Interactive UI for E2E tests
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Generate coverage report
npm run test:coverage
```

### Recommended Workflow

1. **During development:**
   ```bash
   npm run test:unit:watch
   ```
   Keep unit tests running in watch mode for immediate feedback.

2. **Before committing:**
   ```bash
   npm run test:unit && npm run test:integration
   ```
   Ensure unit and integration tests pass.

3. **Before pushing:**
   ```bash
   npm run test
   ```
   Run the full test suite to catch any integration or E2E issues.

---

## Testing Architecture

### Three-Layer Testing Strategy

1. **Unit Tests (Vitest + happy-dom)**
   - Fast, isolated component and utility tests
   - Mock external dependencies
   - Focus on individual function/component behavior
   - Located in: `tests/unit/`
   - Configuration: `vitest.config.js`

2. **Integration Tests (Vitest + happy-dom)**
   - Test component interactions and data flow
   - Mock external APIs but test real component integration
   - Located in: `tests/integration/`
   - Configuration: `vitest.integration.config.js`

3. **E2E Tests (Playwright)**
   - Full user workflow testing
   - Test against deployed build on Digital Ocean Spaces
   - Cross-browser testing (Chromium, Firefox, WebKit)
   - Located in: `tests/e2e/`
   - Configuration: `playwright.config.js`

### Coverage Requirements

- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

Coverage reports are generated in the `coverage/` directory.

---

## CI/CD Testing Workflow

The GitHub Actions workflow (`.github/workflows/test.yml`) runs on:
- Push to `develop`, `main`, or any `feature/**`, `bugfix/**`, `hotfix/**` branch
- Pull requests to `develop` or `main`

### Workflow Jobs

1. **Unit Tests**
   - Runs on: `ubuntu-latest`
   - Executes: Unit test suite with coverage
   - Uploads: Coverage report to Codecov

2. **Integration Tests**
   - Runs on: `ubuntu-latest`
   - Executes: Integration test suite

3. **E2E Tests (Matrix)**
   - Runs on: `ubuntu-latest`
   - Browsers: Chromium, Firefox, WebKit
   - Depends on: Unit and Integration tests passing
   - Steps:
     1. Build project
     2. Deploy to Digital Ocean Spaces
     3. Install Playwright browser
     4. Run E2E tests against deployed build
     5. Upload test results and reports on failure

4. **Test Summary**
   - Runs on: `ubuntu-latest`
   - Depends on: All test jobs
   - Verifies: All tests passed
   - Provides: Summary of test results

### Test Artifacts

Failed tests and reports are uploaded as artifacts:
- Test results: Retained for 7 days
- Test reports: Retained for 7 days
- Browser-specific: Separate artifacts per browser

---

## Test Commands Reference

### Unit Tests

```bash
npm run test:unit              # Run unit tests once
npm run test:unit:watch        # Watch mode for development
npm run test:unit:ui           # Interactive UI
npm run test:coverage          # Generate coverage report
```

### Integration Tests

```bash
npm run test:integration       # Run integration tests once
npm run test:integration:watch # Watch mode for development
```

### E2E Tests

```bash
npm run test:e2e               # Run all E2E tests
npm run test:e2e:ui            # Interactive UI
npm run test:e2e:headed        # Run with visible browser
npm run test:e2e -- --project=chromium  # Run specific browser
npm run test:e2e -- --grep="keyword"    # Run tests matching keyword
```

### Full Test Suite

```bash
npm run test                   # Run all tests (unit, integration, E2E)
```

---

## Testing Best Practices

### Writing Tests

1. **Follow TDD principles:** Write tests before implementation when possible
2. **Test behavior, not implementation:** Focus on what the code does, not how
3. **Keep tests independent:** Each test should run in isolation
4. **Use descriptive names:** Test names should clearly describe what is being tested
5. **Avoid test duplication:** Each scenario should be tested once at the appropriate level

### Test Organization

- **Unit tests:** Test individual functions/components in isolation
- **Integration tests:** Test interactions between multiple components
- **E2E tests:** Test complete user workflows and critical paths

### Performance

- Run unit tests frequently during development
- Run integration tests before committing
- Run E2E tests before pushing or in CI/CD
- Use watch mode for rapid feedback during development

### Debugging

1. **Unit/Integration tests:**
   ```bash
   npm run test:unit:ui    # Visual debugging
   ```

2. **E2E tests:**
   ```bash
   npm run test:e2e:headed # See browser in action
   npm run test:e2e:ui     # Playwright UI mode
   ```

3. **CI failures:**
   - Check uploaded artifacts in GitHub Actions
   - Review test results and screenshots
   - Run tests locally with same configuration

---

## Troubleshooting

### Common Issues

**Tests fail locally but pass in CI:**
- Check Node.js version matches CI (v18)
- Ensure dependencies are up to date: `npm ci`
- Check for platform-specific issues

**E2E tests timeout:**
- Increase timeout in `playwright.config.js`
- Check network connectivity to deployment
- Verify deployment was successful

**Coverage below threshold:**
- Run `npm run test:coverage` to see report
- Add tests for uncovered code paths
- Check coverage report in `coverage/index.html`

### Getting Help

1. Check test output for specific error messages
2. Review test files in `tests/` directory for examples
3. Consult testing framework documentation:
   - Vitest: https://vitest.dev/
   - Playwright: https://playwright.dev/
4. Check CI logs in GitHub Actions for detailed error information
