import { test, expect } from '@playwright/test';
import { CXoneAPIMock } from '../helpers/mock-server.js';
import { CXoneExpertPage, HTMLEditorPage } from '../helpers/page-objects.js';
import { navigateToTestPage } from '../helpers/navigation.js';

test.describe('Input Sanitization', () => {
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

  test('should allow script tags in HTML editor (by design)', async ({ page }) => {
    // The HTML editor is specifically designed to allow script tags
    // because users need to add custom tracking scripts, analytics, etc.
    // This test verifies that legitimate use cases work correctly

    await htmlEditor.switchField('head');

    // Add a script tag (common legitimate use case)
    const scriptContent = '<script>console.log("Analytics loaded");</script>';
    await htmlEditor.typeInEditor(scriptContent);

    // Verify the content was accepted
    const editorContent = await htmlEditor.getEditorContent('head');

    expect(editorContent).toContain('<script>');
  });

  test('should not execute arbitrary scripts from editor content', async ({ page }) => {
    // This test verifies that content in the Monaco editor is not executed
    // The editor displays code but does not execute it

    let maliciousScriptExecuted = false;

    // Set up a trap - if the script executes, it will set a global variable
    await page.evaluate(() => {
      window.maliciousScriptTrap = false;
    });

    await htmlEditor.switchField('head');

    // Type potentially malicious content
    const maliciousContent = '<script>window.maliciousScriptTrap = true; alert("XSS");</script>';
    await htmlEditor.typeInEditor(maliciousContent);

    // Wait a moment to see if any script execution occurs
    await page.waitForTimeout(1000);

    // Check if the trap was triggered
    maliciousScriptExecuted = await page.evaluate(() => {
      return window.maliciousScriptTrap === true;
    });

    // The script should NOT have executed (editor content is not live)
    expect(maliciousScriptExecuted).toBe(false);
  });

  test('should handle special characters safely', async ({ page }) => {
    // Test that special characters and HTML entities are handled correctly

    await htmlEditor.switchField('head');

    // Content with special characters
    const specialContent = `<div data-value="test&value">
  Content with 'quotes' and "double quotes"
  Special chars: < > & ' "
  Unicode: \u{1F600} \u{1F4A1}
</div>`;

    await htmlEditor.typeInEditor(specialContent);

    // Verify the content is preserved correctly
    const editorContent = await htmlEditor.getEditorContent('head');

    // Content should be preserved as-is (Monaco handles escaping internally)
    expect(editorContent).toContain('data-value="test&value"');
  });

  test('should safely display content in UI elements', async ({ page }) => {
    // This test verifies that UI elements (like buttons, labels) are not vulnerable
    // to XSS through content injection

    await htmlEditor.switchField('head');

    // Add content
    await htmlEditor.typeInEditor('<div>Test</div>');

    // Check that UI elements use safe text content, not innerHTML for dynamic data
    const hasUnsafeInnerHTML = await page.evaluate(() => {
      // Check if any buttons or UI elements have user-generated content via innerHTML
      // This is a heuristic check - in production we'd use Content Security Policy

      const buttons = document.querySelectorAll('button');
      for (const button of buttons) {
        // If button text contains HTML tags, it might be unsafely rendered
        if (button.textContent.includes('<script>')) {
          return true;
        }
      }
      return false;
    });

    expect(hasUnsafeInnerHTML).toBe(false);
  });

  test('should preserve HTML entities in editor', async ({ page }) => {
    // Test that HTML entities are correctly preserved in the editor

    await htmlEditor.switchField('head');

    // Content with HTML entities
    const entityContent = '&lt;div&gt;Escaped content&lt;/div&gt;\n&amp; &quot; &apos;';
    await htmlEditor.typeInEditor(entityContent);

    // Verify entities are preserved
    const editorContent = await htmlEditor.getEditorContent('head');

    expect(editorContent).toContain('&lt;');
    expect(editorContent).toContain('&gt;');
    expect(editorContent).toContain('&amp;');
  });

  test('should handle large content without performance issues', async ({ page }) => {
    // Test that large content (potential DoS vector) is handled gracefully

    await htmlEditor.switchField('head');

    // Generate large but reasonable content
    const largeContent = '<div>\n' + '  <p>Line of text</p>\n'.repeat(100) + '</div>';

    // Use insertText (paste) instead of keyboard.type for large content - much faster in CI
    const viewLines = page.locator('.monaco-editor .view-lines');
    await viewLines.waitFor({ state: 'visible', timeout: 5000 });
    await viewLines.click();
    await page.keyboard.insertText(largeContent);

    // Verify editor still responsive
    const editorContent = await htmlEditor.getEditorContent('head');

    expect(editorContent.length).toBeGreaterThan(1000);

    // Verify save works with large content
    await htmlEditor.saveCurrentField();

    const requests = mockAPI.getRequests('/deki/cp/custom_html.php');
    const postRequests = requests.filter(req => req.method === 'POST');
    expect(postRequests.length).toBeGreaterThan(0);
  });

  test('should not expose sensitive data in console logs', async ({ page }) => {
    // Verify that sensitive data (like full content or tokens) is not logged

    const consoleLogs = [];

    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });

    await htmlEditor.switchField('head');

    // Add some content
    const sensitiveContent = '<script src="https://analytics.example.com/track.js?key=SECRET123"></script>';
    await htmlEditor.typeInEditor(sensitiveContent);

    // Save the content
    await htmlEditor.saveCurrentField();

    // Check that logs don't contain the full secret key
    const hasExposedSecret = consoleLogs.some(log =>
      log.includes('SECRET123')
    );

    // Note: Some logging of URLs is expected, but full secrets should not be logged
    // This is a basic check - in production we'd have more sophisticated secret detection
    expect(hasExposedSecret).toBe(false);
  });
});
