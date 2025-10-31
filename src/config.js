/**
 * CXone Expert Enhancements - Configuration System
 *
 * Centralized configuration with hierarchy:
 * Defaults → User Settings (from UI) → Embed Config (highest priority)
 *
 * @version 1.0.0
 */

console.log('[Config] Initializing configuration system...');

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG = {
    // Priority 1: Behavioral Settings (user-facing)
    behavior: {
        formatOnSave: true,
        autoSaveEnabled: false,
        autoSaveInterval: 30000, // 30 seconds
        livePreviewEnabled: false,
        confirmBeforeDiscard: true
    },

    editor: {
        theme: 'vs-dark', // 'vs-dark' | 'vs-light'
        fontSize: 14,
        tabSize: 2,
        wordWrap: 'on', // 'on' | 'off' | 'wordWrapColumn' | 'bounded'
        minimapEnabled: true,
        scrollBeyondLastLine: false,
        indentStyle: 'spaces', // 'spaces' | 'tabs'
        quoteStyle: 'single', // 'single' | 'double'
        maxActiveTabs: 3
    },

    files: {
        maxSizeMB: 5,
        allowedExtensions: {
            css: ['.css'],
            html: ['.html']
        }
    },

    overlay: {
        defaultWidth: 1400,
        defaultHeight: 800,
        maxWidth: '95vw',
        maxHeight: '95vh',
        rememberPosition: true,
        rememberSize: true,
        openOnLoad: false,
        borderRadius: 8
    },

    performance: {
        loadingTimeout: 30000, // 30 seconds
        toastDuration: 4000, // 4 seconds
        livePreviewDebounce: 300, // 300ms
        formatterTimeout: 60000 // 60 seconds
    },

    // Priority 2: Appearance Settings (user-facing)
    appearance: {
        primaryColor: '#667eea',
        primaryHover: '#5568d3',
        headerColor: '#667eea',
        backgroundColor: '#1e1e1e',
        borderColor: '#444',
        borderLight: '#555',
        successColor: '#4caf50',
        warningColor: '#ff9800',
        errorColor: '#ff6b6b',
        infoColor: '#2196f3',
        toggleButtonPosition: 'top-right', // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
        toastColors: {
            success: 'rgba(34, 197, 94, 0.8)',
            warning: 'rgba(251, 146, 60, 0.8)',
            error: 'rgba(239, 68, 68, 0.8)',
            info: 'rgba(59, 130, 246, 0.8)'
        }
    },

    // Priority 3: Advanced/Debug Settings (hidden by default)
    advanced: {
        cdnUrls: {
            monaco: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs',
            prettier: 'https://unpkg.com/prettier@3.6.2/standalone.js',
            prettierCSS: 'https://unpkg.com/prettier@3.6.2/plugins/postcss.js',
            prettierHTML: 'https://unpkg.com/prettier@3.6.2/plugins/html.js'
        },
        zIndex: {
            overlay: 999999,
            toggleButton: 999998,
            toast: 10000,
            messageArea: 2000,
            fileDropZone: 100000,
            modal: 1000000,
            monacoWidgets: 10000
        },
        timing: {
            animationFast: 200,
            animationNormal: 300,
            animationSlow: 500,
            debounceShort: 50,
            debounceLong: 300
        },
        storagePrefix: 'expertEnhancements',
        breakpoints: {
            mobile: 480,
            tablet: 768,
            desktop: 920
        },
        toggleButton: {
            width: 100,
            height: 50,
            top: 15,
            right: -45,
            borderRadius: 25
        },
        resizeHandles: {
            width: 12,
            cornerSize: 20,
            hoverOpacity: 1,
            idleOpacity: 0
        },
        toasts: {
            maxVisible: 3,
            stackGap: 10,
            positionRight: 20,
            positionBottom: 20
        }
    }
};

// ============================================================================
// Configuration Utilities
// ============================================================================

/**
 * Parse embed configuration from script tag data-config attribute
 */
function parseEmbedConfig() {
    try {
        // Find the embed script tag
        const scripts = document.getElementsByTagName('script');
        const embedScript = Array.from(scripts).find(s =>
            s.src && (s.src.includes('embed') || s.src.includes('expert-enhancements'))
        );

        if (!embedScript) {
            console.log('[Config] No embed script found');
            return {};
        }

        const configAttr = embedScript.getAttribute('data-config');
        if (!configAttr) {
            console.log('[Config] No data-config attribute found');
            return {};
        }

        const parsed = JSON.parse(configAttr);
        console.log('[Config] Parsed embed configuration:', parsed);
        return parsed;

    } catch (error) {
        console.error('[Config] Failed to parse embed configuration:', error);
        console.warn('[Config] Using defaults due to invalid embed config');
        return {};
    }
}

/**
 * Deep merge two objects
 * @param {object} target - Target object
 * @param {object} source - Source object to merge
 * @returns {object} Merged object
 */
function deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                // Recursively merge objects
                result[key] = deepMerge(target[key] || {}, source[key]);
            } else {
                // Direct assignment for primitives and arrays
                result[key] = source[key];
            }
        }
    }

    return result;
}

/**
 * Get value from nested object using path string
 * @param {object} obj - Object to traverse
 * @param {string} path - Dot-separated path (e.g., 'editor.fontSize')
 * @returns {any} Value at path or undefined
 */
function getByPath(obj, path) {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return undefined;
        }
    }

    return current;
}

/**
 * Check if path exists in object
 * @param {object} obj - Object to check
 * @param {string} path - Dot-separated path
 * @returns {boolean} True if path exists
 */
function hasPath(obj, path) {
    return getByPath(obj, path) !== undefined;
}

