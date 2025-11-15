/**
 * ConfigManager - Four-tier hierarchical configuration system
 *
 * Resolution order (highest to lowest priority):
 * 1. Embed config (locked, from script tag data-config)
 * 2. User properties (personal, synced via Properties API)
 * 3. Site properties (admin defaults, via Properties API)
 * 4. localStorage (cache + fallback)
 * 5. Hard-coded defaults (from schema)
 */

import { settingsSchema, getDefaults } from './config-schema.js';

export class ConfigManager {
  constructor() {
    this.config = {};
    this.embedConfig = {};
    this.siteProperties = {};
    this.userProperties = {};
    this.currentUser = null;

    // Multi-level cache
    this.cache = {
      siteProperties: null,
      userProperties: null,
      lastSiteSync: 0,
      lastUserSync: 0,
      syncInterval: 5 * 60 * 1000 // 5 minutes
    };
  }

  /**
   * Detect current user from window.Deki object
   */
  detectUser() {
    if (!window.Deki) {
      console.warn('window.Deki not available, assuming anonymous');
      return {
        isLoggedIn: false,
        isAnonymous: true,
        username: null,
        systemName: null,
        permissions: [],
        isAdmin: false
      };
    }

    return {
      isLoggedIn: !window.Deki.UserIsAnonymous,
      isAnonymous: window.Deki.UserIsAnonymous,
      username: window.Deki.UserName,
      systemName: window.Deki.UserSystemName,
      permissions: window.Deki.UserPermissions || [],
      isAdmin: window.Deki.UserPermissions?.includes('ADMIN') || false
    };
  }

  /**
   * Parse embed configuration from script tag data-config attribute
   */
  parseEmbedConfig() {
    const scriptTag = document.querySelector('script[data-config]');

    if (!scriptTag) {
      return {};
    }

    try {
      const configStr = scriptTag.getAttribute('data-config');
      const config = JSON.parse(configStr);
      console.log('Loaded embed config:', Object.keys(config));
      return config;
    } catch (error) {
      console.error('Failed to parse embed config:', error);
      return {};
    }
  }

  /**
   * Flatten nested config object to dot-notation keys
   * Example: { editor: { theme: 'dark' } } => { 'editor.theme': 'dark' }
   */
  flattenConfig(obj, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recurse into nested object
        Object.assign(flattened, this.flattenConfig(value, fullKey));
      } else {
        flattened[fullKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Save a setting to localStorage
   */
  saveToLocalStorage(key, value) {
    try {
      const storageKey = `expertEnhancements:config:${key}`;
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage:`, error);
      // Non-fatal - might be quota exceeded or disabled
    }
  }

  /**
   * Load a setting from localStorage
   */
  loadFromLocalStorage(key) {
    try {
      const storageKey = `expertEnhancements:config:${key}`;
      const value = localStorage.getItem(storageKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Failed to load ${key} from localStorage:`, error);
      return null;
    }
  }

  /**
   * Load all settings from localStorage
   */
  loadAllFromLocalStorage() {
    const config = {};
    const prefix = 'expertEnhancements:config:';

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);

        if (storageKey && storageKey.startsWith(prefix)) {
          const key = storageKey.substring(prefix.length);
          const value = JSON.parse(localStorage.getItem(storageKey));
          config[key] = value;
        }
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }

    return config;
  }

  /**
   * Remove a setting from localStorage
   */
  removeFromLocalStorage(key) {
    try {
      const storageKey = `expertEnhancements:config:${key}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error(`Failed to remove ${key} from localStorage:`, error);
    }
  }

  /**
   * Cache entire config object to localStorage
   */
  cacheToLocalStorage(config) {
    for (const [key, value] of Object.entries(config)) {
      this.saveToLocalStorage(key, value);
    }
  }
}
