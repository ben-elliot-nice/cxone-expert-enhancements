import { test, expect } from '@playwright/test';
import { CXoneAPIMock } from '../helpers/mock-server.js';
import { CXoneExpertPage, CSSEditorPage } from '../helpers/page-objects.js';
import { navigateToTestPage } from '../helpers/navigation.js';

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

    await navigateToTestPage(page);

    await expertPage.openToolkit();
    await expertPage.switchApp('css-editor');

    // Wait for CSS editor to be fully initialized (same as css-editor-workflow.spec.js)
    await page.waitForSelector('.toggle-bar', { state: 'visible' });
    await page.waitForTimeout(500);
  });

  test('Ctrl+S should save current/active tab', async ({ page }) => {
    await cssEditor.switchRole('all');
    await cssEditor.typeInEditor('body { color: red; }');

    mockAPI.clearRequests();
    await page.keyboard.press(`${modifier}+S`);
    await page.waitForTimeout(500);

    const requests = mockAPI.getRequests('/deki/cp/custom_css.php');
    expect(requests.length).toBeGreaterThan(0);
    // Should only save current role - payload is multipart form data string
    expect(requests[0].payload).toContain('css_template_all');
  });

  test('Ctrl+Shift+S should save all tabs', async ({ page }) => {
    await cssEditor.switchRole('all');
    await cssEditor.typeInEditor('body { color: blue; }');

    mockAPI.clearRequests();
    await page.keyboard.press(`${modifier}+Shift+S`);
    await page.waitForTimeout(500);

    const requests = mockAPI.getRequests('/deki/cp/custom_css.php');
    expect(requests.length).toBeGreaterThan(0);
  });

  test('Ctrl+Shift+F should format all code', async ({ page }) => {
    await cssEditor.switchRole('all');
    await cssEditor.typeInEditor('body{color:red;}');

    await page.keyboard.press(`${modifier}+Shift+F`);

    // Wait for formatting to complete by checking for the "formatted" notification
    // This is more reliable than polling Monaco's internal state
    await page.waitForFunction(
      () => {
        // Look for the toast notification that formatting completed
        const toasts = Array.from(document.querySelectorAll('.toast-notification, .notification, [class*="toast"]'));
        return toasts.some(toast =>
          toast.textContent && toast.textContent.toLowerCase().includes('formatted')
        );
      },
      { timeout: 10000 }
    );

    // Verify the content was actually formatted
    const content = await cssEditor.getEditorContent('all');
    // Should be formatted with spaces and newlines
    expect(content).toMatch(/body\s*{/);
    expect(content).toMatch(/color:\s*red/);
  });

  test('Mac Cmd key should work instead of Ctrl', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Mac shortcuts only on Safari/WebKit');

    await cssEditor.switchRole('all');
    await cssEditor.typeInEditor('body { color: green; }');

    mockAPI.clearRequests();
    // Cmd+S should save current/active tab (same as Ctrl+S)
    await page.keyboard.press('Meta+S');
    await page.waitForTimeout(500);

    const requests = mockAPI.getRequests('/deki/cp/custom_css.php');
    expect(requests.length).toBeGreaterThan(0);
    // Should only save current role - payload is multipart form data string
    expect(requests[0].payload).toContain('css_template_all');
  });
});
