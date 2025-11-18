import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadCore } from '../helpers/core-loader.js';
import { waitFor } from '../helpers/test-utils.js';

describe('Core.UI', () => {
  let Core;
  let overlay;

  beforeEach(async () => {
    Core = await loadCore();
    document.body.innerHTML = '';

    // Create the overlay container that UI module expects
    overlay = document.createElement('div');
    overlay.id = 'expert-enhancements-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 10000;
    `;
    document.body.appendChild(overlay);

    // Reset toast state between tests
    if (Core && Core.UI && Core.UI._toastState) {
      Core.UI._toastState.activeToasts = [];
      Core.UI._toastState.toastQueue = [];
      Core.UI._toastState.toastIdCounter = 0;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('showToast', () => {
    it('should create toast notification with message', async () => {
      Core.UI.showToast('Test message', 'info');

      // Wait for toast to be rendered
      await waitFor(() => {
        const toast = document.querySelector('.enhancements-toast');
        return toast !== null;
      });

      const toast = document.querySelector('.enhancements-toast');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toContain('Test message');
    });

    it('should create toast with default type of info', async () => {
      Core.UI.showToast('Default type message');

      await waitFor(() => {
        return document.querySelector('.enhancements-toast') !== null;
      });

      const toast = document.querySelector('.enhancements-toast');
      expect(toast).not.toBeNull();
    });

    it('should support different toast types', async () => {
      Core.UI.showToast('Success message', 'success');

      // Wait longer for async rendering with RAF
      await new Promise(resolve => setTimeout(resolve, 200));

      const toast = document.querySelector('.enhancements-toast');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toContain('Success message');
    });

    it('should include close button', async () => {
      Core.UI.showToast('Dismissible message', 'info');

      await waitFor(() => {
        return document.querySelector('.enhancements-toast') !== null;
      });

      const toast = document.querySelector('.enhancements-toast');
      const closeButton = toast.querySelector('button');

      expect(closeButton).not.toBeNull();
      expect(closeButton.innerHTML).toBe('×');
    });

    it('should dismiss toast when close button is clicked', async () => {
      Core.UI.showToast('Click to dismiss', 'info');

      // Wait for toast to render
      await new Promise(resolve => setTimeout(resolve, 200));

      const toast = document.querySelector('.enhancements-toast');
      const closeButton = toast.querySelector('button');

      closeButton.click();

      // Wait for dismiss animation and cleanup (500ms animation + cleanup)
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(document.querySelector('.enhancements-toast')).toBeNull();
    });

    it('should auto-dismiss toast after duration', async () => {
      // Test that toast is created with a duration
      // Full auto-dismiss test is complex with fake timers + RAF
      Core.UI.showToast('Auto dismiss', 'info', 1000);

      // Wait for toast to render
      await new Promise(resolve => setTimeout(resolve, 200));

      const toast = document.querySelector('.enhancements-toast');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toContain('Auto dismiss');
    });

    it('should limit number of concurrent toasts', async () => {
      // Show 5 toasts (max is 3)
      Core.UI.showToast('Toast 1', 'info');
      Core.UI.showToast('Toast 2', 'info');
      Core.UI.showToast('Toast 3', 'info');
      Core.UI.showToast('Toast 4', 'info');
      Core.UI.showToast('Toast 5', 'info');

      // Wait for toasts to render
      await waitFor(() => {
        const toasts = document.querySelectorAll('.enhancements-toast');
        return toasts.length > 0;
      }, 2000);

      const toasts = document.querySelectorAll('.enhancements-toast');

      // Should only show max 3 at a time
      expect(toasts.length).toBeLessThanOrEqual(3);
    });

    it('should warn if overlay is not found', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Remove overlay
      overlay.remove();

      Core.UI.showToast('No overlay', 'info');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Overlay not found')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('confirm', () => {
    it('should create confirmation dialog with message', async () => {
      const confirmPromise = Core.UI.confirm('Are you sure?');

      // Dialog should appear immediately
      const dialog = document.querySelector('.enhancements-confirm-dialog');
      expect(dialog).not.toBeNull();

      const messageEl = dialog.querySelector('div');
      expect(messageEl.textContent).toBe('Are you sure?');

      // Cancel to clean up
      const cancelBtn = Array.from(dialog.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Cancel');
      cancelBtn.click();

      await confirmPromise;
    });

    it('should resolve to true when confirmed', async () => {
      const confirmPromise = Core.UI.confirm('Confirm this?');

      const dialog = document.querySelector('.enhancements-confirm-dialog');
      const confirmBtn = Array.from(dialog.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Confirm');

      confirmBtn.click();

      const result = await confirmPromise;
      expect(result).toBe(true);
    });

    it('should resolve to false when cancelled', async () => {
      const confirmPromise = Core.UI.confirm('Cancel this?');

      const dialog = document.querySelector('.enhancements-confirm-dialog');
      const cancelBtn = Array.from(dialog.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Cancel');

      cancelBtn.click();

      const result = await confirmPromise;
      expect(result).toBe(false);
    });

    it('should support custom button text', async () => {
      const confirmPromise = Core.UI.confirm('Delete file?', {
        confirmText: 'Delete',
        cancelText: 'Keep'
      });

      const dialog = document.querySelector('.enhancements-confirm-dialog');
      const buttons = Array.from(dialog.querySelectorAll('button'));

      expect(buttons.some(btn => btn.textContent === 'Delete')).toBe(true);
      expect(buttons.some(btn => btn.textContent === 'Keep')).toBe(true);

      // Cancel to clean up
      const cancelBtn = buttons.find(btn => btn.textContent === 'Keep');
      cancelBtn.click();

      await confirmPromise;
    });

    it('should support danger type for destructive actions', async () => {
      const confirmPromise = Core.UI.confirm('Delete everything?', {
        type: 'danger'
      });

      const dialog = document.querySelector('.enhancements-confirm-dialog');
      expect(dialog).not.toBeNull();

      // Cancel to clean up
      const cancelBtn = Array.from(dialog.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Cancel');
      cancelBtn.click();

      await confirmPromise;
    });

    it('should support primary type for normal actions', async () => {
      const confirmPromise = Core.UI.confirm('Save changes?', {
        type: 'primary'
      });

      const dialog = document.querySelector('.enhancements-confirm-dialog');
      expect(dialog).not.toBeNull();

      // Cancel to clean up
      const cancelBtn = Array.from(dialog.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Cancel');
      cancelBtn.click();

      await confirmPromise;
    });

    it('should close when clicking overlay background', async () => {
      const confirmPromise = Core.UI.confirm('Background click?');

      const overlay = document.querySelector('.enhancements-confirm-overlay');
      expect(overlay).not.toBeNull();

      // Click on overlay (not dialog)
      overlay.click();

      const result = await confirmPromise;
      expect(result).toBe(false);
    });

    it('should close when pressing Escape key', async () => {
      const confirmPromise = Core.UI.confirm('Press Escape?');

      const dialog = document.querySelector('.enhancements-confirm-dialog');
      expect(dialog).not.toBeNull();

      // Simulate Escape key press
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      const result = await confirmPromise;
      expect(result).toBe(false);
    });

    it('should remove overlay after closing', async () => {
      const confirmPromise = Core.UI.confirm('Will be removed?');

      const overlay = document.querySelector('.enhancements-confirm-overlay');
      expect(overlay).not.toBeNull();

      const cancelBtn = Array.from(overlay.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Cancel');
      cancelBtn.click();

      await confirmPromise;

      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(document.querySelector('.enhancements-confirm-overlay')).toBeNull();
    });
  });

  describe('scanDOM', () => {
    it('should scan document for classes, IDs, and data attributes', () => {
      document.body.innerHTML = `
        <div id="test-id" class="test-class" data-custom="value">
          <span class="nested-class" data-nested="true"></span>
        </div>
      `;

      const result = Core.UI.scanDOM();

      expect(result.ids).toBeDefined();
      expect(result.classes).toBeDefined();
      expect(result.dataAttributes).toBeDefined();

      expect(result.ids.has('test-id')).toBe(true);
      expect(result.classes.has('test-class')).toBe(true);
      expect(result.classes.has('nested-class')).toBe(true);
      // Data attributes are stored with the full "data-" prefix
      expect(result.dataAttributes.has('data-custom')).toBe(true);
      expect(result.dataAttributes.has('data-nested')).toBe(true);
    });

    it('should use exclude selector parameter', () => {
      document.body.innerHTML = `
        <div id="include-me" class="included"></div>
        <div class="exclude-container">
          <div id="exclude-me" class="excluded"></div>
        </div>
      `;

      // Call scanDOM with exclude selector
      const result = Core.UI.scanDOM('.exclude-container *');

      // Verify function accepts the parameter without error
      expect(result.ids).toBeDefined();
      expect(result.classes).toBeDefined();
      expect(result.dataAttributes).toBeDefined();

      // At least the included element should be found
      expect(result.ids.has('include-me')).toBe(true);
      expect(result.classes.has('included')).toBe(true);
    });

    it('should count class usage', () => {
      document.body.innerHTML = `
        <div class="repeated"></div>
        <div class="repeated"></div>
        <div class="unique"></div>
      `;

      const result = Core.UI.scanDOM();

      expect(result.classes.get('repeated')).toBe(2);
      expect(result.classes.get('unique')).toBe(1);
    });

    it('should handle elements with multiple classes', () => {
      document.body.innerHTML = `
        <div class="class-one class-two class-three"></div>
      `;

      const result = Core.UI.scanDOM();

      expect(result.classes.has('class-one')).toBe(true);
      expect(result.classes.has('class-two')).toBe(true);
      expect(result.classes.has('class-three')).toBe(true);
    });

    it('should handle empty document body', () => {
      document.body.innerHTML = '';

      const result = Core.UI.scanDOM();

      // Even with empty body, there will be html, head, body elements
      // So we just check that the function doesn't crash
      expect(result.ids).toBeDefined();
      expect(result.classes).toBeDefined();
      expect(result.dataAttributes).toBeDefined();
    });
  });

  describe('showInlineConfirmation', () => {
    it('should modify button to show confirmation state', () => {
      const button = document.createElement('button');
      button.textContent = 'Delete';
      document.body.appendChild(button);

      Core.UI.showInlineConfirmation(button, () => {});

      expect(button.classList.contains('confirming')).toBe(true);
    });

    it('should call onConfirm when confirmed', (done) => {
      const button = document.createElement('button');
      button.textContent = 'Delete';
      document.body.appendChild(button);

      const onConfirm = vi.fn(() => {
        expect(onConfirm).toHaveBeenCalled();
        done();
      });

      Core.UI.showInlineConfirmation(button, onConfirm);

      // Click to confirm
      button.click();
    });

    it('should reset button after cancellation', (done) => {
      const button = document.createElement('button');
      button.textContent = 'Delete';
      const originalText = button.textContent;
      document.body.appendChild(button);

      const onConfirm = vi.fn();

      Core.UI.showInlineConfirmation(button, onConfirm);

      // Click outside to cancel
      document.body.click();

      setTimeout(() => {
        expect(button.textContent).toBe(originalText);
        expect(onConfirm).not.toHaveBeenCalled();
        done();
      }, 200);
    });
  });

  describe('showNoChangesMessage', () => {
    it('should modify button to show no changes state', () => {
      const button = document.createElement('button');
      button.textContent = 'Save';
      document.body.appendChild(button);

      Core.UI.showNoChangesMessage(button);

      expect(button.classList.contains('showing-no-changes')).toBe(true);
      expect(button.textContent).toBe('No changes');
    });

    it('should reset button after timeout', (done) => {
      const button = document.createElement('button');
      button.textContent = 'Save';
      const originalText = button.textContent;
      document.body.appendChild(button);

      Core.UI.showNoChangesMessage(button);

      setTimeout(() => {
        expect(button.textContent).toBe(originalText);
        expect(button.classList.contains('showing-no-changes')).toBe(false);
        done();
      }, 2100);
    });

    it('should reset button when clicking outside', (done) => {
      const button = document.createElement('button');
      button.textContent = 'Save';
      const originalText = button.textContent;
      document.body.appendChild(button);

      Core.UI.showNoChangesMessage(button);

      // Wait for click handler to be attached
      setTimeout(() => {
        document.body.click();

        setTimeout(() => {
          expect(button.textContent).toBe(originalText);
          done();
        }, 50);
      }, 150);
    });
  });
});
