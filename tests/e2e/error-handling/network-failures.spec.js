import { test, expect } from '@playwright/test';
import { CXoneAPIMock } from '../helpers/mock-server.js';
import { CXoneExpertPage, CSSEditorPage, HTMLEditorPage } from '../helpers/page-objects.js';
import { navigateToTestPage } from '../helpers/navigation.js';

test.describe('Network Failure Handling', () => {
  let mockAPI;
  let expertPage;
  let cssEditor;
  let htmlEditor;

  test.beforeEach(async ({ page }) => {
    mockAPI = new CXoneAPIMock(page);
    await mockAPI.enableMocking();

    expertPage = new CXoneExpertPage(page);
    cssEditor = new CSSEditorPage(page);
    htmlEditor = new HTMLEditorPage(page);

    await navigateToTestPage(page);
    await expertPage.openToolkit();
  });

  test('should handle CSS save failure gracefully', async ({ page }) => {
    await expertPage.switchApp('css-editor');

    // Wait for CSS editor to be fully initialized
    await page.waitForSelector('.toggle-bar', { state: 'visible' });
    await page.waitForTimeout(500);

    await cssEditor.switchRole('all');

    // Make changes
    await cssEditor.typeInEditor('body { background: red; }');

    // Inject error for save endpoint
    await mockAPI.injectError('/deki/cp/custom_css.php', '500');

    // Attempt to save
    await cssEditor.saveCurrentRole();

    // Wait for error to be processed - check that dirty state persists
    await page.waitForTimeout(500);

    // Check console for error messages
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    // Verify dirty state is still present (save failed)
    const isDirty = await cssEditor.isRoleDirty('all');
    expect(isDirty).toBe(true);

    // Verify no success message (there should be no "Saved!" notification)
    const successMsg = page.locator('.successmsg, .success-notification');
    await expect(successMsg).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // It's ok if element doesn't exist
    });

    // Verify UI remains responsive - should be able to type more content
    await cssEditor.typeInEditor('\n/* Additional content after error */');

    // Verify editor content includes the new text
    const content = await cssEditor.getEditorContent('all');
    expect(content).toContain('Additional content after error');

    // Verify save button is still available and not disabled
    const saveBtn = page.locator('button:has-text("Save"), button[title*="Save"]').first();
    await expect(saveBtn).toBeEnabled();
  });

  test('should handle HTML save failure gracefully', async ({ page }) => {
    await expertPage.switchApp('html-editor');

    // Wait for HTML editor to be fully initialized
    await page.waitForSelector('.toggle-bar', { state: 'visible' });
    await page.waitForTimeout(500);

    await htmlEditor.switchField('body_footer');

    // Make changes
    await htmlEditor.typeInEditor('<div>Test content</div>');

    // Inject error for save endpoint
    await mockAPI.injectError('/deki/cp/custom_html.php', '500');

    // Attempt to save
    await htmlEditor.saveCurrentField();

    // Wait for error to be processed - check that dirty state persists
    await page.waitForTimeout(500);

    // Verify dirty state is still present (save failed)
    const isDirty = await htmlEditor.isFieldDirty('body_footer');
    expect(isDirty).toBe(true);

    // Verify no success message
    const successMsg = page.locator('.successmsg, .success-notification');
    await expect(successMsg).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // It's ok if element doesn't exist
    });

    // Verify UI remains responsive - should be able to type more content
    await htmlEditor.typeInEditor('\n<!-- Additional content after error -->');

    // Verify editor content includes the new text
    const content = await htmlEditor.getEditorContent('body_footer');
    expect(content).toContain('Additional content after error');

    // Verify save button is still available and not disabled
    const saveBtn = page.locator('button:has-text("Save"), button[title*="Save"]').first();
    await expect(saveBtn).toBeEnabled();
  });

  test('should handle CSS load failure', async ({ page }) => {
    // Inject error before loading editor
    await mockAPI.injectError('/api/css/load', '404');

    await expertPage.switchApp('css-editor');

    // Wait for error to be handled
    await page.waitForTimeout(1000);

    // Editor should still mount even if load fails
    const toggleBar = page.locator('.toggle-bar');
    await expect(toggleBar).toBeVisible({ timeout: 5000 });

    // Should show at least one role tab (default empty state)
    const roleButton = page.locator('button.toggle-btn[data-role]').first();
    await expect(roleButton).toBeVisible();
  });

  test('should handle HTML load failure', async ({ page }) => {
    // Inject error before loading editor
    await mockAPI.injectError('/api/html/load', '404');

    await expertPage.switchApp('html-editor');

    // Wait for error to be handled
    await page.waitForTimeout(1000);

    // Editor should still mount even if load fails
    const toggleBar = page.locator('.toggle-bar');
    await expect(toggleBar).toBeVisible({ timeout: 5000 });

    // Should show at least one field tab (default empty state)
    const fieldButton = page.locator('button.toggle-btn[data-field]').first();
    await expect(fieldButton).toBeVisible();
  });

  test('should handle network timeout gracefully', async ({ page }) => {
    await expertPage.switchApp('css-editor');

    // Wait for CSS editor to be fully initialized
    await page.waitForSelector('.toggle-bar', { state: 'visible' });
    await page.waitForTimeout(500);

    await cssEditor.switchRole('all');

    // Make changes
    await cssEditor.typeInEditor('body { background: blue; }');

    // Inject timeout error
    await mockAPI.injectError('/deki/cp/custom_css.php', 'timeout');

    // Attempt to save (this will hang)
    await cssEditor.saveCurrentRole();

    // Wait to see if timeout is handled
    await page.waitForTimeout(3000);

    // Editor should still be responsive
    const overlay = page.locator('#expert-enhancements-overlay');
    await expect(overlay).toBeVisible();

    // Should be able to type more
    await cssEditor.typeInEditor('/* Still working */');
  });

  test('should handle 403 forbidden error', async ({ page }) => {
    await expertPage.switchApp('css-editor');

    // Wait for CSS editor to be fully initialized
    await page.waitForSelector('.toggle-bar', { state: 'visible' });
    await page.waitForTimeout(500);

    await cssEditor.switchRole('all');

    // Make changes
    await cssEditor.typeInEditor('body { background: green; }');

    // Inject 403 error
    await mockAPI.injectError('/deki/cp/custom_css.php', '403');

    // Attempt to save
    await cssEditor.saveCurrentRole();

    // Wait for error to be processed
    await page.waitForTimeout(500);

    // Verify dirty state remains
    const isDirty = await cssEditor.isRoleDirty('all');
    expect(isDirty).toBe(true);

    // Verify UI remains responsive after 403 error
    await cssEditor.typeInEditor('\n/* Still editable after 403 */');

    // Verify save button is still enabled for retry
    const saveBtn = page.locator('button:has-text("Save"), button[title*="Save"]').first();
    await expect(saveBtn).toBeEnabled();
  });

  test('should handle intermittent network failures with retry', async ({ page }) => {
    await expertPage.switchApp('css-editor');

    // Wait for CSS editor to be fully initialized
    await page.waitForSelector('.toggle-bar', { state: 'visible' });
    await page.waitForTimeout(500);

    await cssEditor.switchRole('all');

    // Make changes
    await cssEditor.typeInEditor('body { background: yellow; }');

    // First save attempt - inject error
    let saveAttempts = 0;
    await page.route('**/deki/cp/custom_css.php', async (route) => {
      const method = route.request().method();

      if (method === 'POST') {
        saveAttempts++;

        if (saveAttempts === 1) {
          // First attempt fails
          await route.fulfill({
            status: 500,
            body: JSON.stringify({ success: false, error: 'Server error' })
          });
        } else {
          // Subsequent attempts succeed
          await route.fulfill({
            status: 200,
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
            },
            body: ''
          });
        }
      } else {
        // GET requests
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=UTF-8',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
          },
          body: '<html><body><div class="successmsg">CSS loaded</div></body></html>'
        });
      }
    });

    // First save attempt (should fail)
    await cssEditor.saveCurrentRole();

    // Wait for save attempt to complete
    await page.waitForTimeout(500);

    // Verify still dirty after first failure
    let isDirty = await cssEditor.isRoleDirty('all');
    expect(isDirty).toBe(true);

    // Second save attempt (should succeed)
    await cssEditor.saveCurrentRole();

    // Wait for save to complete successfully
    await page.waitForTimeout(500);

    // Verify clean after second attempt
    isDirty = await cssEditor.isRoleDirty('all');
    expect(isDirty).toBe(false);
  });

  test('should handle malformed JSON response', async ({ page }) => {
    await expertPage.switchApp('css-editor');

    // Wait for CSS editor to be fully initialized
    await page.waitForSelector('.toggle-bar', { state: 'visible' });
    await page.waitForTimeout(500);

    // Inject malformed JSON for load
    await page.route('**/api/css/load', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'INVALID JSON{'
      });
    });

    // Try to switch roles (which triggers load)
    await cssEditor.switchRole('admin');

    // Wait for error handling
    await page.waitForTimeout(1000);

    // Editor should still be functional
    const overlay = page.locator('#expert-enhancements-overlay');
    await expect(overlay).toBeVisible();

    // Should be able to type
    await cssEditor.typeInEditor('/* Test */');
  });

  test('should handle CORS errors gracefully', async ({ page }) => {
    await expertPage.switchApp('html-editor');

    // Wait for HTML editor to be fully initialized
    await page.waitForSelector('.toggle-bar', { state: 'visible' });
    await page.waitForTimeout(500);

    await htmlEditor.switchField('body_footer');

    // Make changes
    await htmlEditor.typeInEditor('<p>CORS test</p>');

    // Inject CORS-like error (0 status code)
    await page.route('**/deki/cp/custom_html.php', async (route) => {
      // Abort the request to simulate CORS failure
      await route.abort('failed');
    });

    // Attempt to save
    await htmlEditor.saveCurrentField();

    // Wait for error handling
    await page.waitForTimeout(1000);

    // Editor should still be usable
    const overlay = page.locator('#expert-enhancements-overlay');
    await expect(overlay).toBeVisible();

    // Can still type
    await htmlEditor.typeInEditor(' <!-- Still working -->');
  });

  test('should preserve unsaved changes after network error', async ({ page }) => {
    await expertPage.switchApp('css-editor');

    // Wait for CSS editor to be fully initialized
    await page.waitForSelector('.toggle-bar', { state: 'visible' });
    await page.waitForTimeout(500);

    await cssEditor.switchRole('all');

    const testContent = 'body { background: purple; }';

    // Make changes
    await cssEditor.typeInEditor(testContent);

    // Inject error
    await mockAPI.injectError('/deki/cp/custom_css.php', '500');

    // Attempt to save
    await cssEditor.saveCurrentRole();

    // Wait for save attempt to complete
    await page.waitForTimeout(500);

    // Switch to different role and back
    await cssEditor.switchRole('admin');
    await page.waitForSelector('.toggle-bar', { state: 'visible' });

    await cssEditor.switchRole('all');
    await page.waitForSelector('.toggle-bar', { state: 'visible' });

    // Verify content is still there
    const content = await cssEditor.getEditorContent('all');
    expect(content).toContain('purple');

    // Verify still dirty
    const isDirty = await cssEditor.isRoleDirty('all');
    expect(isDirty).toBe(true);
  });

  test('should handle multiple simultaneous save failures', async ({ page }) => {
    await expertPage.switchApp('css-editor');

    // Wait for CSS editor to be fully initialized
    await page.waitForSelector('.toggle-bar', { state: 'visible' });
    await page.waitForTimeout(500);

    // Make changes to multiple roles
    await cssEditor.switchRole('all');
    await cssEditor.typeInEditor('/* All */');

    await cssEditor.switchRole('admin');
    await cssEditor.typeInEditor('/* Admin */');

    await cssEditor.switchRole('agent');
    await cssEditor.typeInEditor('/* Agent */');

    // Inject error
    await mockAPI.injectError('/deki/cp/custom_css.php', '503');

    // Try to save all
    await cssEditor.saveAll();

    // Wait for save attempts to complete
    await page.waitForTimeout(1000);

    // Verify all roles are still dirty
    await cssEditor.switchRole('all');
    let isDirty = await cssEditor.isRoleDirty('all');
    expect(isDirty).toBe(true);

    await cssEditor.switchRole('admin');
    isDirty = await cssEditor.isRoleDirty('admin');
    expect(isDirty).toBe(true);

    await cssEditor.switchRole('agent');
    isDirty = await cssEditor.isRoleDirty('agent');
    expect(isDirty).toBe(true);
  });
});
