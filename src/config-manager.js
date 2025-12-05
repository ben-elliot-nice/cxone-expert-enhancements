import { CONFIG_SCHEMA, DEFAULT_SETTINGS, DEFAULTS_FLAT } from './config-schema.js';

const DEFAULT_STORAGE_KEY = `${DEFAULTS_FLAT['advanced.storagePrefix'] || 'expertEnhancements'}:config`;
const USER_URN_PREFIX = 'urn:expertEnhancements.user.';
const SITE_URN_PREFIX = 'urn:expertEnhancements.site.';

function flattenObject(obj, prefix = '') {
    if (!obj || typeof obj !== 'object') return {};
    const result = {};
    Object.keys(obj).forEach(key => {
        const path = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, path));
        } else {
            result[path] = value;
        }
    });
    return result;
}

function unflattenObject(flat) {
    const result = {};
    Object.entries(flat || {}).forEach(([path, value]) => {
        const parts = path.split('.');
        let cursor = result;
        parts.forEach((segment, idx) => {
            if (idx === parts.length - 1) {
                cursor[segment] = value;
                return;
            }
            if (!cursor[segment] || typeof cursor[segment] !== 'object') {
                cursor[segment] = {};
            }
            cursor = cursor[segment];
        });
    });
    return result;
}

function setNestedValue(target, path, value) {
    const parts = path.split('.');
    let cursor = target;
    parts.forEach((segment, idx) => {
        if (idx === parts.length - 1) {
            cursor[segment] = value;
            return;
        }
        if (!cursor[segment] || typeof cursor[segment] !== 'object') {
            cursor[segment] = {};
        }
        cursor = cursor[segment];
    });
}

function safeParse(json, fallback = {}) {
    try {
        return JSON.parse(json);
    } catch {
        return fallback;
    }
}

function normalizeFlat(input) {
    if (!input) return {};
    const hasNestedObject = Object.values(input).some(v => v && typeof v === 'object' && !Array.isArray(v));
    const hasDotKeys = Object.keys(input).some(k => k.includes('.'));
    if (hasDotKeys && !hasNestedObject) {
        return { ...input };
    }
    return flattenObject(input);
}

function urnFromKey(key, scope) {
    const prefix = scope === 'site' ? SITE_URN_PREFIX : USER_URN_PREFIX;
    return `${prefix}${key}`;
}

function keyFromUrn(urn) {
    if (!urn) return null;
    return urn.replace(/^urn:expertEnhancements\.(site|user)\./, '');
}

function typeMatches(expected, value) {
    if (expected === 'array') return Array.isArray(value);
    if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    return typeof value === expected;
}

class ConfigManager {
    constructor(options = {}) {
        this.schema = options.schema || CONFIG_SCHEMA;
        this.defaultsFlat = Object.entries(this.schema).reduce((acc, [key, meta]) => {
            acc[key] = meta.default;
            return acc;
        }, {});
        this.defaults = DEFAULT_SETTINGS;
        this.fetchImpl = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
        this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
        this.storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
        this.disableNetwork = Boolean(options.disableNetwork);

        this.embedConfigFlat = options.embedConfig ? normalizeFlat(options.embedConfig) : {};
        this.embedConfig = unflattenObject(this.embedConfigFlat);
        this.siteProperties = options.siteProperties ? normalizeFlat(options.siteProperties) : {};
        this.userProperties = options.userProperties ? normalizeFlat(options.userProperties) : {};
        this.localCache = {};
        this.resolvedCache = {};
        this.userId = options.userId || null;
    }

    async init(options = {}) {
        if (options.embedConfig) {
            this.embedConfigFlat = normalizeFlat(options.embedConfig);
        } else if (!Object.keys(this.embedConfigFlat).length) {
            this.embedConfigFlat = this.parseEmbedConfig();
        }
        this.embedConfig = unflattenObject(this.embedConfigFlat);

        this.userId = options.userId || this.userId || null;

        this.localCache = this.loadLocalCache();

        if (options.siteProperties) {
            this.siteProperties = normalizeFlat(options.siteProperties);
        } else {
            this.siteProperties = await this.fetchSiteProperties();
        }

        if (this.userId) {
            if (options.userProperties) {
                this.userProperties = normalizeFlat(options.userProperties);
            } else {
                this.userProperties = await this.fetchUserProperties(this.userId);
            }
        } else {
            this.userProperties = {};
        }

        this.recomputeResolved();
    }

