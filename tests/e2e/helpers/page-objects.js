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
    await this.page.selectOption('#app-switcher', appName);
    // Wait for app to fully mount and initialize
    await this.page.waitForFunction(
      () => document.querySelector('#expert-enhancements-overlay-content')?.children.length > 0,
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
    const button = this.page.locator(`button[data-role="${role}"].toggle-btn`);

    // Wait for dirty state to be applied (condition-based, up to 2s)
    // base-editor.js sets: style.fontWeight = 'bold' and style.color = '#ff9800'
    try {
      await button.waitForFunction(
        el => el.style.fontWeight === 'bold' &&
              (el.style.color === '#ff9800' || el.style.color === 'rgb(255, 152, 0)'),
        { timeout: 2000 }
      );
      return true;
    } catch {
      // If timeout, check current state (may already be clean or never became dirty)
      const styles = await button.evaluate(el => ({
        inlineFontWeight: el.style.fontWeight,
        inlineColor: el.style.color
      }));

      return styles.inlineFontWeight === 'bold' &&
             (styles.inlineColor === 'rgb(255, 152, 0)' || styles.inlineColor === '#ff9800');
    }
  }

  /**
   * Save current role (focused editor)
   */
  async saveCurrentRole() {
    await this.page.keyboard.press(`${modifier}+S`);
    // Wait for save to complete (saving class removed from button)
    await this.page.waitForSelector('#save-btn:not(.saving)', { state: 'visible', timeout: 5000 });
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
    const button = this.page.locator(`button[data-field="${field}"].toggle-btn`);

    // Wait for dirty state to be applied (condition-based, up to 2s)
    // base-editor.js sets: style.fontWeight = 'bold' and style.color = '#ff9800'
    try {
      await button.waitForFunction(
        el => el.style.fontWeight === 'bold' &&
              (el.style.color === '#ff9800' || el.style.color === 'rgb(255, 152, 0)'),
        { timeout: 2000 }
      );
      return true;
    } catch {
      // If timeout, check current state (may already be clean or never became dirty)
      const styles = await button.evaluate(el => ({
        inlineFontWeight: el.style.fontWeight,
        inlineColor: el.style.color
      }));

      return styles.inlineFontWeight === 'bold' &&
             (styles.inlineColor === 'rgb(255, 152, 0)' || styles.inlineColor === '#ff9800');
    }
  }

  /**
   * Save current field (focused editor)
   */
  async saveCurrentField() {
    await this.page.keyboard.press(`${modifier}+S`);
    // Wait for save to complete (saving class removed from button)
    await this.page.waitForSelector('#save-btn:not(.saving)', { state: 'visible', timeout: 5000 });
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
