# Properties API & Persistent Preferences Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement four-tier configuration system with cross-device preference sync via Expert Properties API.

**Architecture:** ConfigManager class with hierarchical resolution (embed → site → user → localStorage), multi-level caching (memory + localStorage), and security-aware sync (serverSafe flag prevents secret leakage).

**Tech Stack:** Vanilla JavaScript (ES6+), Expert Properties API, SubtleCrypto (HMAC), localStorage

---

## Task 1: Create Settings Schema

**Files:**
- Create: `src/config-schema.js`

**Step 1: Write schema structure with basic settings**

Create `src/config-schema.js`:

```javascript
/**
 * Settings Schema Definition
 *
 * Defines all configuration settings with metadata:
 * - type: Data type for validation
 * - default: Default value
 * - serverSafe: Can this sync to Properties API? (false = localStorage only)
 * - sensitive: Should value be masked in UI?
 * - category: Grouping for Settings UI
 * - label: Human-readable name
 * - hidden: Hide from Settings UI (internal values)
 */

export const settingsSchema = {
  // Editor Settings
  'editor.theme': {
    type: 'string',
    default: 'vs-dark',
    serverSafe: true,
    category: 'editor',
    label: 'Editor Theme',
    options: ['vs-dark', 'vs-light', 'hc-black']
  },

  'editor.fontSize': {
    type: 'number',
    default: 14,
    serverSafe: true,
    category: 'editor',
    label: 'Font Size',
    min: 10,
    max: 24
  },

  'editor.wordWrap': {
    type: 'boolean',
    default: true,
    serverSafe: true,
    category: 'editor',
    label: 'Word Wrap'
  },

  'editor.minimap': {
    type: 'boolean',
    default: false,
    serverSafe: true,
    category: 'editor',
    label: 'Show Minimap'
  },

  // Formatting Settings
  'formatting.indentSize': {
    type: 'number',
    default: 2,
    serverSafe: true,
    category: 'formatting',
    label: 'Indent Size',
    options: [2, 4, 8]
  },

  'formatting.indentType': {
    type: 'string',
    default: 'spaces',
    serverSafe: true,
    category: 'formatting',
    label: 'Indentation Type',
    options: ['spaces', 'tabs']
  },

  'formatting.quoteStyle': {
    type: 'string',
    default: 'single',
    serverSafe: true,
    category: 'formatting',
    label: 'Quote Style',
    options: ['single', 'double']
  },

  // Behavior Settings
  'behavior.formatOnSave': {
    type: 'boolean',
    default: true,
    serverSafe: true,
    category: 'behavior',
    label: 'Format on Save'
  },

  'behavior.confirmBeforeDiscard': {
    type: 'boolean',
    default: true,
    serverSafe: true,
    category: 'behavior',
    label: 'Confirm Before Discard'
  },

  // Overlay Settings
  'overlay.defaultWidth': {
    type: 'number',
    default: 1200,
    serverSafe: true,
    category: 'overlay',
    label: 'Default Width'
  },

  'overlay.defaultHeight': {
    type: 'number',
    default: 800,
    serverSafe: true,
    category: 'overlay',
    label: 'Default Height'
  },

  'overlay.rememberPosition': {
    type: 'boolean',
    default: true,
    serverSafe: true,
    category: 'overlay',
    label: 'Remember Position'
  },

  'overlay.rememberSize': {
    type: 'boolean',
    default: true,
    serverSafe: true,
    category: 'overlay',
    label: 'Remember Size'
  },

  // Performance Settings
  'performance.loadingTimeout': {
    type: 'number',
    default: 30000,
    serverSafe: true,
    category: 'performance',
    label: 'Loading Timeout (ms)',
    min: 5000,
    max: 120000
  },

  'performance.toastDuration': {
    type: 'number',
    default: 3000,
    serverSafe: true,
    category: 'performance',
    label: 'Toast Duration (ms)',
    min: 1000,
    max: 10000
  },

  // API Keys (LOCAL ONLY - for future integrations)
  'apiKeys.s3AccessKey': {
    type: 'string',
    default: null,
    serverSafe: false,  // NEVER sync to server
    sensitive: true,
    category: 'advanced',
    label: 'S3 Access Key'
  },

  'apiKeys.s3SecretKey': {
    type: 'string',
    default: null,
    serverSafe: false,  // NEVER sync to server
    sensitive: true,
    category: 'advanced',
    label: 'S3 Secret Key'
  },

  // Cache/Internal Settings (LOCAL ONLY)
  'cache.monacoLoaded': {
    type: 'boolean',
    default: false,
    serverSafe: false,
    category: 'internal',
    hidden: true
  },

  'cache.lastSitePropertiesSync': {
    type: 'number',
    default: 0,
    serverSafe: false,
    category: 'internal',
    hidden: true
  },

  'cache.lastUserPropertiesSync': {
    type: 'number',
    default: 0,
    serverSafe: false,
    category: 'internal',
    hidden: true
  }
};

/**
 * Get default configuration object
 */
export function getDefaults() {
  const defaults = {};
  for (const [key, schema] of Object.entries(settingsSchema)) {
    defaults[key] = schema.default;
  }
  return defaults;
}

/**
 * Validate a setting value against schema
 */
export function validateSetting(key, value) {
  const schema = settingsSchema[key];
  if (!schema) {
    throw new Error(`Unknown setting: ${key}`);
  }

  // Type validation
  const actualType = typeof value;
  if (actualType !== schema.type) {
    throw new Error(`Invalid type for ${key}: expected ${schema.type}, got ${actualType}`);
  }

  // Range validation for numbers
  if (schema.type === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      throw new Error(`Value for ${key} (${value}) is below minimum (${schema.min})`);
    }
    if (schema.max !== undefined && value > schema.max) {
      throw new Error(`Value for ${key} (${value}) is above maximum (${schema.max})`);
    }
  }

  // Options validation
  if (schema.options && !schema.options.includes(value)) {
    throw new Error(`Invalid value for ${key}: ${value}. Allowed: ${schema.options.join(', ')}`);
  }

  return true;
}

/**
 * Check if a setting can be synced to server
 */
export function isServerSafe(key) {
  return settingsSchema[key]?.serverSafe ?? false;
}

/**
 * Check if a setting should be hidden from UI
 */
export function isHidden(key) {
  return settingsSchema[key]?.hidden ?? false;
}

/**
 * Get all settings in a category
 */
export function getSettingsByCategory(category) {
  return Object.entries(settingsSchema)
    .filter(([, schema]) => schema.category === category)
    .reduce((acc, [key, schema]) => {
      acc[key] = schema;
      return acc;
    }, {});
}
```

