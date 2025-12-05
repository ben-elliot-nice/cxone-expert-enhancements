/**
 * Settings schema definition for the four-tier configuration system.
 * The schema is generated from the default settings object and augmented
 * with optional metadata (serverSafe, options, min/max).
 */

const DEFAULT_SETTINGS = {
    behavior: {
        formatOnSave: true,
        autoSaveEnabled: false,
        autoSaveInterval: 30000,
        livePreviewEnabled: false,
        confirmBeforeDiscard: true
    },
    editor: {
        theme: 'vs-dark',
        fontSize: 14,
        tabSize: 2,
        wordWrap: 'on',
        minimapEnabled: true,
        scrollBeyondLastLine: false,
        indentStyle: 'spaces',
        quoteStyle: 'single',
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
        loadingTimeout: 30000,
        toastDuration: 4000,
        livePreviewDebounce: 300,
        formatterTimeout: 60000
    },
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
        toggleButtonPosition: 'top-right',
        toastColors: {
            success: 'rgba(34, 197, 94, 0.8)',
            warning: 'rgba(251, 146, 60, 0.8)',
            error: 'rgba(239, 68, 68, 0.8)',
            info: 'rgba(59, 130, 246, 0.8)'
        }
    },
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
            idleOpacity: 0,
            lineStyle: {
                defaultWidth: 2,
                hoverWidth: 3,
                activeWidth: 4,
                defaultOpacity: 0.15,
                hoverOpacity: 0.5,
                activeOpacity: 0.8,
                glowBlur: 8,
                glowBlurActive: 12
            }
        },
        toasts: {
            maxVisible: 3,
            stackGap: 10,
            positionRight: 20,
            positionBottom: 20
        }
    }
};

const SCHEMA_OVERRIDES = {
    'editor.theme': { options: ['vs-dark', 'vs-light'], serverSafe: true },
    'editor.wordWrap': { options: ['on', 'off', 'wordWrapColumn', 'bounded'] },
    'editor.indentStyle': { options: ['spaces', 'tabs'] },
    'editor.quoteStyle': { options: ['single', 'double'] },
    'appearance.toggleButtonPosition': { options: ['top-right', 'top-left', 'bottom-right', 'bottom-left'] },
    'advanced.cdnUrls.monaco': { serverSafe: false },
    'advanced.cdnUrls.prettier': { serverSafe: false },
    'advanced.cdnUrls.prettierCSS': { serverSafe: false },
    'advanced.cdnUrls.prettierHTML': { serverSafe: false },
    'advanced.storagePrefix': { serverSafe: false }
};

function inferType(value) {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'object';
    return typeof value;
}

function flattenDefaults(obj, prefix = '') {
    const result = {};
    Object.keys(obj).forEach(key => {
        const path = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenDefaults(value, path));
        } else {
            result[path] = value;
        }
    });
    return result;
}

const DEFAULTS_FLAT = flattenDefaults(DEFAULT_SETTINGS);

const CONFIG_SCHEMA = Object.entries(DEFAULTS_FLAT).reduce((schema, [key, value]) => {
    const category = key.split('.')[0];
    const override = SCHEMA_OVERRIDES[key] || {};
    schema[key] = {
        key,
        category,
        default: value,
        type: override.type || inferType(value),
        serverSafe: override.serverSafe !== undefined ? override.serverSafe : category !== 'advanced',
        options: override.options,
        min: override.min,
        max: override.max,
        description: override.description
    };
    return schema;
}, {});

export { CONFIG_SCHEMA, DEFAULT_SETTINGS, DEFAULTS_FLAT, flattenDefaults };
