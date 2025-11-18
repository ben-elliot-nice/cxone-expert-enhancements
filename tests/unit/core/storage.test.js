import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockLocalStorage } from '../helpers/test-utils.js';
import { loadCore } from '../helpers/core-loader.js';

describe('Core.Storage', () => {
  let Core;
  let mockLocalStorage;

  beforeEach(async () => {
    mockLocalStorage = createMockLocalStorage();
    global.localStorage = mockLocalStorage;
    Core = await loadCore();
  });

  describe('getCommonState', () => {
    it('should retrieve common state from localStorage', () => {
      const state = { theme: 'dark', layout: 'split' };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(state));

      const result = Core.Storage.getCommonState();

      expect(mockLocalStorage.getItem).toHaveBeenCalled();
      expect(result).toEqual(state);
    });

    it('should return empty object for non-existent state', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = Core.Storage.getCommonState();

      expect(result).toEqual({});
    });

    it('should handle invalid JSON gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const result = Core.Storage.getCommonState();

      expect(result).toEqual({});
    });
  });

  describe('setCommonState', () => {
    it('should store common state in localStorage', () => {
      const state = { theme: 'dark' };

      Core.Storage.setCommonState(state);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const callArgs = mockLocalStorage.setItem.mock.calls[0];
      expect(callArgs[0]).toContain('common');
      expect(JSON.parse(callArgs[1])).toEqual(state);
    });

    it('should merge with existing state', () => {
      const existingState = { theme: 'dark', layout: 'split' };
      const newState = { theme: 'light' };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingState));

      Core.Storage.setCommonState(newState);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const callArgs = mockLocalStorage.setItem.mock.calls[0];
      const savedState = JSON.parse(callArgs[1]);
      expect(savedState).toEqual({ theme: 'light', layout: 'split' });
    });
  });

  describe('getAppState', () => {
    it('should retrieve app-specific state from localStorage', () => {
      const appId = 'test-app';
      const state = { data: 'app-data' };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(state));

      const result = Core.Storage.getAppState(appId);

      expect(mockLocalStorage.getItem).toHaveBeenCalled();
      const callArgs = mockLocalStorage.getItem.mock.calls[0];
      expect(callArgs[0]).toContain(appId);
      expect(result).toEqual(state);
    });

    it('should return null for non-existent app state', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = Core.Storage.getAppState('non-existent-app');

      expect(result).toBeNull();
    });
  });

  describe('setAppState', () => {
    it('should store app-specific state in localStorage', () => {
      const appId = 'test-app';
      const state = { data: 'app-data' };

      Core.Storage.setAppState(appId, state);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const callArgs = mockLocalStorage.setItem.mock.calls[0];
      expect(callArgs[0]).toContain(appId);
      expect(JSON.parse(callArgs[1])).toEqual(state);
    });
  });

  describe('clearAppState', () => {
    it('should remove app-specific state from localStorage', () => {
      const appId = 'test-app';

      Core.Storage.clearAppState(appId);

      expect(mockLocalStorage.removeItem).toHaveBeenCalled();
      const callArgs = mockLocalStorage.removeItem.mock.calls[0];
      expect(callArgs[0]).toContain(appId);
    });
  });

  describe('getFormatterSettings', () => {
    it('should retrieve formatter settings from localStorage', () => {
      const settings = { formatOnSave: true, indentSize: 4 };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(settings));

      const result = Core.Storage.getFormatterSettings();

      expect(mockLocalStorage.getItem).toHaveBeenCalled();
      expect(result.formatOnSave).toBe(true);
      expect(result.indentSize).toBe(4);
    });

    it('should return default settings when none exist', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = Core.Storage.getFormatterSettings();

      expect(result).toBeDefined();
      expect(result.cssSettings).toBeDefined();
      expect(result.htmlSettings).toBeDefined();
    });
  });

  describe('setFormatterSettings', () => {
    it('should store formatter settings in localStorage', () => {
      const settings = { formatOnSave: true, indentSize: 4 };

      Core.Storage.setFormatterSettings(settings);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const callArgs = mockLocalStorage.setItem.mock.calls[0];
      expect(callArgs[0]).toContain('formatter');
      expect(JSON.parse(callArgs[1])).toEqual(settings);
    });
  });
});