**Step 2: Verify exports work**

Create temporary test file `test-schema.js`:

```javascript
import { settingsSchema, getDefaults, validateSetting } from './src/config-schema.js';

console.log('Schema keys:', Object.keys(settingsSchema).length);
console.log('Defaults:', getDefaults());
console.log('Validate editor.theme=vs-dark:', validateSetting('editor.theme', 'vs-dark'));

try {
  validateSetting('editor.theme', 'invalid');
} catch (e) {
  console.log('Expected error:', e.message);
}
```

Run: `node test-schema.js`
Expected: Should print schema info and validation results

**Step 3: Clean up and commit**

```bash
rm test-schema.js
git add src/config-schema.js
git commit -m "feat: Add settings schema with validation

- Define all configuration settings with metadata
- serverSafe flag for security (prevents secret sync)
- Validation helpers for type/range/options checking
- Category grouping for future Settings UI

Related: #101, #106"
```

---

## Task 2: Create ConfigManager Class - User Detection

**Files:**
- Create: `src/config-manager.js`

**Step 1: Write user detection method**

Create `src/config-manager.js`:

```javascript
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
}
```

**Step 2: Test user detection**

Create `test-user-detection.js`:

```javascript
import { ConfigManager } from './src/config-manager.js';

// Mock window.Deki
global.window = {
  Deki: {
    UserIsAnonymous: false,
    UserName: 'testuser',
    UserSystemName: 'testuser',
    UserPermissions: ['LOGIN', 'READ', 'UPDATE', 'ADMIN']
  }
};

const manager = new ConfigManager();
const user = manager.detectUser();

console.log('User detected:', user);
console.assert(user.isLoggedIn === true, 'Should be logged in');
console.assert(user.isAdmin === true, 'Should be admin');
console.assert(user.systemName === 'testuser', 'Should have systemName');

// Test anonymous
global.window.Deki.UserIsAnonymous = true;
const anonUser = manager.detectUser();
console.log('Anonymous user:', anonUser);
console.assert(anonUser.isLoggedIn === false, 'Should not be logged in');
console.assert(anonUser.isAnonymous === true, 'Should be anonymous');

console.log('✓ User detection tests passed');
```

