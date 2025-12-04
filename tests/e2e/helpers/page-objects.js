// Platform detection
const isMac = process.platform === 'darwin';
const modifier = isMac ? 'Meta' : 'Control';

/**
 * Page object for CXone Expert Enhancements
 */
export class CXoneExpertPage {
  constructor(page) {
    this.page = page;
  }

  /**
   * Open the toolkit overlay
   */
  async openToolkit() {
    const toggle = this.page.locator('#expert-enhancements-toggle').last();
    await toggle.waitFor({ state: 'visible', timeout: 10000 });
    await toggle.click({ force: true });
    await this.page.waitForSelector('#expert-enhancements-overlay', { state: 'visible', timeout: 10000 });
  }

  /**
   * Close the toolkit overlay (minimize)
   */
  async closeToolkit() {
    // Find minimize button in header-buttons
    await this.page.click('#expert-enhancements-overlay-header .header-buttons button[title="Minimize"]');
    await this.page.waitForSelector('#expert-enhancements-overlay', { state: 'hidden' });
  }

  /**
   * Switch to an app
   */
  async switchApp(appName) {
    const appContainerMap = {
      'css-editor': '#css-editor-container',
      'html-editor': '#html-editor-container',
      'settings': '#settings-container'
    };

    const expectedContainer = appContainerMap[appName];
    if (!expectedContainer) {
      throw new Error(`Unknown app: ${appName}`);
    }

    // Wait for switcher and option to exist
    await this.page.waitForSelector('#app-switcher', { state: 'visible', timeout: 5000 });
    await this.page.waitForSelector(`#app-switcher option[value="${appName}"]`, { state: 'attached', timeout: 5000 });

    // Ensure AppManager is initialized so change events will be handled
    await this.page.waitForFunction(
      (expectedAppId) => {
        const appManager = window.AppManager;
        if (!appManager || typeof appManager.getApps !== 'function') return false;
        return appManager.getApps().some(app => app.id === expectedAppId);
      },
      appName,
      { timeout: 5000 }
    ).catch(() => {});

    // Use native selectOption for determinism
    await this.page.selectOption('#app-switcher', appName);

    // Wait for container to be visible
    await this.page.waitForSelector(expectedContainer, { state: 'visible', timeout: 5000 });

    // If AppManager is available, confirm it agrees
    await this.page.waitForFunction(
      (expectedAppId) => {
        const appManager = window.AppManager;
        if (!appManager) return false;
        const currentApp = appManager.getCurrentApp();
        return currentApp && currentApp.id === expectedAppId;
      },
      appName,
      { timeout: 5000 }
    ).catch(() => {
      // Non-fatal in dev; container visibility above is primary signal
    });

    // Wait for app container to render actual UI instead of sleeping
    await this.page.waitForFunction(
      (containerSelector) => {
        const container = document.querySelector(containerSelector);
        if (!container) return false;
        return container.childElementCount > 0;
      },
      expectedContainer,
      { timeout: 5000 }
    );
  }

  /**
   * Get current active app
   */
  async getActiveApp() {
    return await this.page.inputValue('#app-switcher');
  }
}

/**
 * Page object for CSS Editor
 */
export class CSSEditorPage {
  constructor(page) {
    this.page = page;
  }

  /**
   * Switch to a role tab
   */
  async switchRole(role) {
    const buttonSelector = `button[data-role="${role}"].toggle-btn`;
    const button = this.page.locator(buttonSelector);
    try {
      await button.waitFor({ state: 'visible', timeout: 5000 });
      await button.click();
    } catch {
      // Fallback to mobile select
      await this.page.waitForSelector('#mobile-editor-select', { state: 'visible', timeout: 5000 });
      await this.page.selectOption('#mobile-editor-select', role);
    }
    // Wait for Monaco editor to be created and rendered
    await this.page.waitForSelector(`#editor-${role} .monaco-editor`, { state: 'visible' });
  }

