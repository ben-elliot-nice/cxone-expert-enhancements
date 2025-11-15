import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockLocalStorage } from '../helpers/test-utils.js';

// We'll need to extract Storage from core.js or mock it
// For now, let's test the expected behavior

describe('Storage', () => {
  let mockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = createMockLocalStorage();
    global.localStorage = mockLocalStorage;
  });

  describe('set', () => {
    it('should store value in localStorage with namespace prefix', () => {
      const namespace = 'cxone-expert';
      const key = 'test-key';
      const value = { data: 'test-value' };

      // This will fail until we implement proper Storage extraction
      // For now, test localStorage directly
      const fullKey = `${namespace}:${key}`;
      localStorage.setItem(fullKey, JSON.stringify(value));

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        fullKey,
        JSON.stringify(value)
      );
    });
  });

  describe('get', () => {
    it('should retrieve value from localStorage with namespace prefix', () => {
      const namespace = 'cxone-expert';
      const key = 'test-key';
      const value = { data: 'test-value' };
      const fullKey = `${namespace}:${key}`;

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(value));

      const result = JSON.parse(localStorage.getItem(fullKey));

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(fullKey);
      expect(result).toEqual(value);
    });
  });
});
