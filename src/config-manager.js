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

import { settingsSchema, getDefaults, validateSetting } from './config-schema.js';

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

    for (let i = 0; i < localStorage.length; i++) {
      try {
        const storageKey = localStorage.key(i);

        if (storageKey && storageKey.startsWith(prefix)) {
          const key = storageKey.substring(prefix.length);
          const value = JSON.parse(localStorage.getItem(storageKey));
          config[key] = value;
        }
      } catch (error) {
        console.error(`Failed to load setting from localStorage (${localStorage.key(i)}):`, error);
        // Continue loading other settings
      }
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

  /**
   * Load site properties from Expert Properties API
   */
  async loadSiteProperties() {
    const now = Date.now();

    // Return cached if still fresh
    if (this.cache.siteProperties &&
        (now - this.cache.lastSiteSync) < this.cache.syncInterval) {
      return this.cache.siteProperties;
    }

    // Fetch from server
    try {
      const response = await fetch('/@api/deki/site/properties?dream.out.format=json', {
        credentials: 'include'  // Use session cookies
      });

      if (response.ok) {
        const data = await response.json();
        const parsed = this.parseSiteProperties(data);

        // Update cache
        this.cache.siteProperties = parsed;
        this.cache.lastSiteSync = now;

        // Save to localStorage as fallback
        this.saveToLocalStorage('cache.siteProperties', parsed);
        this.saveToLocalStorage('cache.lastSitePropertiesSync', now);

        return parsed;
      }
    } catch (error) {
      console.warn('Failed to load site properties from server', error);
    }

    // Fall back to localStorage cache
    const cached = this.loadFromLocalStorage('cache.siteProperties');
    if (cached) {
      return cached;
    }

    return {};
  }

  /**
   * Load user properties from Expert Properties API
   */
  async loadUserProperties(username) {
    const now = Date.now();

    // Return cached if still fresh
    if (this.cache.userProperties &&
        (now - this.cache.lastUserSync) < this.cache.syncInterval) {
      return this.cache.userProperties;
    }

    // Fetch from server
    try {
      const response = await fetch(
        `/@api/deki/users/=${encodeURIComponent(username)}/properties?dream.out.format=json`,
        {
          credentials: 'include'  // Use session cookies
        }
      );

      if (response.ok) {
        const data = await response.json();
        const parsed = this.parseUserProperties(data);

        // Update cache
        this.cache.userProperties = parsed;
        this.cache.lastUserSync = now;

        // Save to localStorage
        this.saveToLocalStorage('cache.userProperties', parsed);
        this.saveToLocalStorage('cache.lastUserPropertiesSync', now);

        return parsed;
      }
    } catch (error) {
      console.warn('Failed to load user properties from server', error);
    }

    // Fall back to localStorage cache
    const cached = this.loadFromLocalStorage('cache.userProperties');
    if (cached) {
      return cached;
    }

    return {};
  }

  /**
   * Parse site properties from API response
   */
  parseSiteProperties(apiResponse) {
    const properties = {};
    const props = apiResponse.property || apiResponse['@properties'] || [];
    const propArray = Array.isArray(props) ? props : [props];

    for (const prop of propArray) {
      const name = prop['@name'] || prop.name;

      // Only process our namespaced properties
      if (name && name.startsWith('urn:expertEnhancements.site.')) {
        const key = name.replace('urn:expertEnhancements.site.', '');
        const value = prop['#text'] || prop.value;

        // Parse JSON values
        try {
          properties[key] = JSON.parse(value);
        } catch {
          properties[key] = value;
        }
      }
    }

    return properties;
  }

  /**
   * Parse user properties from API response
   */
  parseUserProperties(apiResponse) {
    const properties = {};
    const props = apiResponse.property || apiResponse['@properties'] || [];
    const propArray = Array.isArray(props) ? props : [props];

    for (const prop of propArray) {
      const name = prop['@name'] || prop.name;

      if (name && name.startsWith('urn:expertEnhancements.user.')) {
        const key = name.replace('urn:expertEnhancements.user.', '');
        const value = prop['#text'] || prop.value;

        try {
          properties[key] = JSON.parse(value);
        } catch {
          properties[key] = value;
        }
      }
    }

    return properties;
  }

  /**
   * Save a site property (admin only)
   */
  async saveSiteProperty(key, value) {
    const user = this.detectUser();

    if (!user.isAdmin) {
      throw new Error('Only administrators can modify site properties');
    }

    const schema = settingsSchema[key];
    if (!schema || !schema.serverSafe) {
      throw new Error(`Setting ${key} cannot be saved to server`);
    }

    const propertyName = `urn:expertEnhancements.site.${key}`;

    const response = await fetch(
      `/@api/deki/site/properties/${encodeURIComponent(propertyName)}?dream.out.format=json`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(value)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to save site property: ${response.status}`);
    }

    // Invalidate cache
    this.cache.siteProperties = null;
    this.cache.lastSiteSync = 0;
  }

  /**
   * Save a user property
   */
  async saveUserProperty(username, key, value) {
    const schema = settingsSchema[key];
    if (!schema || !schema.serverSafe) {
      // Don't sync secrets to server
      return;
    }

    const propertyName = `urn:expertEnhancements.user.${key}`;

    const response = await fetch(
      `/@api/deki/users/=${encodeURIComponent(username)}/properties/${encodeURIComponent(propertyName)}?dream.out.format=json`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(value)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to save user property: ${response.status}`);
    }

    // Invalidate cache
    this.cache.userProperties = null;
    this.cache.lastUserSync = 0;
  }

  /**
   * Delete a user property
   */
  async deleteUserProperty(username, key) {
    const propertyName = `urn:expertEnhancements.user.${key}`;

    const response = await fetch(
      `/@api/deki/users/=${encodeURIComponent(username)}/properties/${encodeURIComponent(propertyName)}`,
      {
        method: 'DELETE',
        credentials: 'include'
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete user property: ${response.status}`);
    }

    // Invalidate cache
    this.cache.userProperties = null;
    this.cache.lastUserSync = 0;
  }

  /**
   * Merge config from a source into current config
   * Lower priority sources don't override higher priority
   */
  mergeConfig(sourceConfig, sourceName) {
    for (const [key, value] of Object.entries(sourceConfig)) {
      if (this.config[key] === undefined) {
        this.config[key] = value;
        console.log(`Config ${key} = ${value} (from ${sourceName})`);
      }
    }
  }

  /**
   * Get effective value for a setting with source tracking
   */
  getEffectiveValue(key) {
    // 1. Check embed config (highest priority, locked)
    if (this.embedConfig[key] !== undefined) {
      return {
        value: this.embedConfig[key],
        source: 'embed',
        locked: true
      };
    }

    // 2. Check user properties (personal preference)
    if (this.userProperties[key] !== undefined) {
      return {
        value: this.userProperties[key],
        source: 'user',
        locked: false
      };
    }

    // 3. Check site properties (admin default)
    if (this.siteProperties[key] !== undefined) {
      return {
        value: this.siteProperties[key],
        source: 'site',
        locked: false
      };
    }

    // 4. Check localStorage cache/fallback
    const localValue = this.loadFromLocalStorage(key);
    if (localValue !== null) {
      return {
        value: localValue,
        source: 'localStorage',
        locked: false
      };
    }

    // 5. Fall back to default from schema
    const schema = settingsSchema[key];
    if (schema) {
      return {
        value: schema.default,
        source: 'default',
        locked: false
      };
    }

    // Unknown setting
    return {
      value: undefined,
      source: 'unknown',
      locked: false
    };
  }

  /**
   * Get a setting value (simple interface)
   */
  get(key) {
    return this.getEffectiveValue(key).value;
  }

  /**
   * Set a user setting (personal preference)
   */
  async set(key, value) {
    const schema = settingsSchema[key];

    if (!schema) {
      throw new Error(`Unknown setting: ${key}`);
    }

    // Validate value
    validateSetting(key, value);

    // Always save to localStorage first
    this.saveToLocalStorage(key, value);

    // Update in-memory config
    this.config[key] = value;

    // Sync to server if logged in AND serverSafe
    if (!this.currentUser.isAnonymous && schema.serverSafe) {
      try {
        await this.saveUserProperty(this.currentUser.systemName, key, value);
        console.log(`Synced ${key} to server`);
      } catch (error) {
        console.warn(`Server sync failed for ${key}, saved locally only`, error);
      }
    }
  }

  /**
   * Reset a setting to default
   */
  async reset(key) {
    const user = this.currentUser;

    // Remove from localStorage
    this.removeFromLocalStorage(key);

    // Delete from User Properties (if logged in and serverSafe)
    if (!user.isAnonymous && settingsSchema[key]?.serverSafe) {
      try {
        await this.deleteUserProperty(user.systemName, key);
      } catch (error) {
        console.warn('Failed to delete from server', error);
      }
    }

    // Reload effective value
    this.config[key] = this.getEffectiveValue(key).value;
  }

  /**
   * Get the default value for a setting from schema
   * @param {string} key - Setting key
   * @returns {*} Default value
   */
  getDefault(key) {
    const schema = settingsSchema[key];
    if (!schema) {
      throw new Error(`Unknown setting: ${key}`);
    }
    return schema.default;
  }

  /**
   * Alias for getConfigSource() - for backward compatibility with Settings app
   * @param {string} key - Setting key
   * @returns {object} Object with value, source, and locked status
   */
  getSource(key) {
    return this.getConfigSource(key);
  }

  /**
   * Alias for set() - for backward compatibility with Settings app
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   */
  async setUserSetting(key, value) {
    return await this.set(key, value);
  }

  /**
   * Alias for reset() - for backward compatibility with Settings app
   * @param {string} key - Setting key
   */
  async resetUserSetting(key) {
    return await this.reset(key);
  }

  /**
   * Reset all user settings to defaults
   */
  async resetAllUserSettings() {
    const user = this.currentUser;

    // Delete all from localStorage
    const prefix = 'expertEnhancements:config:';
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && storageKey.startsWith(prefix)) {
        keysToRemove.push(storageKey);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Delete all user properties from server if logged in
    if (!user.isAnonymous) {
      for (const key of Object.keys(settingsSchema)) {
        const schema = settingsSchema[key];
        if (schema.serverSafe) {
          try {
            await this.deleteUserProperty(user.systemName, key);
          } catch (error) {
            console.warn(`Failed to delete ${key} from server`, error);
          }
        }
      }
    }

    // Reload config from defaults
    await this.initialize();
  }

  /**
   * Initialize the configuration system
   */
  async initialize() {
    console.log('Initializing ConfigManager...');

    // 1. Parse embed config from script tag
    const embedConfigNested = this.parseEmbedConfig();
    this.embedConfig = this.flattenConfig(embedConfigNested);

    // 2. Detect current user
    this.currentUser = this.detectUser();
    console.log('User:', this.currentUser.isAnonymous ? 'anonymous' : this.currentUser.username);

    // 3. Start with empty config
    this.config = {};

    // 4. Load based on user state
    if (this.currentUser.isAnonymous) {
      await this.loadAnonymousConfig();
    } else {
      await this.loadLoggedInConfig();
    }

    console.log('ConfigManager initialized');
  }

  /**
   * Load configuration for anonymous user
   */
  async loadAnonymousConfig() {
    // 1. Start with defaults (lowest priority)
    this.mergeConfig(getDefaults(), 'defaults');

    // 2. Override with site properties
    try {
      this.siteProperties = await this.loadSiteProperties();
      this.mergeConfig(this.siteProperties, 'site');
    } catch (error) {
      console.warn('Could not load site properties', error);
    }

    // 3. Override with localStorage (anonymous preferences)
    const localConfig = this.loadAllFromLocalStorage();
    this.mergeConfig(localConfig, 'localStorage');

    // 4. Override with embed config (highest priority)
    this.mergeConfig(this.embedConfig, 'embed');
  }

  /**
   * Load configuration for logged-in user
   */
  async loadLoggedInConfig() {
    // 1. Start with defaults (lowest priority)
    this.mergeConfig(getDefaults(), 'defaults');

    // 2. Override with site properties (admin defaults)
    try {
      this.siteProperties = await this.loadSiteProperties();
      this.mergeConfig(this.siteProperties, 'site');
    } catch (error) {
      console.warn('Could not load site properties', error);
    }

    // 3. Override with user properties from server
    try {
      this.userProperties = await this.loadUserProperties(this.currentUser.systemName);
      this.mergeConfig(this.userProperties, 'user');
    } catch (error) {
      console.warn('Could not load user properties', error);
    }

    // 4. Cache current config to localStorage
    this.cacheToLocalStorage(this.config);

    // 5. Override with embed config (highest priority)
    this.mergeConfig(this.embedConfig, 'embed');
  }

  /**
   * Export full configuration for debugging
   * Returns object with all config sources for inspection
   */
  exportConfig() {
    return {
      defaults: getDefaults(),
      embedConfig: this.embedConfig,
      siteProperties: this.siteProperties,
      userProperties: this.userProperties,
      localStorage: this.loadAllFromLocalStorage(),
      effectiveConfig: this.config,
      currentUser: {
        ...this.currentUser,
        // Don't export sensitive data
        permissions: this.currentUser?.permissions?.length || 0
      },
      cache: {
        lastSiteSync: new Date(this.cache.lastSiteSync).toISOString(),
        lastUserSync: new Date(this.cache.lastUserSync).toISOString(),
        syncInterval: this.cache.syncInterval
      }
    };
  }

  /**
   * Get the source of a specific setting's value
   * @param {string} key - Setting key (e.g., 'editor.theme')
   * @returns {Object} Object with value, source, and locked status
   */
  getConfigSource(key) {
    return this.getEffectiveValue(key);
  }

  /**
   * Log detailed resolution path for a setting
   * @param {string} key - Setting key (e.g., 'editor.theme')
   */
  debugConfig(key) {
    const schema = settingsSchema[key];
    const effective = this.getEffectiveValue(key);

    console.group(`ConfigManager Debug: ${key}`);

    // Show resolution hierarchy
    console.log('Resolution Hierarchy (highest to lowest priority):');
    console.log('  1. Embed Config:', this.embedConfig[key] !== undefined ? this.embedConfig[key] : '(not set)');
    console.log('  2. User Properties:', this.userProperties[key] !== undefined ? this.userProperties[key] : '(not set)');
    console.log('  3. Site Properties:', this.siteProperties[key] !== undefined ? this.siteProperties[key] : '(not set)');
    console.log('  4. localStorage:', this.loadFromLocalStorage(key) !== null ? this.loadFromLocalStorage(key) : '(not set)');
    console.log('  5. Default:', schema?.default !== undefined ? schema.default : '(not defined)');

    console.log('');
    console.log('Effective Value:', effective.value);
    console.log('Source:', effective.source);
    console.log('Locked:', effective.locked);

    if (schema) {
      console.log('');
      console.log('Schema:');
      console.log('  Type:', schema.type);
      console.log('  Default:', schema.default);
      console.log('  Server Safe:', schema.serverSafe);
      if (schema.category) console.log('  Category:', schema.category);
      if (schema.options) console.log('  Options:', schema.options);
      if (schema.min !== undefined) console.log('  Min:', schema.min);
      if (schema.max !== undefined) console.log('  Max:', schema.max);
    } else {
      console.log('');
      console.warn('No schema found for this setting');
    }

    console.groupEnd();
  }
}

// Create global instance
let globalConfigManager = null;

/**
 * Get or create the global ConfigManager instance
 */
export function getConfigManager() {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  return globalConfigManager;
}

/**
 * Initialize configuration system
 * Call this once during app startup
 */
export async function initializeConfig() {
  const manager = getConfigManager();
  await manager.initialize();
  return manager;
}

// Expose for debugging in browser console
if (typeof window !== 'undefined') {
  window.ExpertEnhancements = window.ExpertEnhancements || {};
  window.ExpertEnhancements.Config = {
    get instance() {
      return getConfigManager();
    },
    export() {
      return getConfigManager().exportConfig();
    },
    getSource(key) {
      return getConfigManager().getConfigSource(key);
    },
    debug(key) {
      if (key) {
        return getConfigManager().debugConfig(key);
      } else {
        // If no key provided, show all current config
        const config = getConfigManager().exportConfig();
        console.group('ConfigManager Debug - Full Export');
        console.log('Current User:', config.currentUser);
        console.log('Embed Config:', config.embedConfig);
        console.log('Site Properties:', config.siteProperties);
        console.log('User Properties:', config.userProperties);
        console.log('Effective Config:', config.effectiveConfig);
        console.log('Cache Info:', config.cache);
        console.groupEnd();
        return config;
      }
    }
  };
}