    parseEmbedConfig() {
        if (typeof document === 'undefined') return {};

        const findConfigAttr = () => {
            if (document.currentScript && document.currentScript.hasAttribute('data-config')) {
                return document.currentScript.getAttribute('data-config');
            }

            const scripts = document.getElementsByTagName('script');
            const configScript = Array.from(scripts).find(s => s.hasAttribute('data-config'));
            if (configScript) return configScript.getAttribute('data-config');

            const embedScript = Array.from(scripts).find(s =>
                s.src && (s.src.includes('embed') || s.src.includes('expert-enhancements'))
            );
            if (embedScript && embedScript.hasAttribute('data-config')) {
                return embedScript.getAttribute('data-config');
            }

            return null;
        };

        const raw = findConfigAttr();
        if (!raw) return {};

        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return normalizeFlat(parsed);
        } catch (error) {
            console.warn('[ConfigManager] Failed to parse embed config', error);
            return {};
        }
    }

    loadLocalCache() {
        if (!this.storage) return {};
        try {
            const raw = this.storage.getItem(this.storageKey);
            if (!raw) return {};
            const parsed = safeParse(raw, {});
            if (parsed && parsed.values) {
                return normalizeFlat(parsed.values);
            }
            return normalizeFlat(parsed);
        } catch (error) {
            console.warn('[ConfigManager] Failed to load local cache', error);
            return {};
        }
    }

    saveLocalCache() {
        if (!this.storage) return;
        try {
            const payload = {
                values: this.localCache,
                updatedAt: Date.now()
            };
            this.storage.setItem(this.storageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('[ConfigManager] Failed to persist local cache', error);
        }
    }

    async fetchSiteProperties() {
        if (this.disableNetwork) return {};
        if (!this.fetchImpl) return {};
        try {
            const response = await this.fetchImpl('/@api/deki/site/properties?filter=urn:expertEnhancements.site.');
            if (!response || !response.ok) return {};
            const data = await response.json();
            return this.parsePropertiesList(data);
        } catch {
            return {};
        }
    }

    async fetchUserProperties(userId) {
        if (this.disableNetwork) return {};
        if (!this.fetchImpl || !userId) return {};
        try {
            const response = await this.fetchImpl(`/@api/deki/users/${userId}/properties?filter=urn:expertEnhancements.user.`);
            if (!response || !response.ok) return {};
            const data = await response.json();
            return this.parsePropertiesList(data);
        } catch {
            return {};
        }
    }

    parsePropertiesList(data) {
        if (!data) return {};
        const props = {};
        const list = Array.isArray(data.properties) ? data.properties : data;
        list.forEach(entry => {
            const key = keyFromUrn(entry.name || entry.urn || entry.key);
            if (!key) return;
            const contentType = entry.contentType || entry['content-type'] || '';
            let value = entry.value ?? entry.contents ?? entry.content ?? null;
            if (contentType.includes('json') && typeof value === 'string') {
                value = safeParse(value, null);
            }
            if (value !== null && value !== undefined) {
                props[key] = value;
            }
        });
        return props;
    }

    validate(key, value) {
        const entry = this.schema[key];
        if (!entry) {
            return { ok: false, error: `Unknown setting: ${key}` };
        }

        if (!typeMatches(entry.type, value)) {
            return { ok: false, error: `Invalid type for ${key}. Expected ${entry.type}` };
        }

        if (entry.options && !entry.options.includes(value)) {
            return { ok: false, error: `Invalid value for ${key}. Allowed: ${entry.options.join(', ')}` };
        }

        if (typeof entry.min === 'number' && typeof value === 'number' && value < entry.min) {
            return { ok: false, error: `Value for ${key} below minimum ${entry.min}` };
        }

        if (typeof entry.max === 'number' && typeof value === 'number' && value > entry.max) {
            return { ok: false, error: `Value for ${key} above maximum ${entry.max}` };
        }

        return { ok: true };
    }

    resolve(key) {
        if (this.resolvedCache[key]) return this.resolvedCache[key];
        const result = { value: undefined, source: 'unknown', locked: false };

        if (this.embedConfigFlat.hasOwnProperty(key)) {
            result.value = this.embedConfigFlat[key];
            result.source = 'embed';
            result.locked = true;
            this.resolvedCache[key] = result;
            return result;
        }

        if (this.userProperties.hasOwnProperty(key)) {
            result.value = this.userProperties[key];
            result.source = 'user';
            this.resolvedCache[key] = result;
            return result;
        }

        if (this.siteProperties.hasOwnProperty(key)) {
            result.value = this.siteProperties[key];
            result.source = 'site';
            this.resolvedCache[key] = result;
            return result;
        }

        if (this.localCache.hasOwnProperty(key)) {
            result.value = this.localCache[key];
            result.source = 'local';
            this.resolvedCache[key] = result;
            return result;
        }

        const composed = this.composeFromChildren(key);
        if (composed) {
            this.resolvedCache[key] = composed;
            return composed;
        }

        result.value = this.getDefault(key);
        result.source = 'default';
        this.resolvedCache[key] = result;
        return result;
    }

    composeFromChildren(prefix) {
        const childKeys = Object.keys(this.schema).filter(k => k.startsWith(`${prefix}.`));
        if (!childKeys.length) return null;

        const priority = ['embed', 'user', 'site', 'local', 'default', 'unknown'];
        let chosenSource = 'default';
        let locked = this.isEmbedOverridden(prefix);
        const value = {};

        childKeys.forEach(childKey => {
            const childMeta = this.resolve(childKey);
            setNestedValue(value, childKey.slice(prefix.length + 1), childMeta.value);

            if (priority.indexOf(childMeta.source) < priority.indexOf(chosenSource)) {
                chosenSource = childMeta.source;
            }
            locked = locked || childMeta.locked;
        });

        return { value, source: chosenSource, locked };
    }

    recomputeResolved() {
        this.resolvedCache = {};
        const keys = new Set([
            ...Object.keys(this.schema),
            ...Object.keys(this.embedConfigFlat),
            ...Object.keys(this.siteProperties),
            ...Object.keys(this.userProperties),
            ...Object.keys(this.localCache)
        ]);

        keys.forEach(key => this.resolve(key));
    }

    get(path) {
        return this.resolve(path)?.value;
    }

    getSource(path) {
        return this.resolve(path)?.source || 'unknown';
    }

    getDefault(path) {
        return this.defaultsFlat[path];
    }

    isEmbedOverridden(path) {
        return this.embedConfigFlat.hasOwnProperty(path);
    }

    isUserModified(path) {
        return this.userProperties.hasOwnProperty(path) || this.localCache.hasOwnProperty(path);
    }

    async setUserSetting(path, value) {
        const validation = this.validate(path, value);
        if (!validation.ok) {
            return { success: false, error: validation.error };
        }

        if (this.isEmbedOverridden(path)) {
            return { success: false, error: 'Setting is locked by embed configuration' };
        }

        const entry = this.schema[path];
        const shouldSync = Boolean(entry.serverSafe && this.userId);

        let synced = false;
        let error = null;

        if (shouldSync) {
            this.userProperties[path] = value;
        } else {
            delete this.userProperties[path];
        }

        this.localCache[path] = value;
        this.saveLocalCache();

        if (shouldSync) {
            try {
                synced = await this.putUserProperty(path, value);
            } catch (err) {
                error = err.message;
            }
        }

        this.recomputeResolved();

        return {
            success: true,
            synced,
            source: shouldSync ? 'user' : 'local',
            error: synced ? null : error
        };
    }

    async putUserProperty(key, value) {
        if (this.disableNetwork) return false;
        if (!this.fetchImpl || !this.userId) return false;
        const urn = urnFromKey(key, 'user');
        const response = await this.fetchImpl(`/@api/deki/users/${this.userId}/properties/${encodeURIComponent(urn)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Accept: 'application/json'
            },
            body: JSON.stringify(value)
        });
        return response.ok;
    }

    async resetUserSetting(path) {
        if (!this.schema[path]) {
            return { success: false, error: `Unknown setting: ${path}` };
        }

        if (this.isEmbedOverridden(path)) {
            return { success: false, error: 'Setting is locked by embed configuration' };
        }

        const entry = this.schema[path];
        const shouldSync = Boolean(entry?.serverSafe && this.userId);
        let synced = false;
        let error = null;

        delete this.userProperties[path];
        delete this.localCache[path];
        this.saveLocalCache();

        if (shouldSync) {
            try {
                synced = await this.deleteUserProperty(path);
            } catch (err) {
                error = err.message;
            }
        }

        this.recomputeResolved();

        return {
            success: true,
            synced,
            error
        };
    }

    async deleteUserProperty(key) {
        if (this.disableNetwork) return false;
        if (!this.fetchImpl || !this.userId) return false;
        const urn = urnFromKey(key, 'user');
        const response = await this.fetchImpl(`/@api/deki/users/${this.userId}/properties/${encodeURIComponent(urn)}`, {
            method: 'DELETE'
        });
        return response.ok;
    }

    resetAllUserSettings() {
        this.userProperties = {};
        this.localCache = {};
        this.saveLocalCache();
        this.recomputeResolved();
    }

    flattenObject(obj, prefix = '') {
        return flattenObject(obj, prefix);
    }

    exportConfig() {
        const resolvedFlat = {};
        Object.keys(this.resolvedCache).forEach(key => {
            resolvedFlat[key] = this.resolvedCache[key];
        });

        return {
            defaults: DEFAULT_SETTINGS,
            schema: this.schema,
            embedConfig: unflattenObject(this.embedConfigFlat),
            siteProperties: this.siteProperties,
            userProperties: this.userProperties,
            localCache: this.localCache,
            resolved: resolvedFlat,
            effective: unflattenObject(
                Object.fromEntries(Object.entries(resolvedFlat).map(([key, meta]) => [key, meta.value]))
            )
        };
    }
}

export { ConfigManager, flattenObject, unflattenObject };
