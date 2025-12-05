import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockLocalStorage } from '../helpers/test-utils.js';
import { ConfigManager } from '../../../src/config-manager.js';
import { CONFIG_SCHEMA } from '../../../src/config-schema.js';

describe('ConfigManager - four-tier architecture', () => {
  let storage;
  let fetchMock;

  beforeEach(() => {
    storage = createMockLocalStorage();
    global.localStorage = storage;
    fetchMock = vi.fn();
  });

  async function createManager(options = {}) {
    const manager = new ConfigManager({
      schema: CONFIG_SCHEMA,
      storage,
      fetchImpl: fetchMock,
      ...options
    });

    await manager.init({
      userId: options.userId ?? null,
      embedConfig: options.embedConfig,
      siteProperties: options.siteProperties ?? {},
      userProperties: options.userProperties ?? (options.userId ? {} : undefined)
    });

    return manager;
  }

  it('falls back to defaults when no tiers provide a value', async () => {
    const manager = await createManager();

    expect(manager.get('editor.fontSize')).toBe(14);
    expect(manager.getSource('editor.fontSize')).toBe('default');
  });

  it('resolves using priority embed > user > site > localStorage > default', async () => {
    storage.getItem.mockReturnValueOnce(JSON.stringify({ values: { 'editor.fontSize': 12 } }));

    const manager = await createManager({
      userId: 'u-1',
      embedConfig: { 'editor.fontSize': 20 },
      siteProperties: { 'editor.fontSize': 16 },
      userProperties: { 'editor.fontSize': 18 }
    });

    expect(manager.get('editor.fontSize')).toBe(20);
    expect(manager.getSource('editor.fontSize')).toBe('embed');
  });

  it('blocks writes when an embed config locks the setting', async () => {
    const manager = await createManager({
      embedConfig: { 'editor.theme': 'vs-dark' }
    });

    const result = await manager.setUserSetting('editor.theme', 'vs-light');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/locked/i);
    expect(manager.get('editor.theme')).toBe('vs-dark');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips Properties API sync when serverSafe is false', async () => {
    const manager = await createManager({ userId: 'user-123' });

    const result = await manager.setUserSetting('advanced.cdnUrls.monaco', 'https://example.com/cdn');

    expect(result.success).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(manager.get('advanced.cdnUrls.monaco')).toBe('https://example.com/cdn');
    expect(manager.getSource('advanced.cdnUrls.monaco')).toBe('local');
  });

  it('persists anonymous changes to localStorage and uses them when offline', async () => {
    const manager = await createManager();

    const result = await manager.setUserSetting('behavior.formatOnSave', false);

    expect(result.success).toBe(true);
    expect(storage.setItem).toHaveBeenCalled();
    expect(manager.get('behavior.formatOnSave')).toBe(false);
    expect(manager.getSource('behavior.formatOnSave')).toBe('local');
  });

  it('exports full hierarchy with source metadata', async () => {
    const manager = await createManager({
      userId: 'u-123',
      siteProperties: { 'editor.fontSize': 15 },
      userProperties: { 'editor.fontSize': 17 }
    });

    const exportData = manager.exportConfig();

    expect(exportData).toHaveProperty('defaults');
    expect(exportData).toHaveProperty('embedConfig');
    expect(exportData).toHaveProperty('siteProperties');
    expect(exportData).toHaveProperty('userProperties');
    expect(exportData).toHaveProperty('localCache');
    expect(exportData.resolved['editor.fontSize'].value).toBe(17);
    expect(exportData.resolved['editor.fontSize'].source).toBe('user');
  });
});