Run: `node test-user-detection.js`
Expected: All assertions pass

**Step 3: Clean up and commit**

```bash
rm test-user-detection.js
git add src/config-manager.js
git commit -m "feat: Add ConfigManager with user detection

- Detect user state from window.Deki object
- Identify logged-in vs anonymous users
- Check admin permissions

Related: #101, #106"
```

---

## Task 3: ConfigManager - Embed Config Parsing

**Files:**
- Modify: `src/config-manager.js`

**Step 1: Add embed config parsing method**

Add to `ConfigManager` class in `src/config-manager.js`:

```javascript
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
```

**Step 2: Test embed config parsing**

Create `test-embed-config.js`:

```javascript
import { ConfigManager } from './src/config-manager.js';
import { JSDOM } from 'jsdom';

// Setup DOM
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head>
      <script data-config='{"editor":{"theme":"vs-light","fontSize":16},"behavior":{"formatOnSave":false}}'></script>
    </head>
  </html>
`);

global.document = dom.window.document;
global.window = dom.window;

const manager = new ConfigManager();
const embedConfig = manager.parseEmbedConfig();

console.log('Embed config (nested):', embedConfig);

const flattened = manager.flattenConfig(embedConfig);
console.log('Flattened config:', flattened);

console.assert(flattened['editor.theme'] === 'vs-light', 'Should have editor.theme');
console.assert(flattened['editor.fontSize'] === 16, 'Should have editor.fontSize');
console.assert(flattened['behavior.formatOnSave'] === false, 'Should have behavior.formatOnSave');

console.log('✓ Embed config tests passed');
```

Install jsdom for testing:
```bash
npm install --save-dev jsdom
```

Run: `node test-embed-config.js`
Expected: All assertions pass

**Step 3: Clean up and commit**

```bash
rm test-embed-config.js
git add src/config-manager.js package.json package-lock.json
git commit -m "feat: Add embed config parsing to ConfigManager

- Parse data-config attribute from script tag
- Flatten nested config to dot-notation keys
- Handle parsing errors gracefully

Related: #101, #106"
```

---

## Task 4: ConfigManager - localStorage Operations

**Files:**
- Modify: `src/config-manager.js`

**Step 1: Add localStorage methods**

Add to `ConfigManager` class:

```javascript
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
```

**Step 2: Test localStorage operations**

Create `test-localstorage.js`:

```javascript
import { ConfigManager } from './src/config-manager.js';

// Mock localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = value;
  }

  removeItem(key) {
    delete this.store[key];
  }

  get length() {
    return Object.keys(this.store).length;
  }

  key(index) {
    return Object.keys(this.store)[index];
  }
}

global.localStorage = new LocalStorageMock();

const manager = new ConfigManager();

// Test save
manager.saveToLocalStorage('editor.theme', 'vs-dark');
console.assert(
  localStorage.getItem('expertEnhancements:config:editor.theme') === '"vs-dark"',
  'Should save to localStorage'
);

// Test load
const value = manager.loadFromLocalStorage('editor.theme');
console.assert(value === 'vs-dark', 'Should load from localStorage');

// Test load all
manager.saveToLocalStorage('editor.fontSize', 16);
manager.saveToLocalStorage('behavior.formatOnSave', true);
const all = manager.loadAllFromLocalStorage();
console.log('All settings:', all);
console.assert(all['editor.theme'] === 'vs-dark', 'Should have theme');
console.assert(all['editor.fontSize'] === 16, 'Should have fontSize');
console.assert(all['behavior.formatOnSave'] === true, 'Should have formatOnSave');

// Test remove
manager.removeFromLocalStorage('editor.theme');
const removed = manager.loadFromLocalStorage('editor.theme');
console.assert(removed === null, 'Should be removed');

console.log('✓ localStorage tests passed');
```

Run: `node test-localstorage.js`
Expected: All assertions pass

**Step 3: Clean up and commit**

```bash
rm test-localstorage.js
git add src/config-manager.js
git commit -m "feat: Add localStorage operations to ConfigManager

