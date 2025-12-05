import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadCore } from './core-loader.js';

describe('core-loader', () => {
  let ExpertEnhancements;

  beforeAll(async () => {
    // Setup global window object for the core module
    global.window = global;

    // Load the core module
    ExpertEnhancements = await loadCore();
  });

  it('should load core.js and populate window.ExpertEnhancements', () => {
    expect(ExpertEnhancements).toBeDefined();
    expect(window.ExpertEnhancements).toBeDefined();
  });

  it('should expose the Config object', () => {
    expect(ExpertEnhancements.Config).toBeDefined();
    expect(typeof ExpertEnhancements.Config).toBe('object');
  });

  it('should expose the ConfigManager class', () => {
    expect(ExpertEnhancements.ConfigManager).toBeDefined();
    expect(typeof ExpertEnhancements.ConfigManager).toBe('function');
  });

  it('should expose the AppManager object', () => {
    expect(ExpertEnhancements.AppManager).toBeDefined();
    expect(typeof ExpertEnhancements.AppManager).toBe('object');
  });

  it('should expose core utilities', () => {
    // Check for essential utilities
    expect(ExpertEnhancements.API).toBeDefined();
    expect(ExpertEnhancements.Storage).toBeDefined();
    expect(ExpertEnhancements.UI).toBeDefined();
    expect(ExpertEnhancements.DOM).toBeDefined();
  });

  it('should expose the version', () => {
    expect(ExpertEnhancements.version).toBeDefined();
    expect(typeof ExpertEnhancements.version).toBe('string');
  });

  it('should have AppManager.register method', () => {
    expect(typeof ExpertEnhancements.AppManager.register).toBe('function');
  });

  it('should have AppManager.getApps method', () => {
    expect(typeof ExpertEnhancements.AppManager.getApps).toBe('function');
  });

  describe('AppManager behavior', () => {
    const uniqueId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    it('registers a valid app and tracks it in getApps()', () => {
      const { AppManager } = ExpertEnhancements;
      const startCount = AppManager.getApps().length;

      const appId = uniqueId('valid');
      const validApp = {
        id: appId,
        name: 'Valid App',
        init: vi.fn(),
        mount: vi.fn(),
        unmount: vi.fn()
      };

      const registered = AppManager.register(validApp);

      expect(registered).toBe(true);
      const apps = AppManager.getApps();
      expect(apps.length).toBe(startCount + 1);
      expect(apps.some(app => app.id === appId)).toBe(true);
    });

    it('prevents duplicate registrations for the same id', () => {
      const { AppManager } = ExpertEnhancements;
      const appId = uniqueId('dupe');
      const baseApp = {
        id: appId,
        name: 'Dupe App',
        init: vi.fn(),
        mount: vi.fn(),
        unmount: vi.fn()
      };

      const first = AppManager.register(baseApp);
      const failedCount = AppManager.getFailedApps().length;
      const second = AppManager.register({ ...baseApp });

      expect(first).toBe(true);
      expect(second).toBe(false);
      const apps = AppManager.getApps().filter(app => app.id === appId);
      expect(apps.length).toBe(1); // still only one instance
      expect(AppManager.getFailedApps().length).toBe(failedCount); // no new failed entry on duplicate
    });

    it('captures invalid apps as failed registrations', () => {
      const { AppManager } = ExpertEnhancements;
      const failedBefore = AppManager.getFailedApps().length;
      const badId = uniqueId('invalid');

      const registered = AppManager.register({
        id: badId,
        // Missing name/init/mount/unmount on purpose
      });

      const failedAfter = AppManager.getFailedApps();
      const newEntry = failedAfter.find(entry => entry.id === badId);

      expect(registered).toBe(false);
      expect(failedAfter.length).toBe(failedBefore + 1);
      expect(newEntry).toBeDefined();
      expect(newEntry.error).toContain('Invalid app interface');
    });

    it('records dependency failures and does not register the app', () => {
      const { AppManager } = ExpertEnhancements;
      const failedBefore = AppManager.getFailedApps().length;
      const startCount = AppManager.getApps().length;
      const depId = uniqueId('needs-dep');

      const registered = AppManager.register({
        id: depId,
        name: 'Dependent App',
        dependencies: ['missing-dep'],
        init: vi.fn(),
        mount: vi.fn(),
        unmount: vi.fn()
      });

      const failedAfter = AppManager.getFailedApps();
      const failure = failedAfter.find(entry => entry.id === depId);

      expect(registered).toBe(false);
      expect(AppManager.getApps().length).toBe(startCount);
      expect(failedAfter.length).toBe(failedBefore + 1);
      expect(failure).toBeDefined();
      expect(failure.type).toBe('dependency');
      expect(failure.error).toContain('Missing dependencies');
    });
  });
});
