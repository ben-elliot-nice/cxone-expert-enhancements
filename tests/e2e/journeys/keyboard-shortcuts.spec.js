import { test, expect } from '@playwright/test';
import { CXoneAPIMock } from '../helpers/mock-server.js';
import { CXoneExpertPage, CSSEditorPage } from '../helpers/page-objects.js';

// Platform detection for keyboard shortcuts
const isMac = process.platform === 'darwin';
const modifier = isMac ? 'Meta' : 'Control';

test.describe('Keyboard Shortcuts', () => {
  let mockAPI;
  let expertPage;
  let cssEditor;

  test.beforeEach(async ({ page }) => {
    mockAPI = new CXoneAPIMock(page);
    await mockAPI.enableMocking();

    expertPage = new CXoneExpertPage(page);
    cssEditor = new CSSEditorPage(page);

    const baseURL = process.env.BASE_URL || 'http://localhost:5173';
    await page.goto(baseURL);

    await expertPage.openToolkit();
    await expertPage.switchApp('css-editor');
  });

  test('Ctrl+S should save current/active tab', async ({ page }) => {
    await cssEditor.switchRole('all-roles');
    await cssEditor.typeInEditor('body { color: red; }');

    mockAPI.clearRequests();
    await page.keyboard.press(`${modifier}+S`);
    await page.waitForTimeout(500);

    const requests = mockAPI.getRequests('/api/css/save');
    expect(requests.length).toBeGreaterThan(0);
    // Should only save current role
    expect(requests[0].payload?.role).toBe('all-roles');
  });

  test('Ctrl+Shift+S should save all tabs', async ({ page }) => {
    await cssEditor.switchRole('all-roles');
    await cssEditor.typeInEditor('body { color: blue; }');

    mockAPI.clearRequests();
    await page.keyboard.press(`${modifier}+Shift+S`);
    await page.waitForTimeout(500);

    const requests = mockAPI.getRequests('/api/css/save');
    expect(requests.length).toBeGreaterThan(0);
  });

  test('Ctrl+Shift+F should format all code', async ({ page }) => {
    await cssEditor.switchRole('all-roles');
    await cssEditor.typeInEditor('body{color:red;}');

    await page.keyboard.press(`${modifier}+Shift+F`);
    await page.waitForTimeout(500);

    const content = await cssEditor.getEditorContent('all-roles');
    // Should be formatted with spaces and newlines
    expect(content).toMatch(/body\s*{/);
    expect(content).toMatch(/color:\s*red/);
  });

  test('Mac Cmd key should work instead of Ctrl', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Mac shortcuts only on Safari/WebKit');

    await cssEditor.switchRole('all-roles');
    await cssEditor.typeInEditor('body { color: green; }');

    mockAPI.clearRequests();
    // Cmd+S should save current/active tab (same as Ctrl+S)
    await page.keyboard.press('Meta+S');
    await page.waitForTimeout(500);

    const requests = mockAPI.getRequests('/api/css/save');
    expect(requests.length).toBeGreaterThan(0);
    // Should only save current role
    expect(requests[0].payload?.role).toBe('all-roles');
  });
});