- Save/load individual settings
- Load all settings with prefix filtering
- Remove settings
- Cache entire config object
- Graceful error handling

Related: #101, #106"
```

---

## Task 5: ConfigManager - Properties API Integration

**Files:**
- Modify: `src/config-manager.js`

**Step 1: Add Properties API methods**

Add to `ConfigManager` class:

```javascript
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
        `/@api/deki/users/${encodeURIComponent(username)}/properties?dream.out.format=json`,
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
      `/@api/deki/users/${encodeURIComponent(username)}/properties/${encodeURIComponent(propertyName)}?dream.out.format=json`,
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
      `/@api/deki/users/${encodeURIComponent(username)}/properties/${encodeURIComponent(propertyName)}`,
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
```

**Step 2: Verify API methods compile**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Commit**

```bash
git add src/config-manager.js
git commit -m "feat: Add Properties API integration to ConfigManager

- Load/save site properties (admin only)
- Load/save/delete user properties
- Parse API responses with URN namespace filtering
- Multi-level caching (memory + localStorage fallback)
- Session-based authentication

Related: #101, #106"
```

---

## Task 6: ConfigManager - Hierarchical Resolution

**Files:**
- Modify: `src/config-manager.js`

**Step 1: Add resolution methods**

Add to `ConfigManager` class:

```javascript
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
```

**Step 2: Add validateSetting import**

Add to top of `src/config-manager.js`:

```javascript
import { settingsSchema, getDefaults, validateSetting } from './config-schema.js';
```

**Step 3: Test resolution hierarchy**

Create `test-resolution.js`:

```javascript
import { ConfigManager } from './src/config-manager.js';

// Mock localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = value; }
  removeItem(key) { delete this.store[key]; }
  get length() { return Object.keys(this.store).length; }
  key(index) { return Object.keys(this.store)[index]; }
}

global.localStorage = new LocalStorageMock();
global.window = { Deki: null };

const manager = new ConfigManager();
manager.currentUser = { isAnonymous: true };

// Test 1: Default value
let result = manager.getEffectiveValue('editor.theme');
console.assert(result.source === 'default', 'Should come from default');
console.assert(result.value === 'vs-dark', 'Should be default value');

// Test 2: localStorage overrides default
manager.saveToLocalStorage('editor.theme', 'vs-light');
result = manager.getEffectiveValue('editor.theme');
console.assert(result.source === 'localStorage', 'Should come from localStorage');
console.assert(result.value === 'vs-light', 'Should be cached value');

// Test 3: Site property overrides localStorage
manager.siteProperties = { 'editor.theme': 'hc-black' };
result = manager.getEffectiveValue('editor.theme');
console.assert(result.source === 'site', 'Should come from site');
console.assert(result.value === 'hc-black', 'Should be site value');

// Test 4: User property overrides site
manager.userProperties = { 'editor.theme': 'vs-dark' };
result = manager.getEffectiveValue('editor.theme');
console.assert(result.source === 'user', 'Should come from user');
console.assert(result.value === 'vs-dark', 'Should be user value');

// Test 5: Embed config overrides everything and is locked
manager.embedConfig = { 'editor.theme': 'vs-light' };
result = manager.getEffectiveValue('editor.theme');
console.assert(result.source === 'embed', 'Should come from embed');
console.assert(result.value === 'vs-light', 'Should be embed value');
console.assert(result.locked === true, 'Should be locked');

console.log('✓ Resolution hierarchy tests passed');
```

Run: `node test-resolution.js`
Expected: All assertions pass

**Step 4: Clean up and commit**

```bash
rm test-resolution.js
git add src/config-manager.js
git commit -m "feat: Add hierarchical resolution to ConfigManager

- Four-tier resolution (embed → user → site → localStorage → default)
- get() method for simple value access
- set() method with validation and auto-sync
- reset() method deletes user override
- Source tracking for debugging

