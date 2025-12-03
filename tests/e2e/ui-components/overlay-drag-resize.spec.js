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

    // Start from a predictable size so resize assertions aren't clamped by viewport
    await page.evaluate(() => window.__ENHANCEMENTS_OVERLAY_TEST_API__.applyPresetSize('small'));
    await page.waitForTimeout(200);
  });

  test('should drag overlay to new position', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial position
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const initialX = initialBox.x;
    const initialY = initialBox.y;

    // Drag overlay header by 100px right and 50px down via DOM events for cross-browser reliability
    await page.evaluate(({ dx, dy }) => {
      const header = document.getElementById('expert-enhancements-overlay-header');
      const rect = header.getBoundingClientRect();
      const startX = rect.x + rect.width / 2;
      const startY = rect.y + rect.height / 2;
      header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: startX, clientY: startY, buttons: 1 }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: startX + dx, clientY: startY + dy, buttons: 1 }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, { dx: 100, dy: 50 });

    // Wait for position to update (check that position has changed)
    await expect(async () => {
      const box = await overlay.boundingBox();
      expect(Math.abs(box.x - initialX)).toBeGreaterThan(40);
      expect(Math.abs(box.y - initialY)).toBeGreaterThan(20);
    }).toPass({ timeout: 2000 });

    // Get new position
    const newBox = await overlay.boundingBox();
    expect(newBox).not.toBeNull();

    // Verify overlay moved roughly in expected direction
    expect(Math.abs(newBox.x - initialX)).toBeGreaterThan(40);
    expect(Math.abs(newBox.y - initialY)).toBeGreaterThan(20);
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

    // Wait a moment for any potential movement to occur
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
    const rightHandle = page.locator('#expert-enhancements-overlay .enhancements-resize-handle.right');
    const handleBox = await rightHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    // Drag handle inward to reduce width (safer given viewport max width cap)
    const handleCenterX = handleBox.x + handleBox.width / 2;
    const handleCenterY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(handleCenterX, handleCenterY);
    await page.mouse.down();
    await page.mouse.move(handleCenterX - 120, handleCenterY, { steps: 8 });
    await page.mouse.up();

    // Wait for width to decrease
    await expect(async () => {
      const box = await overlay.boundingBox();
      expect(box.width).toBeLessThan(initialWidth - 60);
    }).toPass({ timeout: 2000 });

    // Get new size
    const newBox = await overlay.boundingBox();
    expect(newBox).not.toBeNull();

    // Verify overlay width decreased (with tolerance)
    expect(newBox.width).toBeLessThan(initialWidth - 60);
  });

  test('should resize overlay using bottom handle', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial size
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const initialHeight = initialBox.height;

    // Find and drag bottom resize handle
    const bottomHandle = page.locator('#expert-enhancements-overlay .enhancements-resize-handle.bottom');
    const handleBox = await bottomHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    // Drag handle upward to reduce height (overlay starts near max height)
    const centerX = handleBox.x + handleBox.width / 2;
    const centerY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY - 120, { steps: 8 });
    await page.mouse.up();

    // Wait for height to decrease
    await expect(async () => {
      const box = await overlay.boundingBox();
      expect(box.height).toBeLessThan(initialHeight - 20);
    }).toPass({ timeout: 2000 });

    // Get new size
    const newBox = await overlay.boundingBox();
    expect(newBox).not.toBeNull();

    // Verify overlay height decreased (with tolerance)
    expect(newBox.height).toBeLessThan(initialHeight - 20);
  });

  test('should resize overlay using left handle', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial size and position
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const initialWidth = initialBox.width;
    const initialLeft = initialBox.x;

    // Find and drag left resize handle
    const leftHandle = page.locator('#expert-enhancements-overlay .enhancements-resize-handle.left');
    const handleBox = await leftHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    // Drag handle inward to shrink width
    const centerX = handleBox.x + handleBox.width / 2;
    const centerY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 120, centerY, { steps: 8 });
    await page.mouse.up();

    // Wait for width to decrease and left edge to move right
    await expect(async () => {
      const box = await overlay.boundingBox();
      expect(box.width).toBeLessThan(initialWidth - 20);
      expect(box.x).toBeGreaterThan(initialLeft + 10);
    }).toPass({ timeout: 2000 });

    // Get new size
    const newBox = await overlay.boundingBox();
    expect(newBox).not.toBeNull();

    // Left handle should shrink width and move left edge rightwards
    expect(newBox.width).toBeLessThan(initialWidth - 20);
    expect(newBox.x).toBeGreaterThan(initialLeft + 10);
  });

  test('should toggle fullscreen on double-click', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    // Get initial size
    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    const fullscreenBtn = page.locator('button[title="Fullscreen (95%)"]');
    const initialWidth = initialBox.width;
    const initialHeight = initialBox.height;

    // Double-click on header to toggle fullscreen mode on
    await page.evaluate(() => {
      const header = document.getElementById('expert-enhancements-overlay-header');
      header.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    // Fullscreen should at least maintain current size (may already be at max)
    const fullscreenBox = await overlay.boundingBox();
    const viewport = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
    expect(fullscreenBox).not.toBeNull();
    expect(fullscreenBox.width).toBeGreaterThan(viewport.w * 0.8);
    expect(fullscreenBox.height).toBeGreaterThan(viewport.h * 0.8);

    // Double-click again to exit fullscreen
    await page.evaluate(() => {
      const header = document.getElementById('expert-enhancements-overlay-header');
      header.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    // Wait for overlay to return close to original size
    await expect(async () => {
      const box = await overlay.boundingBox();
      expect(Math.abs(box.width - initialWidth)).toBeLessThan(10);
      expect(Math.abs(box.height - initialHeight)).toBeLessThan(10);
    }).toPass({ timeout: 2000 });
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
    await expect(fullscreenBtn).toHaveClass(/fullscreen-active/);

    // Fullscreen should utilize most of the viewport
    const fullscreenBox = await overlay.boundingBox();
    const viewport = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
    expect(fullscreenBox.width).toBeGreaterThan(viewport.w * 0.8);
    expect(fullscreenBox.height).toBeGreaterThan(viewport.h * 0.8);

    // Click again to exit fullscreen
    await fullscreenBtn.click();
    await expect(fullscreenBtn).not.toHaveClass(/fullscreen-active/);

    // Wait for overlay to return close to original size
    await expect(async () => {
      const box = await overlay.boundingBox();
      expect(Math.abs(box.width - initialWidth)).toBeLessThan(10);
      expect(Math.abs(box.height - initialHeight)).toBeLessThan(10);
    }).toPass({ timeout: 2000 });
  });

  test('should apply preset sizes', async ({ page }) => {
    const overlay = page.locator('#expert-enhancements-overlay');

    const initialBox = await overlay.boundingBox();
    expect(initialBox).not.toBeNull();

    // Apply small preset via exposed test API
    await page.evaluate(() => window.__ENHANCEMENTS_OVERLAY_TEST_API__.applyPresetSize('small'));
    await page.waitForTimeout(300);

    const smallBox = await overlay.boundingBox();
    expect(smallBox).not.toBeNull();
    expect(smallBox.width).toBeLessThanOrEqual(initialBox.width);
    expect(smallBox.height).toBeLessThanOrEqual(initialBox.height);

    // Apply split-left preset
    await page.evaluate(() => window.__ENHANCEMENTS_OVERLAY_TEST_API__.applyPresetSize('split-left'));
    await page.waitForTimeout(300);

    const splitLeftBox = await overlay.boundingBox();
    expect(splitLeftBox).not.toBeNull();
    expect(splitLeftBox.width).toBeLessThanOrEqual(initialBox.width);
    expect(splitLeftBox.x).toBeLessThanOrEqual(initialBox.x + 150);

    // Apply split-right preset
    await page.evaluate(() => window.__ENHANCEMENTS_OVERLAY_TEST_API__.applyPresetSize('split-right'));
    await page.waitForTimeout(300);

    const splitRightBox = await overlay.boundingBox();
    expect(splitRightBox).not.toBeNull();
    expect(splitRightBox.width).toBeLessThanOrEqual(initialBox.width);
    expect(splitRightBox.x).toBeGreaterThanOrEqual(initialBox.x);
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

    // Wait a moment to ensure no size change occurs
    await page.waitForTimeout(300);

    // Get size after double-click
    const afterBox = await overlay.boundingBox();
    expect(afterBox).not.toBeNull();

    // Verify overlay size did NOT change significantly
    expect(Math.abs(afterBox.width - initialWidth)).toBeLessThan(10);
    expect(Math.abs(afterBox.height - initialHeight)).toBeLessThan(10);
  });
});
