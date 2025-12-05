import { test, expect } from '@playwright/test';
import { CXoneAPIMock } from '../helpers/mock-server.js';
import { CXoneExpertPage, CSSEditorPage } from '../helpers/page-objects.js';
import { navigateToTestPage } from '../helpers/navigation.js';

// Platform detection for keyboard shortcuts
const isMac = process.platform === 'darwin';
const modifier = isMac ? 'Meta' : 'Control';
const EDITOR_READY_TIMEOUT = 2000;

test.describe('Keyboard Shortcuts', () => {
  let mockAPI;
  let expertPage;
  let cssEditor;

  test.beforeEach(async ({ page }) => {
    mockAPI = new CXoneAPIMock(page);
    await mockAPI.enableMocking();

    expertPage = new CXoneExpertPage(page);
    cssEditor = new CSSEditorPage(page);

    await navigateToTestPage(page);

    await expertPage.openToolkit();
    await expertPage.switchApp('css-editor');

    // Wait for CSS editor role buttons to render instead of sleeping
    await page.waitForSelector('.toggle-bar .toggle-btn[data-role]', {
      state: 'visible',
      timeout: EDITOR_READY_TIMEOUT
    });
  });

  test('Ctrl+S should save current/active tab', async ({ page }) => {
    await cssEditor.switchRole('all');
    await cssEditor.typeInEditor('body { color: red; }');

    mockAPI.clearRequests();
    await page.keyboard.press(`${modifier}+S`);

    await expect
      .poll(
        () => mockAPI.getRequests('/deki/cp/custom_css.php').length,
        { timeout: 2000 }
      )
      .toBeGreaterThan(0);

    const requests = mockAPI.getRequests('/deki/cp/custom_css.php');
    // Should only save current role - payload is multipart form data string
    expect(requests[0].payload).toContain('css_template_all');
  });

  test('Ctrl+Shift+S should save all tabs', async ({ page }) => {
    await cssEditor.switchRole('all');
    await cssEditor.typeInEditor('body { color: blue; }');

    mockAPI.clearRequests();
    await page.keyboard.press(`${modifier}+Shift+S`);

    await expect
      .poll(
        () => mockAPI.getRequests('/deki/cp/custom_css.php').length,
        { timeout: 2000 }
      )
      .toBeGreaterThan(0);
  });

  test('Ctrl+Shift+F should format all code', async ({ page }) => {
    await cssEditor.switchRole('all');
    await cssEditor.typeInEditor('body{color:red;}');

    await page.keyboard.press(`${modifier}+Shift+F`);

    // Wait for the "formatted" toast to appear
    const toast = page.locator('.enhancements-toast');
    await expect(toast).toContainText(/formatted/i, { timeout: 10000 });

    // Verify the content was actually formatted (structure changed)
    const content = await cssEditor.getEditorContent('all');
    expect(content).toMatch(/body\s*\{\s*\n\s*color:\s*red;?\s*\n\}/);
    // Ensure formatting added whitespace/newlines (length > original)
    expect(content.length).toBeGreaterThan('body{color:red;}'.length);
  });

  test('Mac Cmd key should work instead of Ctrl', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Mac shortcuts only on Safari/WebKit');

    await cssEditor.switchRole('all');
    await cssEditor.typeInEditor('body { color: green; }');

    mockAPI.clearRequests();
    // Cmd+S should save current/active tab (same as Ctrl+S)
    await page.keyboard.press('Meta+S');

    await expect
      .poll(
        () => mockAPI.getRequests('/deki/cp/custom_css.php').length,
        { timeout: 2000 }
      )
      .toBeGreaterThan(0);

    const requests = mockAPI.getRequests('/deki/cp/custom_css.php');
    // Should only save current role - payload is multipart form data string
    expect(requests[0].payload).toContain('css_template_all');
  });
});
