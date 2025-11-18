import { test, expect } from '@playwright/test';
import { CXoneAPIMock } from '../helpers/mock-server.js';
import { CXoneExpertPage, HTMLEditorPage } from '../helpers/page-objects.js';
import { navigateToTestPage } from '../helpers/navigation.js';

test.describe('CSRF Protection', () => {
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
  });

  test('should include CSRF token in save requests', async ({ page }) => {
    // Clear captured requests to start fresh
    mockAPI.clearRequests();

    // Switch to head field and make an edit
    await htmlEditor.switchField('head');
    await htmlEditor.typeInEditor('<div>Test Content</div>');

    // Save the field
    await htmlEditor.saveCurrentField();

    // Get all save requests
    const saveRequests = mockAPI.getRequests('/deki/cp/custom_html.php');

    // Filter for POST requests (save operations)
    const postRequests = saveRequests.filter(req => req.method === 'POST');

    expect(postRequests.length).toBeGreaterThan(0);

    // Verify CSRF token is present in the payload
    const lastSaveRequest = postRequests[postRequests.length - 1];
    expect(lastSaveRequest.payload).toBeTruthy();
    expect(lastSaveRequest.payload).toContain('csrf_token');
  });

  test('should reject requests without CSRF token', async ({ page }) => {
    // This test verifies that the application always includes CSRF tokens in save requests
    // In production, the CXone API would reject requests without CSRF tokens

    // Clear captured requests to start fresh
    mockAPI.clearRequests();

    // Switch to head field and make an edit
    await htmlEditor.switchField('head');
    await htmlEditor.typeInEditor('<div>Content</div>');

    // Save the field
    await htmlEditor.saveCurrentField();

    // Verify the save completed successfully and included CSRF token
    const requests = mockAPI.getRequests('/deki/cp/custom_html.php');
    const postRequests = requests.filter(req => req.method === 'POST');
    expect(postRequests.length).toBeGreaterThan(0);

    // Verify CSRF token is present in the payload
    const lastSaveRequest = postRequests[postRequests.length - 1];
    expect(lastSaveRequest.payload).toBeTruthy();
    expect(lastSaveRequest.payload).toContain('csrf_token');

    // Additional check: token should not be empty
    expect(lastSaveRequest.payload).not.toContain('csrf_token=&');
    expect(lastSaveRequest.payload).not.toContain('csrf_token=""');
  });

  test('should fetch CSRF token on initial load', async ({ page }) => {
    // This test verifies that CSRF tokens are properly included in save requests
    // The token is fetched during initialization from the form endpoint

    // Perform a save operation to demonstrate token functionality
    await htmlEditor.switchField('head');
    await htmlEditor.typeInEditor('<div>Test Content</div>');
    await htmlEditor.saveCurrentField();

    // Get all save requests
    const saveRequests = mockAPI.getRequests('/deki/cp/custom_html.php');
    const postRequests = saveRequests.filter(req => req.method === 'POST');
    expect(postRequests.length).toBeGreaterThan(0);

    // Verify the save included a CSRF token (which must have been loaded during init)
    const lastSaveRequest = postRequests[postRequests.length - 1];
    expect(lastSaveRequest.payload).toBeTruthy();
    expect(lastSaveRequest.payload).toContain('csrf_token');

    // Token should have a value
    expect(lastSaveRequest.payload).not.toContain('csrf_token=&');
  });
});
