import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockLocalStorage } from '../helpers/test-utils.js';
import { loadCore } from '../helpers/core-loader.js';

describe('Core.Config', () => {
  let Core;
  let mockLocalStorage;

  beforeEach(async () => {
    mockLocalStorage = createMockLocalStorage();
    global.localStorage = mockLocalStorage;
    Core = await loadCore();
    // Reset all user settings to start with a clean slate
    Core.Config.resetAllUserSettings();
  });

  describe('get', () => {
    it('should retrieve config value by key', () => {
      const result = Core.Config.get('editor.fontSize');

      expect(result).toBeDefined();
      expect(typeof result).toBe('number');
    });

    it('should return undefined for non-existent key', () => {
      const result = Core.Config.get('nonExistent.key');

      expect(result).toBeUndefined();
    });

    it('should support nested config keys', () => {
      const result = Core.Config.get('behavior.formatOnSave');

      expect(result).toBeDefined();
      expect(typeof result).toBe('boolean');
    });

    it('should retrieve deeply nested values', () => {
      const result = Core.Config.get('advanced.cdnUrls.monaco');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('getAll', () => {
    it('should return entire configuration object', () => {
      const result = Core.Config.getAll();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('behavior');
      expect(result).toHaveProperty('editor');
      expect(result).toHaveProperty('appearance');
      expect(result).toHaveProperty('advanced');
    });

    it('should include all default sections', () => {
      const result = Core.Config.getAll();

      expect(result.behavior).toBeDefined();
      expect(result.editor).toBeDefined();
      expect(result.files).toBeDefined();
      expect(result.overlay).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.appearance).toBeDefined();
      expect(result.advanced).toBeDefined();
    });
  });

  describe('setUserSetting', () => {
    it('should set user preference value', () => {
      const result = Core.Config.setUserSetting('editor.fontSize', 16);

      expect(result).toBe(true);
      expect(Core.Config.get('editor.fontSize')).toBe(16);
    });

    it('should save to localStorage', () => {
      Core.Config.setUserSetting('editor.fontSize', 16);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const callArgs = mockLocalStorage.setItem.mock.calls[0];
      expect(callArgs[0]).toContain('config');
    });

    it('should handle nested path setting', () => {
      const result = Core.Config.setUserSetting('behavior.formatOnSave', false);

      expect(result).toBe(true);
      expect(Core.Config.get('behavior.formatOnSave')).toBe(false);
    });

    it('should update effective config after setting', () => {
      const before = Core.Config.get('editor.tabSize');
      Core.Config.setUserSetting('editor.tabSize', 4);
      const after = Core.Config.get('editor.tabSize');

      expect(after).not.toBe(before);
      expect(after).toBe(4);
    });
  });

  describe('getDefault', () => {
    it('should return default value for a path', () => {
      // Set a user setting first
      Core.Config.setUserSetting('editor.fontSize', 20);

      // Default should still be the original default
      const defaultValue = Core.Config.getDefault('editor.fontSize');

      expect(defaultValue).toBe(14); // Default is 14 per DEFAULT_CONFIG
    });

    it('should return default for nested paths', () => {
      const defaultValue = Core.Config.getDefault('behavior.autoSaveInterval');

      expect(defaultValue).toBe(30000); // Default is 30000ms
    });
  });

  describe('isUserModified', () => {
    it('should return false for unmodified settings', () => {
      const result = Core.Config.isUserModified('editor.fontSize');

      expect(result).toBe(false);
    });

    it('should return true after user modifies setting', () => {
      Core.Config.setUserSetting('editor.fontSize', 16);
      const result = Core.Config.isUserModified('editor.fontSize');

      expect(result).toBe(true);
    });
  });

  describe('isEmbedOverridden', () => {
    it('should return false for non-overridden settings', () => {
      const result = Core.Config.isEmbedOverridden('editor.fontSize');

      expect(result).toBe(false);
    });
  });

  describe('getSource', () => {
    it('should return "default" for unmodified settings', () => {
      const result = Core.Config.getSource('editor.fontSize');

      expect(result).toBe('default');
    });

    it('should return "user" for user-modified settings', () => {
      Core.Config.setUserSetting('editor.fontSize', 16);
      const result = Core.Config.getSource('editor.fontSize');

      expect(result).toBe('user');
    });
  });

  describe('resetUserSetting', () => {
    it('should reset user setting to default', () => {
      Core.Config.setUserSetting('editor.fontSize', 20);
      expect(Core.Config.get('editor.fontSize')).toBe(20);

      Core.Config.resetUserSetting('editor.fontSize');

      expect(Core.Config.get('editor.fontSize')).toBe(14); // Default
      expect(Core.Config.isUserModified('editor.fontSize')).toBe(false);
    });

    it('should update localStorage after reset', () => {
      Core.Config.setUserSetting('editor.fontSize', 20);
      mockLocalStorage.setItem.mockClear();

      Core.Config.resetUserSetting('editor.fontSize');

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('resetAllUserSettings', () => {
    it('should reset all user settings', () => {
      Core.Config.setUserSetting('editor.fontSize', 20);
      Core.Config.setUserSetting('editor.tabSize', 4);
      expect(Core.Config.isUserModified('editor.fontSize')).toBe(true);
      expect(Core.Config.isUserModified('editor.tabSize')).toBe(true);

      Core.Config.resetAllUserSettings();

      expect(Core.Config.isUserModified('editor.fontSize')).toBe(false);
      expect(Core.Config.isUserModified('editor.tabSize')).toBe(false);
      expect(Core.Config.get('editor.fontSize')).toBe(14); // Default
      expect(Core.Config.get('editor.tabSize')).toBe(2); // Default
    });
  });

  describe('exportConfig', () => {
    it('should export complete configuration hierarchy', () => {
      const result = Core.Config.exportConfig();

      expect(result).toHaveProperty('defaults');
      expect(result).toHaveProperty('userSettings');
      expect(result).toHaveProperty('embedConfig');
      expect(result).toHaveProperty('effective');
    });

    it('should include all layers in export', () => {
      Core.Config.setUserSetting('editor.fontSize', 18);
      const result = Core.Config.exportConfig();

      expect(result.defaults).toBeDefined();
      expect(result.userSettings).toHaveProperty('editor');
      expect(result.effective.editor.fontSize).toBe(18);
    });
  });

  describe('configuration hierarchy', () => {
    it('should use defaults when no overrides exist', () => {
      const fontSize = Core.Config.get('editor.fontSize');

      expect(fontSize).toBe(14); // Default value
    });

    it('should prioritize user settings over defaults', () => {
      Core.Config.setUserSetting('editor.fontSize', 16);

      const fontSize = Core.Config.get('editor.fontSize');

      expect(fontSize).toBe(16);
    });

    it('should maintain hierarchy when multiple settings changed', () => {
      Core.Config.setUserSetting('editor.fontSize', 16);
      Core.Config.setUserSetting('behavior.formatOnSave', false);

      expect(Core.Config.get('editor.fontSize')).toBe(16);
      expect(Core.Config.get('behavior.formatOnSave')).toBe(false);
      // Other settings should remain at defaults
      expect(Core.Config.get('editor.tabSize')).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle invalid paths gracefully', () => {
      const result = Core.Config.get('invalid.deeply.nested.path.that.does.not.exist');

      expect(result).toBeUndefined();
    });

    it('should handle setting deeply nested paths', () => {
      const result = Core.Config.setUserSetting('new.deep.path', 'value');

      expect(result).toBe(true);
      expect(Core.Config.get('new.deep.path')).toBe('value');
    });
  });
});
