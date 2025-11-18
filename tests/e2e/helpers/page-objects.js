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
    await this.page.click('#expert-enhancements-toggle');
    await this.page.waitForSelector('#expert-enhancements-overlay', { state: 'visible' });
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

    // Retry logic to handle race conditions between initial app load and app switching
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Trigger the app switch
      await this.page.evaluate((appValue) => {
        const switcher = document.querySelector('#app-switcher');
        if (switcher) {
          switcher.value = appValue;
          switcher.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, appName);

      // Wait for AppManager to switch to the correct app
      // This is the most reliable check since we exposed AppManager to window in DEV mode
      try {
        await this.page.waitForFunction(
          (expectedAppId) => {
            // Check app switcher dropdown matches
            const switcher = document.querySelector('#app-switcher');
            if (!switcher || switcher.value !== expectedAppId) return false;

            // Check AppManager reports the correct current app
            const appManager = window.AppManager;
            if (!appManager) return false;

            const currentApp = appManager.getCurrentApp();
            return currentApp && currentApp.id === expectedAppId;
          },
          appName,
          { timeout: 5000 }
        );

        // Verify the container is also visible (belt and suspenders)
        const containerVisible = await this.page.evaluate((containerSelector) => {
          const container = document.querySelector(containerSelector);
          if (!container) return false;
          const style = window.getComputedStyle(container);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }, expectedContainer);

        if (containerVisible) {
          // Success! Both AppManager and DOM confirm correct app is loaded
          // Wait a bit to ensure no other app is about to mount
          await this.page.waitForTimeout(1000);

          // CRITICAL: Re-verify the app is still loaded (catch time-of-check-to-time-of-use race)
          const stillCorrectApp = await this.page.evaluate((expectedAppId) => {
            const appManager = window.AppManager;
            if (!appManager) return false;
            const currentApp = appManager.getCurrentApp();
            return currentApp && currentApp.id === expectedAppId;
          }, appName);

          if (stillCorrectApp) {
            return; // Confirmed stable
          }

          // App changed after our check - retry
          console.log(`[switchApp] App changed after verification, retrying...`);
        }
      } catch (e) {
        // waitForFunction timed out - wrong app loaded
      }

      // Wrong app loaded - retry unless this was the last attempt
      if (attempt < maxRetries) {
        console.log(`[switchApp] Wrong app loaded, retrying (attempt ${attempt + 1}/${maxRetries})...`);
        await this.page.waitForTimeout(1000); // Wait before retry
      }
    }

    // If we get here, all retries failed
    throw new Error(`Failed to switch to ${appName} after ${maxRetries} attempts - race condition persists`);
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
    await this.page.click(`button[data-role="${role}"].toggle-btn`);
    // Wait for Monaco editor to be created and rendered
    await this.page.waitForSelector(`#editor-${role} .monaco-editor`, { state: 'visible' });
  }

  /**
   * Type in the Monaco editor
   */
  async typeInEditor(text) {
    // Click in Monaco editor to focus
    await this.page.click('.monaco-editor .view-lines');
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
        return editor && editor.getValue();
      },
      role,
      { timeout: 2000 }
    ).catch(() => {
      // If timeout, proceed anyway - editor might be empty legitimately
    });

    return await this.page.evaluate((roleId) => {
      // Access through AppManager -> CSSEditorApp -> BaseEditor -> monacoEditors
      const appManager = window.AppManager;
      if (!appManager) return '';

      const currentApp = appManager.getCurrentApp();
      if (!currentApp || !currentApp._baseEditor) return '';

      const editor = currentApp._baseEditor.monacoEditors[roleId];
      return editor ? editor.getValue() : '';
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

    const styles = await button.evaluate(el => ({
      inlineFontWeight: el.style.fontWeight,
      inlineColor: el.style.color
    }));

    return styles.inlineFontWeight === 'bold' &&
           (styles.inlineColor === 'rgb(255, 152, 0)' || styles.inlineColor === '#ff9800');
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
    // Wait for formatting to complete
    await this.page.waitForTimeout(1000);
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
    await this.page.click(`button[data-field="${field}"].toggle-btn`);
    // Wait for Monaco editor to be created and rendered
    await this.page.waitForSelector(`#editor-${field} .monaco-editor`, { state: 'visible' });
  }

  /**
   * Type in the Monaco editor
   */
  async typeInEditor(text) {
    // Click in Monaco editor to focus
    await this.page.click('.monaco-editor .view-lines');
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
        return editor && editor.getValue();
      },
      field,
      { timeout: 2000 }
    ).catch(() => {
      // If timeout, proceed anyway - editor might be empty legitimately
    });

    return await this.page.evaluate((fieldId) => {
      // Access through AppManager -> HTMLEditorApp -> BaseEditor -> monacoEditors
      const appManager = window.AppManager;
      if (!appManager) return '';

      const currentApp = appManager.getCurrentApp();
      if (!currentApp || !currentApp._baseEditor) return '';

      const editor = currentApp._baseEditor.monacoEditors[fieldId];
      return editor ? editor.getValue() : '';
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

    const styles = await button.evaluate(el => ({
      inlineFontWeight: el.style.fontWeight,
      inlineColor: el.style.color
    }));

    return styles.inlineFontWeight === 'bold' &&
           (styles.inlineColor === 'rgb(255, 152, 0)' || styles.inlineColor === '#ff9800');
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