Related: #101, #106"
```

---

## Task 7: ConfigManager - Initialization

**Files:**
- Modify: `src/config-manager.js`

**Step 1: Add initialization method**

Add to `ConfigManager` class:

```javascript
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

    // 3. Start with defaults
    this.config = getDefaults();

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
    // 1. Load site properties (anonymous can READ)
    try {
      this.siteProperties = await this.loadSiteProperties();
      this.mergeConfig(this.siteProperties, 'site');
    } catch (error) {
      console.warn('Could not load site properties', error);
    }

    // 2. Load localStorage (anonymous preferences)
    const localConfig = this.loadAllFromLocalStorage();
    this.mergeConfig(localConfig, 'localStorage');

    // 3. Apply embed config overrides (highest priority)
    this.mergeConfig(this.embedConfig, 'embed');
  }

  /**
   * Load configuration for logged-in user
   */
  async loadLoggedInConfig() {
    // 1. Load site properties (admin defaults)
    try {
      this.siteProperties = await this.loadSiteProperties();
      this.mergeConfig(this.siteProperties, 'site');
    } catch (error) {
      console.warn('Could not load site properties', error);
    }

    // 2. Load User Properties from server
    try {
      this.userProperties = await this.loadUserProperties(this.currentUser.systemName);
      this.mergeConfig(this.userProperties, 'user');
    } catch (error) {
      console.warn('Could not load user properties', error);
    }

    // 3. Load localStorage (cache + fallback)
    const localConfig = this.loadAllFromLocalStorage();
    // Note: Don't merge localStorage for logged-in users - it's just cache
    // User properties and site properties take precedence

    // 4. Cache current config to localStorage
    this.cacheToLocalStorage(this.config);

    // 5. Apply embed config overrides (highest priority)
    this.mergeConfig(this.embedConfig, 'embed');
  }
```

**Step 2: Add global export**

Add to end of `src/config-manager.js`:

```javascript
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
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/config-manager.js
git commit -m "feat: Add initialization to ConfigManager

- initialize() orchestrates config loading
- loadAnonymousConfig() for anonymous users
- loadLoggedInConfig() for authenticated users
- Global singleton with getConfigManager()
- initializeConfig() for app startup

Related: #101, #106"
```

---

## Task 8: Integrate ConfigManager with Main Entry Point

**Files:**
- Modify: `src/main.js`

**Step 1: Import and initialize ConfigManager**

Add to top of `src/main.js` (after existing imports):

```javascript
import { initializeConfig, getConfigManager } from './config-manager.js';
```

**Step 2: Initialize during app startup**

Find the initialization section in `src/main.js` and add config initialization:

```javascript
// Initialize configuration system
try {
  await initializeConfig();
  console.log('Configuration system initialized');
} catch (error) {
  console.error('Failed to initialize configuration:', error);
  // Continue anyway - will use defaults
}
```

**Step 3: Expose config to context**

Find where `context` object is created and add `Config`:

```javascript
const context = {
  AppManager,
  Storage,
  UI,
  DOM,
  API,
  Overlay,
  Monaco,
  Config: getConfigManager()  // Add this line
};
```

**Step 4: Build and test**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat: Integrate ConfigManager into app initialization

- Initialize config system on app startup
- Add Config to app context (available to all apps)
- Graceful error handling

Related: #101, #106"
```

---

## Task 9: Update Existing Config Usage

**Files:**
- Modify: `src/css-editor.js`
- Modify: `src/html-editor.js`
- Modify: `src/base-editor.js`

**Step 1: Update CSS editor to use ConfigManager**

In `src/css-editor.js`, find where formatter settings are used and replace with ConfigManager:

Replace:
```javascript
// Old way
const formatterSettings = Storage.get('formatter-settings') || {};
```

With:
```javascript
// New way - get from ConfigManager
const indentSize = context.Config.get('formatting.indentSize');
const indentType = context.Config.get('formatting.indentType');
const quoteStyle = context.Config.get('formatting.quoteStyle');
```

**Step 2: Update HTML editor similarly**

Make same changes in `src/html-editor.js`

**Step 3: Update BaseEditor Monaco configuration**

In `src/base-editor.js`, find Monaco editor initialization and use config:

```javascript
const editor = monaco.editor.create(editorContainer, {
  value: item.content || '',
  language: this.getMonacoLanguage(item.type),
  theme: context.Config.get('editor.theme'),
  fontSize: context.Config.get('editor.fontSize'),
  wordWrap: context.Config.get('editor.wordWrap') ? 'on' : 'off',
  minimap: {
    enabled: context.Config.get('editor.minimap')
  },
  tabSize: context.Config.get('formatting.indentSize'),
  insertSpaces: context.Config.get('formatting.indentType') === 'spaces',
  automaticLayout: true,
  scrollBeyondLastLine: false
});
```

