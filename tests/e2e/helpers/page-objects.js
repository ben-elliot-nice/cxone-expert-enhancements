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
    await this.page.click('[data-testid="toggle-button"]');
    await this.page.waitForSelector('.overlay-container', { state: 'visible' });
  }

  /**
   * Close the toolkit overlay
   */
  async closeToolkit() {
    await this.page.click('.overlay-header .close-button');
    await this.page.waitForSelector('.overlay-container', { state: 'hidden' });
  }

  /**
   * Switch to an app
   */
  async switchApp(appName) {
    await this.page.selectOption('[data-testid="app-switcher"]', appName);
    await this.page.waitForTimeout(500); // Wait for app to load
  }

  /**
   * Get current active app
   */
  async getActiveApp() {
    return await this.page.inputValue('[data-testid="app-switcher"]');
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
    await this.page.click(`[data-testid="tab-${role}"]`);
    await this.page.waitForTimeout(300);
  }

  /**
   * Type in the Monaco editor
   */
  async typeInEditor(text) {
    // Click in Monaco editor
    await this.page.click('.monaco-editor');
    // Type text
    await this.page.keyboard.type(text);
  }

  /**
   * Get editor content
   */
  async getEditorContent() {
    return await this.page.evaluate(() => {
      // Access Monaco editor instance
      // This depends on how the editor is exposed
      const editor = window.monacoEditorInstance;
      return editor ? editor.getValue() : '';
    });
  }

  /**
   * Check if tab is dirty
   */
  async isTabDirty(role) {
    const tab = await this.page.locator(`[data-testid="tab-${role}"]`);
    const text = await tab.textContent();
    return text.includes('*');
  }

  /**
   * Save current role
   */
  async saveCurrentRole() {
    await this.page.keyboard.press('Control+Shift+S');
    await this.page.waitForTimeout(500);
  }

  /**
   * Save all roles
   */
  async saveAll() {
    await this.page.keyboard.press('Control+S');
    await this.page.waitForTimeout(500);
  }

  /**
   * Format current role
   */
  async formatCurrent() {
    await this.page.keyboard.press('Control+Shift+F');
    await this.page.waitForTimeout(500);
  }

  /**
   * Export current role
   */
  async exportRole(role) {
    await this.page.click(`[data-testid="export-${role}"]`);
  }

  /**
   * Import file to role
   */
  async importFile(role, filepath) {
    await this.page.setInputFiles(`[data-testid="import-${role}"]`, filepath);
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
    await this.page.click(`[data-testid="tab-${field}"]`);
    await this.page.waitForTimeout(300);
  }

  /**
   * Type in the Monaco editor
   */
  async typeInEditor(text) {
    await this.page.click('.monaco-editor');
    await this.page.keyboard.type(text);
  }

  /**
   * Get editor content
   */
  async getEditorContent() {
    return await this.page.evaluate(() => {
      const editor = window.monacoEditorInstance;
      return editor ? editor.getValue() : '';
    });
  }

  /**
   * Check if field is dirty
   */
  async isFieldDirty(field) {
    const tab = await this.page.locator(`[data-testid="tab-${field}"]`);
    const text = await tab.textContent();
    return text.includes('*');
  }

  /**
   * Save current field
   */
  async saveCurrentField() {
    await this.page.keyboard.press('Control+Shift+S');
    await this.page.waitForTimeout(500);
  }

  /**
   * Save all fields
   */
  async saveAll() {
    await this.page.keyboard.press('Control+S');
    await this.page.waitForTimeout(500);
  }
}
