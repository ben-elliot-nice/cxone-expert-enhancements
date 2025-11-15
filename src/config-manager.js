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
}
