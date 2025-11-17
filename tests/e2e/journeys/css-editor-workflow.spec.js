import { test, expect } from '@playwright/test';
import { CXoneAPIMock } from '../helpers/mock-server.js';
import { CXoneExpertPage, CSSEditorPage } from '../helpers/page-objects.js';
import { navigateToTestPage } from '../helpers/navigation.js';

test.describe('CSS Editor Workflow', () => {
  let mockAPI;
  let expertPage;
  let cssEditor;

  test.beforeEach(async ({ page }) => {
    mockAPI = new CXoneAPIMock(page);
    await mockAPI.enableMocking();

    expertPage = new CXoneExpertPage(page);
    cssEditor = new CSSEditorPage(page);

    await navigateToTestPage(page);
  });

  test('should load CSS editor and display content', async ({ page }) => {
    await expertPage.openToolkit();
    await expertPage.switchApp('css-editor');

    // Verify CSS editor is visible
    const editor = page.locator('.css-editor');
    await expect(editor).toBeVisible();
  });

  test('should edit CSS and mark tab as dirty', async ({ page }) => {
    await expertPage.openToolkit();
    await expertPage.switchApp('css-editor');
    await cssEditor.switchRole('all-roles');

    // Type in editor
    await cssEditor.typeInEditor('body { background: red; }');

    // Verify dirty state
    const isDirty = await cssEditor.isRoleDirty('all-roles');
    expect(isDirty).toBe(true);
  });

  test('should save CSS and clear dirty state', async ({ page }) => {
    await expertPage.openToolkit();
    await expertPage.switchApp('css-editor');
    await cssEditor.switchRole('all-roles');

    // Edit and save
    await cssEditor.typeInEditor('body { background: blue; }');
    await cssEditor.saveCurrentRole();

    // Verify save request was made
    const requests = mockAPI.getRequests('/api/css/save');
    expect(requests.length).toBeGreaterThan(0);

    // Verify dirty state cleared
    const isDirty = await cssEditor.isRoleDirty('all-roles');
    expect(isDirty).toBe(false);
  });

  test('should switch between role tabs', async ({ page }) => {
    await expertPage.openToolkit();
    await expertPage.switchApp('css-editor');

    // Switch to admin role
    await cssEditor.switchRole('admin');

    // Verify active tab
    const activeTab = page.locator('[data-testid="tab-admin"][aria-selected="true"]');
    await expect(activeTab).toBeVisible();
  });

  test('should save all roles with Ctrl+S', async ({ page }) => {
    await expertPage.openToolkit();
    await expertPage.switchApp('css-editor');

    // Make changes to multiple roles
    await cssEditor.switchRole('all-roles');
    await cssEditor.typeInEditor('/* All roles */');

    await cssEditor.switchRole('admin');
    await cssEditor.typeInEditor('/* Admin */');

    // Save all
    await cssEditor.saveAll();

    // Verify save requests
    const requests = mockAPI.getRequests('/api/css/save');
    expect(requests.length).toBeGreaterThan(0);
  });
});
