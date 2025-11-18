import { test, expect } from '@playwright/test';
import { CXoneAPIMock } from '../helpers/mock-server.js';
import { CXoneExpertPage } from '../helpers/page-objects.js';
import { navigateToTestPage } from '../helpers/navigation.js';

test.describe('Overlay Drag and Resize', () => {
  let mockAPI;
  let expertPage;

  test.beforeEach(async ({ page }) => {
    mockAPI = new CXoneAPIMock(page);
    await mockAPI.enableMocking();

    expertPage = new CXoneExpertPage(page);

    await navigateToTestPage(page);
    await expertPage.openToolkit();
  });

  test('should drag overlay to new position', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial position
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const initialX = initialBox.x;
    const initialY = initialBox.y;

    // Drag overlay header by 100px right and 50px down
    const header = page.locator('#expert-enhancements-overlay-header');
    await header.hover();

    // Perform drag operation
    await page.mouse.down();
    await page.mouse.move(initialX + 100, initialY + 50);
    await page.mouse.up();

    // Wait for position to settle
    await page.waitForTimeout(300);

    // Get new position
    const newBox = await overlay.boundingBox();
    expect(newBox).not.toBeNull();

    // Verify overlay moved (with some tolerance for rounding)
    expect(Math.abs(newBox.x - initialX - 100)).toBeLessThan(5);
    expect(Math.abs(newBox.y - initialY - 50)).toBeLessThan(5);
  });

  test('should not drag when clicking on buttons', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial position
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const initialX = initialBox.x;
    const initialY = initialBox.y;

    // Try to drag from app switcher (should not move)
    const appSwitcher = page.locator('#app-switcher');
    await appSwitcher.hover();

    await page.mouse.down();
    await page.mouse.move(initialX + 100, initialY + 50);
    await page.mouse.up();

    await page.waitForTimeout(300);

    // Get new position - should be unchanged
    const newBox = await overlay.boundingBox();
    expect(newBox).not.toBeNull();

    // Verify overlay did NOT move
    expect(Math.abs(newBox.x - initialX)).toBeLessThan(5);
    expect(Math.abs(newBox.y - initialY)).toBeLessThan(5);
  });

  test('should resize overlay using right handle', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial size
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const initialWidth = initialBox.width;

    // Find and drag right resize handle
    const rightHandle = page.locator('#expert-enhancements-overlay .resize-handle-right');
    const handleBox = await rightHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    // Drag handle 100px to the right
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 100, handleBox.y + handleBox.height / 2);
    await page.mouse.up();

    await page.waitForTimeout(300);

    // Get new size
    const newBox = await overlay.boundingBox();
    expect(newBox).not.toBeNull();

    // Verify overlay width increased (with tolerance)
    expect(newBox.width).toBeGreaterThan(initialWidth + 80);
  });

  test('should resize overlay using bottom handle', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial size
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const initialHeight = initialBox.height;

    // Find and drag bottom resize handle
    const bottomHandle = page.locator('#expert-enhancements-overlay .resize-handle-bottom');
    const handleBox = await bottomHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    // Drag handle 100px down
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 100);
    await page.mouse.up();

    await page.waitForTimeout(300);

    // Get new size
    const newBox = await overlay.boundingBox();
    expect(newBox).not.toBeNull();

    // Verify overlay height increased (with tolerance)
    expect(newBox.height).toBeGreaterThan(initialHeight + 80);
  });

  test('should resize overlay using left handle', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial size and position
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const initialWidth = initialBox.width;
    const initialRight = initialBox.x + initialBox.width;

    // Find and drag left resize handle
    const leftHandle = page.locator('#expert-enhancements-overlay .resize-handle-left');
    const handleBox = await leftHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    // Drag handle 100px to the left
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 100, handleBox.y + handleBox.height / 2);
    await page.mouse.up();

    await page.waitForTimeout(300);

    // Get new size
    const newBox = await overlay.boundingBox();
    expect(newBox).not.toBeNull();

    // Left handle should increase width and move left edge
    expect(newBox.width).toBeGreaterThan(initialWidth + 80);
    // Right edge should stay roughly the same
    const newRight = newBox.x + newBox.width;
    expect(Math.abs(newRight - initialRight)).toBeLessThan(10);
  });

  test('should toggle fullscreen on double-click', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial size
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const initialWidth = initialBox.width;
    const initialHeight = initialBox.height;

    // Double-click on header to enter fullscreen
    const header = page.locator('#expert-enhancements-overlay-header');
    await header.dblclick();

    await page.waitForTimeout(500);

    // Get fullscreen size
    const fullscreenBox = await overlay.boundingBox();
    expect(fullscreenBox).not.toBeNull();

    // Verify overlay is much larger (95% of viewport)
    expect(fullscreenBox.width).toBeGreaterThan(initialWidth);
    expect(fullscreenBox.height).toBeGreaterThan(initialHeight);

    // Double-click again to exit fullscreen
    await header.dblclick();

    await page.waitForTimeout(500);

    // Get restored size
    const restoredBox = await overlay.boundingBox();
    expect(restoredBox).not.toBeNull();

    // Verify overlay returned to original size (with tolerance)
    expect(Math.abs(restoredBox.width - initialWidth)).toBeLessThan(10);
    expect(Math.abs(restoredBox.height - initialHeight)).toBeLessThan(10);
  });

  test('should use fullscreen button to toggle fullscreen', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial size
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const initialWidth = initialBox.width;
    const initialHeight = initialBox.height;

    // Click fullscreen button
    const fullscreenBtn = page.locator('button[title="Fullscreen (95%)"]');
    await fullscreenBtn.click();

    await page.waitForTimeout(500);

    // Get fullscreen size
    const fullscreenBox = await overlay.boundingBox();
    expect(fullscreenBox).not.toBeNull();

    // Verify overlay is much larger
    expect(fullscreenBox.width).toBeGreaterThan(initialWidth);
    expect(fullscreenBox.height).toBeGreaterThan(initialHeight);

    // Click again to exit fullscreen
    await fullscreenBtn.click();

    await page.waitForTimeout(500);

    // Get restored size
    const restoredBox = await overlay.boundingBox();
    expect(restoredBox).not.toBeNull();

    // Verify overlay returned to original size (with tolerance)
    expect(Math.abs(restoredBox.width - initialWidth)).toBeLessThan(10);
    expect(Math.abs(restoredBox.height - initialHeight)).toBeLessThan(10);
  });

  test('should apply preset sizes', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Click small preset button
    const smallBtn = page.locator('button[title="Small (30%)"]');
    await smallBtn.click();

    await page.waitForTimeout(300);

    const smallBox = await overlay.boundingBox();
    expect(smallBox).not.toBeNull();
    const smallWidth = smallBox.width;

    // Click medium preset button
    const mediumBtn = page.locator('button[title="Medium (50%)"]');
    await mediumBtn.click();

    await page.waitForTimeout(300);

    const mediumBox = await overlay.boundingBox();
    expect(mediumBox).not.toBeNull();

    // Medium should be larger than small
    expect(mediumBox.width).toBeGreaterThan(smallWidth);

    // Click large preset button
    const largeBtn = page.locator('button[title="Large (70%)"]');
    await largeBtn.click();

    await page.waitForTimeout(300);

    const largeBox = await overlay.boundingBox();
    expect(largeBox).not.toBeNull();

    // Large should be larger than medium
    expect(largeBox.width).toBeGreaterThan(mediumBox.width);
  });

  test('should minimize and restore overlay', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Verify overlay is visible
    await expect(overlay).toBeVisible();

    // Click minimize button
    await expertPage.closeToolkit();

    // Verify overlay is hidden
    await expect(overlay).toBeHidden();

    // Click toggle button to restore
    await expertPage.openToolkit();

    // Verify overlay is visible again
    await expect(overlay).toBeVisible();
  });

  test('should not double-click trigger fullscreen when clicking buttons', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial size
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const initialWidth = initialBox.width;
    const initialHeight = initialBox.height;

    // Double-click on app switcher (should not toggle fullscreen)
    const appSwitcher = page.locator('#app-switcher');
    await appSwitcher.dblclick();

    await page.waitForTimeout(500);

    // Get size after double-click
    const afterBox = await overlay.boundingBox();
    expect(afterBox).not.toBeNull();

    // Verify overlay size did NOT change significantly
    expect(Math.abs(afterBox.width - initialWidth)).toBeLessThan(10);
    expect(Math.abs(afterBox.height - initialHeight)).toBeLessThan(10);
  });
});