**Step 4: Build and verify**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/css-editor.js src/html-editor.js src/base-editor.js
git commit -m "feat: Migrate editors to use ConfigManager

- CSS/HTML editors use config for formatter settings
- BaseEditor uses config for Monaco initialization
- Remove old formatter-settings storage keys

Related: #101, #106"
```

---

## Task 10: Add Configuration Export/Debug

**Files:**
- Modify: `src/config-manager.js`

**Step 1: Add export method**

Add to `ConfigManager` class:

```javascript
  /**
   * Export full configuration for debugging
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
        permissions: this.currentUser.permissions?.length || 0
      },
      cache: {
        lastSiteSync: new Date(this.cache.lastSiteSync).toISOString(),
        lastUserSync: new Date(this.cache.lastUserSync).toISOString(),
        syncInterval: this.cache.syncInterval
      }
    };
  }

  /**
   * Log current configuration to console
   */
  debug() {
    console.group('ConfigManager Debug');
    console.log('User:', this.currentUser);
    console.log('Embed config:', this.embedConfig);
    console.log('Site properties:', this.siteProperties);
    console.log('User properties:', this.userProperties);
    console.log('Effective config:', this.config);
    console.groupEnd();
  }
```

**Step 2: Expose debug globally**

Add to end of `src/config-manager.js`:

```javascript
// Expose for debugging in browser console
if (typeof window !== 'undefined') {
  window.ExpertEnhancements = window.ExpertEnhancements || {};
  window.ExpertEnhancements.Config = {
    get instance() {
      return getConfigManager();
    },
    debug() {
      return getConfigManager().debug();
    },
    export() {
      return getConfigManager().exportConfig();
    }
  };
}
```

**Step 3: Build and test**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Test in browser console**

After deploying, test these commands in browser console:
```javascript
window.ExpertEnhancements.Config.debug()
window.ExpertEnhancements.Config.export()
window.ExpertEnhancements.Config.instance.get('editor.theme')
```

**Step 5: Commit**

```bash
git add src/config-manager.js
git commit -m "feat: Add config export and debugging tools

- exportConfig() returns full config state
- debug() logs to console
- Expose via window.ExpertEnhancements.Config
- Browser console testing support

Related: #101, #106"
```

---

## Task 11: Documentation Updates

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`

**Step 1: Update README with config info**

Add new section to `README.md` after Features section:

```markdown
## ⚙️ Configuration

The toolkit uses a hierarchical configuration system with cross-device preference sync:

### Configuration Hierarchy

Settings are resolved in this order (highest to lowest priority):

1. **Embed Config** (locked) - Set via `data-config` attribute
2. **User Properties** (personal) - Synced across devices when logged in
3. **Site Properties** (defaults) - Admin-managed defaults for all users
4. **localStorage** (cache/fallback) - Works offline, anonymous users
5. **Hard-coded defaults** - Sensible defaults built-in

### Embed Configuration Example

Lock settings for your organization:

```html
<script
  src="https://releases.benelliot-nice.com/cxone-expert-enhancements/latest/embed.js"
  data-config='{
    "editor": {
      "theme": "vs-dark",
      "fontSize": 14
    },
    "formatting": {
      "indentSize": 2,
      "indentType": "spaces"
    }
  }'
></script>
```

### Available Settings

See full schema in `src/config-schema.js`. Key settings:

**Editor:**
- `editor.theme` - vs-dark | vs-light | hc-black
- `editor.fontSize` - 10-24px
- `editor.wordWrap` - true | false
- `editor.minimap` - true | false

**Formatting:**
- `formatting.indentSize` - 2 | 4 | 8
- `formatting.indentType` - spaces | tabs
- `formatting.quoteStyle` - single | double

**Behavior:**
- `behavior.formatOnSave` - true | false
- `behavior.confirmBeforeDiscard` - true | false

### Browser Console

Debug configuration in browser console:

```javascript
// View current config
window.ExpertEnhancements.Config.debug()

// Export full config state
window.ExpertEnhancements.Config.export()

// Get a specific value
window.ExpertEnhancements.Config.instance.get('editor.theme')
```

### Cross-Device Sync

When logged in, your preferences automatically sync across devices via Expert Properties API. When anonymous or offline, preferences are saved locally in your browser.
```

