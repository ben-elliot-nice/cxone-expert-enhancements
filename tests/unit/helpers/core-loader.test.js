import { describe, it, expect, beforeAll } from 'vitest';
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
});