  /**
   * Type in the Monaco editor
   */
  async typeInEditor(text) {
    // Click in Monaco editor to focus
    const viewLines = this.page.locator('.monaco-editor .view-lines');
    await viewLines.waitFor({ state: 'visible', timeout: 5000 });
    await viewLines.click();
    // Type text
    await this.page.keyboard.type(text);
  }

  /**
   * Get editor content for a specific role
   * Monaco editors are stored in the BaseEditor instance but not exposed globally
   * Instead, we need to access through the app instance
   */
  async getEditorContent(role) {
    // Wait for editor to be ready and have content (up to 2s)
    await this.page.waitForFunction(
      (roleId) => {
        const appManager = window.AppManager;
        if (!appManager) return false;

        const currentApp = appManager.getCurrentApp();
        if (!currentApp || !currentApp._baseEditor) return false;

        const editor = currentApp._baseEditor.monacoEditors[roleId];
        return !!editor;
      },
      role,
      { timeout: 5000 }
    ).catch(() => {});

    return await this.page.evaluate((roleId) => {
      const appManager = window.AppManager;
      if (!appManager) return '';

      const currentApp = appManager.getCurrentApp();
      if (!currentApp || !currentApp._baseEditor) return '';

      const editor = currentApp._baseEditor.monacoEditors[roleId];
      if (!editor || typeof editor.getValue !== 'function') {
        return '';
      }

      return editor.getValue();
    }, role);
  }

  /**
   * Check if role is dirty (has unsaved changes)
   */
  async isRoleDirty(role) {
    // Check toggle button has dirty styling (inline styles set by base-editor.js)
    // base-editor.js sets: style.fontWeight = 'bold' and style.color = '#ff9800'
    const selector = `button[data-role="${role}"].toggle-btn`;
    const button = this.page.locator(selector);

    if (await button.count()) {
      const styles = await button.evaluate(el => ({
        inlineFontWeight: el.style.fontWeight,
        inlineColor: el.style.color
      }));

      return styles.inlineFontWeight === 'bold' &&
             (styles.inlineColor === 'rgb(255, 152, 0)' || styles.inlineColor === '#ff9800');
    }

    // Mobile view fallback - read AppManager state directly
    return await this.page.evaluate((roleId) => {
      const appManager = window.AppManager;
      const currentApp = appManager?.getCurrentApp();
      return currentApp?._baseEditor?.editorState?.[roleId]?.isDirty ?? false;
    }, role);
  }

  /**
   * Save current role (focused editor)
   */
  async saveCurrentRole() {
    await this.page.keyboard.press(`${modifier}+S`);
    // Wait for "Saving..." text to disappear from any save button
    try {
      await this.page.waitForFunction(
        () => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return !buttons.some(btn => btn.textContent.includes('Saving'));
        },
        { timeout: 5000 }
      );
    } catch {
      // Timeout is ok - save might have completed instantly
    }
  }

  /**
   * Save all roles
   */
  async saveAll() {
    await this.page.click('#save-btn');
    // Wait for save to complete (saving class removed from button)
    await this.page.waitForSelector('#save-btn:not(.saving)', { state: 'visible', timeout: 5000 });
  }

  /**
   * Format all active editors
   */
  async formatAllActive() {
    await this.page.keyboard.press(`${modifier}+Shift+F`);
    // Wait for formatting toast instead of a blind delay
    await this.page.waitForFunction(
      () => {
        const toasts = Array.from(
          document.querySelectorAll('.toast-notification, .notification, [class*="toast"]')
        );
        return toasts.some((toast) => {
          const text = toast.textContent?.toLowerCase() || '';
          return text.includes('formatted');
        });
      },
      { timeout: 10000 }
    );
  }

  /**
   * Export role CSS
   */
  async exportRole(role) {
    // Open actions dropdown for the role
    const actionsBtn = await this.page.locator(`button[data-actions-role="${role}"]`);
    await actionsBtn.click();
    // Click export option
    await this.page.click(`button[data-export-role="${role}"]`);
  }

  /**
   * Import file to role
   */
  async importFile(role, filepath) {
    // Find the hidden file input for this role
    const fileInput = await this.page.locator(`#file-input-${role}`);
    await fileInput.setInputFiles(filepath);
  }
}

