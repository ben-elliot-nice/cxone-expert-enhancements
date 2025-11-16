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

  'editor.tabSize': {
    type: 'number',
    default: 2,
    serverSafe: true,
    category: 'editor',
    label: 'Tab Size',
    options: [2, 4, 8]
  },

  'editor.wordWrap': {
    type: 'string',
    default: 'on',
    serverSafe: true,
    category: 'editor',
    label: 'Word Wrap',
    options: ['on', 'off', 'wordWrapColumn', 'bounded']
  },

  'editor.minimapEnabled': {
    type: 'boolean',
    default: true,
    serverSafe: true,
    category: 'editor',
    label: 'Show Minimap'
  },

  'editor.scrollBeyondLastLine': {
    type: 'boolean',
    default: false,
    serverSafe: true,
    category: 'editor',
    label: 'Scroll Beyond Last Line'
  },

  'editor.maxActiveTabs': {
    type: 'number',
    default: 3,
    serverSafe: true,
    category: 'editor',
    label: 'Maximum Active Tabs',
    min: 1,
    max: 10
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
    default: 4000,
    serverSafe: true,
    category: 'performance',
    label: 'Toast Duration (ms)',
    min: 1000,
    max: 10000
  },

  'performance.livePreviewDebounce': {
    type: 'number',
    default: 300,
    serverSafe: true,
    category: 'performance',
    label: 'Live Preview Debounce (ms)',
    min: 50,
    max: 1000
  },

  'performance.formatterTimeout': {
    type: 'number',
    default: 60000,
    serverSafe: true,
    category: 'performance',
    label: 'Formatter Timeout (ms)',
    min: 10000,
    max: 120000
  },

  // Files Settings
  'files.maxSizeMB': {
    type: 'number',
    default: 5,
    serverSafe: true,
    category: 'files',
    label: 'Maximum File Size (MB)',
    min: 1,
    max: 50
  },

  // Appearance Settings
  'appearance.primaryColor': {
    type: 'string',
    default: '#667eea',
    serverSafe: true,
    category: 'appearance',
    label: 'Primary Color'
  },

  'appearance.headerColor': {
    type: 'string',
    default: '#667eea',
    serverSafe: true,
    category: 'appearance',
    label: 'Header Color'
  },

  // Advanced Settings - CDN URLs
  'advanced.cdnUrls.monaco': {
    type: 'string',
    default: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs',
    serverSafe: false,
    category: 'advanced',
    label: 'Monaco CDN URL',
    hidden: true
  },

  'advanced.cdnUrls.prettier': {
    type: 'string',
    default: 'https://unpkg.com/prettier@3.6.2/standalone.js',
    serverSafe: false,
    category: 'advanced',
    label: 'Prettier CDN URL',
    hidden: true
  },

  'advanced.cdnUrls.prettierCSS': {
    type: 'string',
    default: 'https://unpkg.com/prettier@3.6.2/plugins/postcss.js',
    serverSafe: false,
    category: 'advanced',
    label: 'Prettier CSS Plugin URL',
    hidden: true
  },

  'advanced.cdnUrls.prettierHTML': {
    type: 'string',
    default: 'https://unpkg.com/prettier@3.6.2/plugins/html.js',
    serverSafe: false,
    category: 'advanced',
    label: 'Prettier HTML Plugin URL',
    hidden: true
  },

  // Advanced Settings - Breakpoints
  'advanced.breakpoints.mobile': {
    type: 'number',
    default: 480,
    serverSafe: true,
    category: 'advanced',
    label: 'Mobile Breakpoint (px)',
    hidden: true
  },

  'advanced.breakpoints.tablet': {
    type: 'number',
    default: 768,
    serverSafe: true,
    category: 'advanced',
    label: 'Tablet Breakpoint (px)',
    hidden: true
  },

  'advanced.breakpoints.desktop': {
    type: 'number',
    default: 920,
    serverSafe: true,
    category: 'advanced',
    label: 'Desktop Breakpoint (px)',
    hidden: true
  },

  // Advanced Settings - Resize Handles
  'advanced.resizeHandles.lineStyle': {
    type: 'object',
    default: {
      defaultWidth: 2,
      hoverWidth: 3,
      activeWidth: 4,
      defaultOpacity: 0.15,
      hoverOpacity: 0.5,
      activeOpacity: 0.8,
      glowBlur: 8,
      glowBlurActive: 12
    },
    serverSafe: false,
    category: 'advanced',
    label: 'Resize Handle Line Style',
    hidden: true
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

  // Options validation (for strings and numbers)
  if (schema.options && !schema.options.includes(value)) {
    throw new Error(`Invalid value for ${key}: ${value}. Allowed: ${schema.options.join(', ')}`);
  }

  // Object type: basic validation (must be non-null object)
  if (schema.type === 'object' && (value === null || Array.isArray(value))) {
    throw new Error(`Invalid type for ${key}: expected object, got ${Array.isArray(value) ? 'array' : 'null'}`);
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
