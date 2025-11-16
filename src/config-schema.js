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

  // Allow null for optional settings
  if (value === null && schema.default === null) {
    return true;
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
 * Check if a setting is sensitive (should be masked in UI)
 */
export function isSensitive(key) {
  return settingsSchema[key]?.sensitive ?? false;
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