/**
 * Page object for HTML Editor
 */
export class HTMLEditorPage {
  constructor(page) {
    this.page = page;
  }

  /**
   * Switch to a field tab
   */
  async switchField(field) {
    const buttonSelector = `button[data-field="${field}"].toggle-btn`;
    const button = this.page.locator(buttonSelector);
    try {
      await button.waitFor({ state: 'visible', timeout: 5000 });
      await button.click();
    } catch {
      await this.page.waitForSelector('#mobile-editor-select', { state: 'visible', timeout: 5000 });
      await this.page.selectOption('#mobile-editor-select', field);
    }
    // Wait for Monaco editor to be created and rendered
    await this.page.waitForSelector(`#editor-${field} .monaco-editor`, { state: 'visible' });
  }

  /**
   * Type in the Monaco editor
   */
  async typeInEditor(text) {
    // Click in Monaco editor to focus
    const viewLines = this.page.locator('.monaco-editor .view-lines');
    await viewLines.waitFor({ state: 'visible', timeout: 5000 });
    await viewLines.click();
    await this.page.keyboard.type(text);
  }

  /**
   * Get editor content for a specific field
   * Monaco editors are stored in the BaseEditor instance but not exposed globally
   * Instead, we need to access through the app instance
   */
  async getEditorContent(field) {
    // Wait for editor to be ready and have content (up to 2s)
    await this.page.waitForFunction(
      (fieldId) => {
        const appManager = window.AppManager;
        if (!appManager) return false;

        const currentApp = appManager.getCurrentApp();
        if (!currentApp || !currentApp._baseEditor) return false;

        const editor = currentApp._baseEditor.monacoEditors[fieldId];
        return !!editor;
      },
      field,
      { timeout: 5000 }
    ).catch(() => {});

    return await this.page.evaluate((fieldId) => {
      const appManager = window.AppManager;
      if (!appManager) return '';

      const currentApp = appManager.getCurrentApp();
      if (!currentApp || !currentApp._baseEditor) return '';

      const editor = currentApp._baseEditor.monacoEditors[fieldId];
      if (!editor || typeof editor.getValue !== 'function') {
        return '';
      }

      return editor.getValue();
    }, field);
  }

  /**
   * Check if field is dirty (has unsaved changes)
   */
  async isFieldDirty(field) {
    // Check toggle button has dirty styling (inline styles set by base-editor.js)
    // base-editor.js sets: style.fontWeight = 'bold' and style.color = '#ff9800'
    const selector = `button[data-field="${field}"].toggle-btn`;
    const button = this.page.locator(selector);

    if (await button.count()) {
      const styles = await button.evaluate(el => ({
        inlineFontWeight: el.style.fontWeight,
        inlineColor: el.style.color
      }));

      return styles.inlineFontWeight === 'bold' &&
             (styles.inlineColor === 'rgb(255, 152, 0)' || styles.inlineColor === '#ff9800');
    }

    return await this.page.evaluate((fieldId) => {
      const appManager = window.AppManager;
      const currentApp = appManager?.getCurrentApp();
      return currentApp?._baseEditor?.editorState?.[fieldId]?.isDirty ?? false;
    }, field);
  }

  /**
   * Save current field (focused editor)
   */
  async saveCurrentField() {
    await this.page.keyboard.press(`${modifier}+S`);
    // Wait for "Saving..." text to disappear from any save button
    try {
      await this.page.waitForFunction(
        () => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return !buttons.some(btn => btn.textContent.includes('Saving'));
        },
        { timeout: 5000 }
      );
    } catch {
      // Timeout is ok - save might have completed instantly
    }
  }

  /**
   * Save all fields
   */
  async saveAll() {
    await this.page.click('#save-btn');
    // Wait for save to complete (saving class removed from button)
    await this.page.waitForSelector('#save-btn:not(.saving)', { state: 'visible', timeout: 5000 });
  }
}