/**
 * Set value in nested object using path string
 * @param {object} obj - Object to modify
 * @param {string} path - Dot-separated path
 * @param {any} value - Value to set
 */
function setByPath(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = obj;

    // Create nested objects if they don't exist
    for (const key of keys) {
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }

    current[lastKey] = value;
}

// ============================================================================
// ConfigManager Class
// ============================================================================

/**
 * Configuration Manager
 * Handles configuration hierarchy: Defaults → User Settings → Embed Config
 */
class ConfigManager {
    constructor() {
        this.defaults = DEFAULT_CONFIG;
        this.embedConfig = parseEmbedConfig();
        this.userSettings = this.loadUserSettings();
        this.effectiveConfig = this.buildEffectiveConfig();

        console.log('[Config] Configuration initialized');
        console.log('[Config] Embed overrides:', Object.keys(this.flattenObject(this.embedConfig)).length, 'settings');
        console.log('[Config] User overrides:', Object.keys(this.flattenObject(this.userSettings)).length, 'settings');
    }

    /**
     * Build effective configuration with proper hierarchy
     * Defaults → User Settings → Embed Config
     */
    buildEffectiveConfig() {
        // Start with defaults
        let config = JSON.parse(JSON.stringify(this.defaults));

        // Apply user settings
        config = deepMerge(config, this.userSettings);

        // Apply embed config (highest priority)
        config = deepMerge(config, this.embedConfig);

        return config;
    }

    /**
     * Get configuration value by path
     * @param {string} path - Dot-separated path (e.g., 'editor.fontSize')
     * @returns {any} Configuration value
     */
    get(path) {
        const value = getByPath(this.effectiveConfig, path);
        if (value === undefined) {
            console.warn(`[Config] Unknown configuration path: ${path}`);
        }
        return value;
    }

    /**
     * Get entire configuration object
     */
    getAll() {
        return this.effectiveConfig;
    }

    /**
     * Check if a setting is overridden by embed configuration
     * @param {string} path - Dot-separated path
     * @returns {boolean} True if overridden by embed
     */
    isEmbedOverridden(path) {
        return hasPath(this.embedConfig, path);
    }

    /**
     * Check if a setting has been modified by user
     * @param {string} path - Dot-separated path
     * @returns {boolean} True if user has modified from default
     */
    isUserModified(path) {
        return hasPath(this.userSettings, path);
    }

    /**
     * Get the source of a setting
     * @param {string} path - Dot-separated path
     * @returns {'default'|'user'|'embed'} Source of the setting
     */
    getSource(path) {
        if (this.isEmbedOverridden(path)) {
            return 'embed';
        }
        if (this.isUserModified(path)) {
            return 'user';
        }
        return 'default';
    }

    /**
     * Set user setting (save to localStorage)
     * @param {string} path - Dot-separated path
     * @param {any} value - Value to set
     * @returns {boolean} True if saved successfully
     */
    setUserSetting(path, value) {
        // Don't allow setting if embed has overridden it
        if (this.isEmbedOverridden(path)) {
            console.warn(`[Config] Cannot set user preference for "${path}" - overridden by embed config`);
            return false;
        }

        // Update user settings
        setByPath(this.userSettings, path, value);

        // Save to localStorage
        this.saveUserSettings();

        // Rebuild effective config
        this.effectiveConfig = this.buildEffectiveConfig();

        console.log(`[Config] User setting saved: ${path} = ${JSON.stringify(value)}`);
        return true;
    }

    /**
     * Reset user setting to default
     * @param {string} path - Dot-separated path
     */
    resetUserSetting(path) {
        // Remove from user settings
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.userSettings;

        for (const key of keys) {
            if (!current[key]) return;
            current = current[key];
        }

        delete current[lastKey];

        // Save to localStorage
        this.saveUserSettings();

        // Rebuild effective config
        this.effectiveConfig = this.buildEffectiveConfig();

        console.log(`[Config] User setting reset: ${path}`);
    }

    /**
     * Reset all user settings
     */
    resetAllUserSettings() {
        this.userSettings = {};
        this.saveUserSettings();
        this.effectiveConfig = this.buildEffectiveConfig();
        console.log('[Config] All user settings reset to defaults');
    }

    /**
     * Load user settings from localStorage
     */
    loadUserSettings() {
        try {
            const storageKey = `${DEFAULT_CONFIG.advanced.storagePrefix}:config`;
            const saved = localStorage.getItem(storageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.warn('[Config] Failed to load user settings:', error);
            return {};
        }
    }

    /**
     * Save user settings to localStorage
     */
    saveUserSettings() {
        try {
            const storageKey = `${DEFAULT_CONFIG.advanced.storagePrefix}:config`;
            localStorage.setItem(storageKey, JSON.stringify(this.userSettings));
        } catch (error) {
            console.error('[Config] Failed to save user settings:', error);
        }
    }

    /**
     * Flatten nested object to dot-separated paths
     */
    flattenObject(obj, prefix = '') {
        const result = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const path = prefix ? `${prefix}.${key}` : key;
                if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                    Object.assign(result, this.flattenObject(obj[key], path));
                } else {
                    result[path] = obj[key];
                }
            }
        }
        return result;
    }

    /**
     * Get default value for a path
     */
    getDefault(path) {
        return getByPath(this.defaults, path);
    }

    /**
     * Export configuration as JSON (for debugging)
     */
    exportConfig() {
        return {
            defaults: this.defaults,
            userSettings: this.userSettings,
            embedConfig: this.embedConfig,
            effective: this.effectiveConfig
        };
    }
}

// ============================================================================
// Export
// ============================================================================

export { ConfigManager, DEFAULT_CONFIG };
