import { test, expect } from '@playwright/test';
import { CXoneAPIMock } from '../helpers/mock-server.js';
import { CXoneExpertPage, HTMLEditorPage } from '../helpers/page-objects.js';
import { navigateToTestPage } from '../helpers/navigation.js';

test.describe('HTML Editor Workflow', () => {
  let mockAPI;
  let expertPage;
  let htmlEditor;

  test.beforeEach(async ({ page }) => {
    mockAPI = new CXoneAPIMock(page);
    await mockAPI.enableMocking();

    expertPage = new CXoneExpertPage(page);
    htmlEditor = new HTMLEditorPage(page);

    await navigateToTestPage(page);

    // Open toolkit and switch to HTML editor for all tests
    await expertPage.openToolkit();
    await expertPage.switchApp('html-editor');

    // Wait for HTML editor container to be visible and initialized
    await page.waitForSelector('#html-editor-container', { state: 'visible' });
    await page.waitForTimeout(500); // Give time for initialization
  });

  test('should load HTML editor and display content', async ({ page }) => {
    const editor = page.locator('#html-editor-container');
    await expect(editor).toBeVisible();
  });

  test('should edit HTML and mark field as dirty', async ({ page }) => {
    await htmlEditor.switchField('head');

    await htmlEditor.typeInEditor('<div>Custom Head</div>');

    const isDirty = await htmlEditor.isFieldDirty('head');
    expect(isDirty).toBe(true);
  });

  test('should save HTML and clear dirty state', async ({ page }) => {
    await htmlEditor.switchField('head');

    await htmlEditor.typeInEditor('<div>New Content</div>');
    await htmlEditor.saveCurrentField();

    // Check for the actual endpoint used by HTML editor
    const requests = mockAPI.getRequests('/deki/cp/custom_html.php');
    expect(requests.length).toBeGreaterThan(0);

    const isDirty = await htmlEditor.isFieldDirty('head');
    expect(isDirty).toBe(false);
  });

  test('should switch between head and tail fields', async ({ page }) => {
    await htmlEditor.switchField('tail');

    // Verify the tail editor is now visible
    const tailEditor = page.locator('#editor-tail');
    await expect(tailEditor).toBeVisible();
  });
});