**Step 2: Update ARCHITECTURE.md**

Add new section after "Core Components":

```markdown
## Configuration System

### Four-Tier Hierarchy

```
Priority 1 (Highest): Embed Config (locked, deployment-level)
    ↓
Priority 2: Site Properties (admin defaults, Expert API)
    ↓
Priority 3: User Properties (personal preferences, Expert API)
    ↓
Priority 4 (Lowest): localStorage (cache + fallback)
    ↓
Hard-coded Defaults (from schema)
```

### ConfigManager

**Purpose:** Manage hierarchical configuration with cross-device sync

**Location:** `src/config-manager.js`

**Key Methods:**
- `get(key)` - Get effective value for a setting
- `set(key, value)` - Set user preference (with auto-sync)
- `reset(key)` - Reset to default
- `exportConfig()` - Export for debugging

**Features:**
- Multi-level caching (memory + localStorage)
- Auto-sync to Properties API (logged-in users)
- Security-aware (serverSafe flag)
- Offline fallback
- Source tracking

### Settings Schema

**Purpose:** Define all settings with metadata

**Location:** `src/config-schema.js`

**Schema Properties:**
- `type` - Data type (string, number, boolean)
- `default` - Default value
- `serverSafe` - Can sync to server? (false for secrets)
- `category` - UI grouping
- `options` - Allowed values
- `min/max` - Numeric constraints

### Properties API Integration

**Site Properties:**
- Endpoint: `/@api/deki/site/properties/urn:expertEnhancements.site.*`
- Write access: Admin only
- Read access: All users
- Use case: Site-wide defaults

**User Properties:**
- Endpoint: `/@api/deki/users/{user}/properties/urn:expertEnhancements.user.*`
- Access: Own user only
- Use case: Personal cross-device sync

**Authentication:** Uses existing CXone session (cookies/CSRF)

### State Management

**Anonymous User:**
1. Load site properties (if available)
2. Load localStorage preferences
3. Apply embed config overrides

**Logged-In User:**
1. Load site properties
2. Load user properties from server
3. Cache to localStorage
4. Apply embed config overrides

**Login Transition:**
- User properties loaded from server
- Overrides localStorage cache

**Logout Transition:**
- Continue using localStorage cache
- Settings preserved for next login
```

**Step 3: Commit**

```bash
git add README.md docs/ARCHITECTURE.md
git commit -m "docs: Update documentation for config system

- Add configuration section to README
- Document hierarchy and embed config usage
- Update ARCHITECTURE with config system details
- Add browser console debugging examples

Related: #101, #106"
```

---

## Task 12: Final Testing and Cleanup

**Files:**
- Create: `tests/manual-config-test.md`

**Step 1: Create manual test plan**

Create `tests/manual-config-test.md`:

```markdown
# Configuration System Manual Testing

## Prerequisites
- Local development environment running
- Access to CXone Expert site
- Both admin and anonymous user access

## Test 1: Default Configuration

**Steps:**
1. Clear localStorage: `localStorage.clear()`
2. Reload page
3. Open console: `window.ExpertEnhancements.Config.export()`

**Expected:**
- All settings have default values from schema
- effectiveConfig matches defaults
- No embed/site/user properties

## Test 2: localStorage Persistence

**Steps:**
1. Set a preference: `window.ExpertEnhancements.Config.instance.set('editor.fontSize', 18)`
2. Verify: `window.ExpertEnhancements.Config.instance.get('editor.fontSize')`
3. Reload page
4. Check again: `window.ExpertEnhancements.Config.instance.get('editor.fontSize')`

**Expected:**
- Setting persists across reload
- Value is 18, not default (14)

## Test 3: Embed Config (Locked)

**Steps:**
1. Add to script tag: `data-config='{"editor":{"theme":"vs-light"}}'`
2. Reload page
3. Try to change: `window.ExpertEnhancements.Config.instance.set('editor.theme', 'vs-dark')`
4. Check value: `window.ExpertEnhancements.Config.instance.get('editor.theme')`
5. Check source: `window.ExpertEnhancements.Config.instance.getEffectiveValue('editor.theme')`

**Expected:**
- Theme is vs-light (from embed config)
- Setting attempt saves to localStorage but embed config wins
- Source shows 'embed' and locked: true

## Test 4: Monaco Editor Integration

**Steps:**
1. Set font size: `window.ExpertEnhancements.Config.instance.set('editor.fontSize', 20)`
2. Open CSS Editor
3. Inspect Monaco editor

**Expected:**
- Editor uses fontSize 20
- Setting applied to Monaco initialization

## Test 5: Cross-Device Sync (Logged-In User)

**Steps:**
1. Login to Expert as non-anonymous user
2. Set preference: `window.ExpertEnhancements.Config.instance.set('editor.theme', 'vs-light')`
3. Check network tab for PUT request to Properties API
4. Logout and log back in (or use different browser)
5. Check value: `window.ExpertEnhancements.Config.instance.get('editor.theme')`

**Expected:**
- PUT request to `/@api/deki/users/{user}/properties/urn:expertEnhancements.user.editor.theme`
- Setting persists across login sessions
- Value synced from server

## Test 6: Site Properties (Admin)

**Steps:**
1. Login as admin
2. Set site property via API or console
3. Logout (become anonymous)
4. Check value: `window.ExpertEnhancements.Config.instance.get('editor.theme')`

**Expected:**
- Anonymous users can read site properties
- Site default applies when user hasn't set preference

## Test 7: Reset to Default

**Steps:**
1. Set custom value: `window.ExpertEnhancements.Config.instance.set('editor.fontSize', 22)`
2. Verify changed: `window.ExpertEnhancements.Config.instance.get('editor.fontSize')`
3. Reset: `await window.ExpertEnhancements.Config.instance.reset('editor.fontSize')`
4. Check value: `window.ExpertEnhancements.Config.instance.get('editor.fontSize')`

**Expected:**
- Value returns to default (14)
- localStorage entry removed
- Server property deleted (if was synced)

## Test 8: Security - Secrets Don't Sync

**Steps:**
1. Set API key: `window.ExpertEnhancements.Config.instance.set('apiKeys.s3AccessKey', 'secret123')`
2. Check localStorage: `localStorage.getItem('expertEnhancements:config:apiKeys.s3AccessKey')`
3. Check network tab for any PUT requests

**Expected:**
- Value saved to localStorage
- NO network request to Properties API
- serverSafe: false prevents sync

## Test 9: Offline Fallback

**Steps:**
1. While logged in, set preference
2. Open DevTools Network tab, set to "Offline"
3. Reload page
4. Check config: `window.ExpertEnhancements.Config.instance.get('editor.theme')`

**Expected:**
- Config loads from localStorage cache
- No errors in console
- Settings available offline

## Test 10: Validation

**Steps:**
1. Try invalid value: `window.ExpertEnhancements.Config.instance.set('editor.fontSize', 999)`
2. Try invalid type: `window.ExpertEnhancements.Config.instance.set('editor.fontSize', 'large')`

**Expected:**
- Validation error thrown
- Value not saved
- Config unchanged
```

**Step 2: Run build and check for errors**

```bash
npm run build
```

Expected: Build succeeds with no errors

**Step 3: Review all changed files**

```bash
git diff --stat develop
```

Expected: See all files we've modified

**Step 4: Commit test plan**

```bash
git add tests/manual-config-test.md
git commit -m "test: Add manual test plan for config system

- Test all hierarchy levels
- Verify cross-device sync
- Security testing (secrets don't sync)
- Offline fallback verification

Related: #101, #106"
```

---

## Completion Checklist

Before marking complete, verify:

- [ ] All files compile without errors
- [ ] Settings schema is complete
- [ ] ConfigManager has all methods
- [ ] Properties API integration works
- [ ] localStorage operations work
- [ ] Hierarchical resolution correct
- [ ] Integration with main.js complete
- [ ] Editors use ConfigManager
- [ ] Documentation updated
- [ ] Manual test plan created
- [ ] All commits have descriptive messages
- [ ] Code follows existing patterns

## Next Steps

After implementation:

1. **Manual Testing** - Follow `tests/manual-config-test.md`
2. **Deploy to develop** - Test on real CXone Expert site
3. **Settings UI** - Future enhancement (#101 continuation)
4. **Automated Tests** - Consider adding unit tests

## Related Issues

- #101: Persistent User Preferences
- #106: Migrate to Properties API
- #48: Configuration system (completed by this work)
