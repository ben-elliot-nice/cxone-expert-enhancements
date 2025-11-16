# Properties API & Persistent User Preferences Design

**Date:** 2025-11-15
**Issues:** #101, #106
**Status:** Design Complete - Ready for Implementation

## Overview

This design implements a four-tier hierarchical configuration system that provides:
- Organization-level locked settings (embed config)
- Site-wide admin-managed defaults (Properties API - site level)
- Personal user preferences with cross-device sync (Properties API - user level)
- Local fallback and caching (localStorage)

## Goals

1. **User preferences persist across sessions** - Users don't reconfigure every time
2. **Cross-device sync for logged-in users** - Settings follow users across devices
3. **Admin defaults for consistency** - Admins can set site-wide recommended settings
4. **Organization enforcement** - Embed config locks critical settings
5. **Works offline** - localStorage fallback ensures functionality without network
6. **Security by design** - Secrets never sync to server
7. **Graceful degradation** - Works in all scenarios (anonymous, logged-in, offline)

## Four-Tier Configuration Hierarchy

```
Priority 1 (Highest): Embed Config
    ↓ (if not set in embed)
Priority 2: Site Properties (Expert Properties API - site level)
    ↓ (if not set by admin)
Priority 3: User Properties (Expert Properties API - user level)
    ↓ (if not set by user)
Priority 4 (Lowest): localStorage
    ↓ (if not in cache)
Hard-coded Defaults
```

### Resolution Algorithm

```javascript
function getEffectiveValue(key) {
  // 1. Embed config (highest priority, locked)
  if (embedConfig.has(key)) {
    return { value: embedConfig.get(key), source: 'embed', locked: true };
  }

  // 2. User properties (personal preference, synced)
  if (userProperties.has(key)) {
    return { value: userProperties.get(key), source: 'user', locked: false };
  }

  // 3. Site properties (admin default)
  if (siteProperties.has(key)) {
    return { value: siteProperties.get(key), source: 'site', locked: false };
  }

  // 4. localStorage cache/fallback
  if (localStorage.has(key)) {
    return { value: localStorage.get(key), source: 'localStorage', locked: false };
  }

  // 5. Hard-coded default
  return { value: defaults.get(key), source: 'default', locked: false };
}
```

## Permission Model

### Embed Config
- **Set by:** Organization/deployment (data-config attribute on script tag)
- **Access:** Read-only at runtime
- **Scope:** All users on the site
- **Use case:** Lock settings that affect compliance, branding, or critical functionality

### Site Properties
- **Stored at:** `/@api/deki/site/properties/urn:expertEnhancements.site.*`
- **Write access:** Admin users only (`window.Deki.UserPermissions` includes 'ADMIN')
- **Read access:** All users (including anonymous)
- **Scope:** All users on the site
- **Use case:** Recommended defaults that users can override (e.g., "we recommend 2-space indent")

### User Properties
- **Stored at:** `/@api/deki/users/{username}/properties/urn:expertEnhancements.user.*`
- **Write access:** Own user only
- **Read access:** Own user only (cannot access other users' properties)
- **Scope:** Individual user across all devices
- **Use case:** Personal preferences that sync across devices

### localStorage
- **Key prefix:** `expertEnhancements:config:*`
- **Access:** Browser-level (all users on same browser)
- **Scope:** Per-browser, per-site
- **Use case:**
  - Cache for Properties API data (faster reads)
  - Fallback when API unavailable (offline mode)
  - Anonymous user preferences
  - Local-only secrets (API keys for future integrations)

## Settings Schema

Each setting is defined with metadata:

```javascript
const settingsSchema = {
  'editor.theme': {
    type: 'string',
    default: 'vs-dark',
    serverSafe: true,  // ✅ Can sync to Properties API
    category: 'editor',
    label: 'Editor Theme',
    options: ['vs-dark', 'vs-light', 'hc-black']
  },

  'editor.fontSize': {
    type: 'number',
    default: 14,
    serverSafe: true,  // ✅ Can sync to Properties API
    category: 'editor',
    label: 'Font Size',
    min: 10,
    max: 24
  },

  'formatting.indentSize': {
    type: 'number',
    default: 2,
    serverSafe: true,  // ✅ Can sync to Properties API
    category: 'formatting',
    label: 'Indent Size',
    options: [2, 4, 8]
  },

  'apiKeys.s3AccessKey': {
    type: 'string',
    default: null,
    serverSafe: false,  // ❌ LOCAL ONLY - never sync to server
    sensitive: true,
    category: 'advanced',
    label: 'S3 Access Key (for future integrations)',
    hidden: false  // Show in Settings UI (future)
  },

  'cache.monacoLoaded': {
    type: 'boolean',
    default: false,
    serverSafe: false,  // ❌ Runtime cache only
    category: 'internal',
    hidden: true  // Don't show in Settings UI
  }
};
```

### Schema Properties

- **type:** Data type for validation
- **default:** Default value if not set
- **serverSafe:** Can this be synced to Properties API?
  - `true`: Sync to User/Site Properties
  - `false`: localStorage ONLY (secrets, runtime cache)
- **sensitive:** Should value be masked in UI? (future Settings UI)
- **category:** Grouping for Settings UI (future)
- **label:** Human-readable name (future)
- **hidden:** Hide from Settings UI (internal/runtime values)
- **options:** Allowed values (for dropdowns/validation)
- **min/max:** Numeric constraints

## Property Naming Convention

Use URN format with dot-notation for hierarchical structure:

### Site Properties
```
urn:expertEnhancements.site.editor.theme = "vs-dark"
urn:expertEnhancements.site.formatting.indentSize = 2
urn:expertEnhancements.site.behavior.formatOnSave = true
```

### User Properties
```
urn:expertEnhancements.user.editor.theme = "vs-light"
urn:expertEnhancements.user.editor.fontSize = 16
urn:expertEnhancements.user.overlay.lastWidth = 1200
```

**Why URN format?**
- Clear namespace isolation (prevents collisions with other systems)
- Hierarchical structure mirrors config object
- Easy to query all properties: `GET /@api/deki/site/properties` returns all, filter by prefix
- Follows Expert API conventions

## User State Detection

Use `window.Deki` object (available in CXone Expert):

```javascript
detectUser() {
  if (!window.Deki) {
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
    systemName: window.Deki.UserSystemName, // Use for API calls
    permissions: window.Deki.UserPermissions || [],
    isAdmin: window.Deki.UserPermissions?.includes('ADMIN') || false
  };
}
```

## Authentication Strategy

**Use existing CXone session authentication** (same as current CSS/HTML editor saves):
- Session cookies and CSRF tokens
- No separate API key management for Properties API
- Leverages existing authenticated context

**Note:** API keys in settings schema are for FUTURE integrations (S3, external services), NOT for Properties API.

## Login/Logout State Management

### Anonymous User Flow

```javascript
async loadAnonymousConfig() {
  // 1. Start with defaults
  this.config = { ...defaultConfig };

  // 2. Load site properties (anonymous can READ)
  try {
    const siteProps = await this.loadSiteProperties();
    this.mergeConfig(siteProps, 'site');
  } catch (error) {
    console.warn('Could not load site properties', error);
  }

  // 3. Load localStorage (anonymous user's preferences)
  const localConfig = this.loadFromLocalStorage();
  this.mergeConfig(localConfig, 'localStorage');

  // 4. Apply embed config overrides (highest priority)
  this.mergeConfig(this.embedConfig, 'embed');
}
```

### Logged-In User Flow

```javascript
async loadLoggedInConfig() {
  // 1. Start with defaults
  this.config = { ...defaultConfig };

  // 2. Load site properties (admin defaults)
  try {
    const siteProps = await this.loadSiteProperties();
    this.mergeConfig(siteProps, 'site');
  } catch (error) {
    console.warn('Could not load site properties', error);
  }

  // 3. Load User Properties from server
  try {
    const userProps = await this.loadUserProperties(this.currentUser.systemName);
    this.mergeConfig(userProps, 'user');
  } catch (error) {
    console.warn('Could not load user properties', error);
  }

  // 4. Load localStorage (cache + fallback)
  const localConfig = this.loadFromLocalStorage();
  // Don't merge - localStorage is just cache at this point

  // 5. Cache User Properties to localStorage for offline/logout
  this.cacheToLocalStorage(this.config);

  // 6. Apply embed config overrides (highest priority)
  this.mergeConfig(this.embedConfig, 'embed');
}
```

### Login/Logout Transitions

**Anonymous → Logs In:**
```javascript
async handleUserLogin(userId) {
  // Load User Properties from server
  const userProps = await this.loadUserProperties(userId);

  // Reload config with new user context
  await this.loadLoggedInConfig();

  // No promotion needed - fresh start approach
  // Users reconfigure if needed (good defaults minimize this)
}
```

**Logged In → Logs Out:**
```javascript
async handleUserLogout() {
  // User Properties already cached in localStorage
  // Continue using cached preferences
  this.currentUser = { isLoggedIn: false, isAnonymous: true };
  await this.loadAnonymousConfig();

  // User keeps their settings via localStorage cache
}
```

**User Edits While Logged Out:**
```javascript
async setUserSetting(key, value) {
  // Save to localStorage (works offline)
  this.saveToLocalStorage(key, value);

  // When user logs back in, they can manually re-sync if desired
  // (localStorage preserves their work)
}
```

## Caching Strategy

### Multi-Level Cache

```javascript
this.cache = {
  siteProperties: null,      // In-memory cache
  userProperties: null,      // In-memory cache
  lastSiteSync: 0,           // Last sync timestamp
  lastUserSync: 0,           // Last sync timestamp
  syncInterval: 5 * 60 * 1000 // 5 minutes
};
```

### Load Flow with Caching

```javascript
async loadSiteProperties() {
  const now = Date.now();

  // 1. Check in-memory cache (fastest)
  if (this.cache.siteProperties &&
      (now - this.cache.lastSiteSync) < this.cache.syncInterval) {
    return this.cache.siteProperties;
  }

  // 2. Fetch from server
  try {
    const response = await fetch('/@api/deki/site/properties');
    if (response.ok) {
      const parsed = this.parseSiteProperties(await response.json());

      // Update in-memory cache
      this.cache.siteProperties = parsed;
      this.cache.lastSiteSync = now;

      // Update localStorage cache
      localStorage.setItem('expertEnhancements:cache:siteProperties',
        JSON.stringify({ data: parsed, timestamp: now }));

      return parsed;
    }
  } catch (error) {
    console.warn('Server unavailable, using localStorage cache', error);
  }

  // 3. Fall back to localStorage cache
  const cached = localStorage.getItem('expertEnhancements:cache:siteProperties');
  if (cached) {
    const { data } = JSON.parse(cached);
    return data;
  }

  return {};
}
```

### Benefits

1. **Fast:** In-memory cache = instant reads
2. **Resilient:** localStorage fallback works offline
3. **Fresh:** Auto-refreshes every 5 minutes
4. **Efficient:** Minimizes API calls

## API Response Parsing

Properties API returns XML/JSON format. Extract our namespaced properties:

```javascript
parseSiteProperties(apiResponse) {
  const properties = {};
  const props = apiResponse.property || apiResponse['@properties'] || [];

  for (const prop of props) {
    const name = prop['@name'] || prop.name;

    // Only process our namespaced properties
    if (name?.startsWith('urn:expertEnhancements.site.')) {
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
```

## Setting Values

### User Setting (Personal Preference)

```javascript
async setUserSetting(key, value) {
  const schema = settingsSchema[key];

  if (!schema) {
    throw new Error(`Unknown setting: ${key}`);
  }

  // 1. Always save to localStorage first (immediate, works offline)
  this.saveToLocalStorage(key, value);

  // 2. Update in-memory config
  this.config[key] = value;

  // 3. Sync to server if logged in AND serverSafe
  if (!this.currentUser.isAnonymous && schema.serverSafe) {
    try {
      await this.saveUserProperty(this.currentUser.systemName, key, value);
      console.log(`Synced ${key} to server`);
    } catch (error) {
      console.warn(`Server sync failed for ${key}, saved locally only`, error);
      // Not fatal - localStorage already has it
    }
  }
}
```

### Site Setting (Admin Default)

```javascript
async setSiteSetting(key, value) {
  const user = this.detectUser();

  // Only admins can set site properties
  if (!user.isAdmin) {
    throw new Error('Only administrators can modify site properties');
  }

  const schema = settingsSchema[key];

  if (!schema?.serverSafe) {
    throw new Error(`Setting ${key} cannot be saved to server`);
  }

  const propertyName = `urn:expertEnhancements.site.${key}`;

  await fetch(`/@api/deki/site/properties/${encodeURIComponent(propertyName)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
      // Session authentication (cookies/CSRF) handled by browser
    },
    body: JSON.stringify(value)
  });

  // Invalidate cache to force refresh
  this.cache.siteProperties = null;
  this.cache.lastSiteSync = 0;
}
```

## Reset to Default

When user resets a setting:

```javascript
async resetUserSetting(key) {
  const user = this.detectUser();

  // 1. Remove from localStorage
  localStorage.removeItem(`expertEnhancements:config:${key}`);

  // 2. Delete from User Properties (if logged in and serverSafe)
  if (!user.isAnonymous && settingsSchema[key]?.serverSafe) {
    try {
      const propertyName = `urn:expertEnhancements.user.${key}`;
      await fetch(
        `/@api/deki/users/${encodeURIComponent(user.systemName)}/properties/${encodeURIComponent(propertyName)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      console.warn('Failed to delete from server', error);
    }
  }

  // 3. Reload effective value (falls through hierarchy to default)
  this.config[key] = this.getEffectiveValue(key).value;
}
```

**Why delete instead of setting to default?**
- Smaller storage footprint
- If hard-coded default ever changes, user gets new default
- Falls through to site properties (if admin set a site default)

## Migration Strategy

**Fresh start approach** - No migration of existing config:
- New config system is separate from old
- Users will reconfigure if needed (most settings have good defaults)
- Simpler implementation
- Cleaner separation

**Rationale:** No users currently using the recently implemented config system yet.

## Sync Strategy

**Immediate sync on change:**
```javascript
async setUserSetting(key, value) {
  this.saveToLocalStorage(key, value);  // Immediate
  await this.syncToServer(key, value);   // Immediate, don't wait
}
```

**Why immediate?**
- Settings change infrequently (not performance-critical)
- Simpler than debouncing
- User gets immediate feedback (success/failure)
- No risk of lost changes if page closes

## Implementation Scope

### In Scope

✅ **Config Manager Class**
- Four-tier resolution algorithm
- Get/set methods with hierarchy awareness
- User state detection (window.Deki)
- Caching layer (memory + localStorage)

✅ **Properties API Integration**
- Read/write site properties
- Read/write user properties
- Parse API responses
- Session-based authentication

✅ **Settings Schema**
- Define all settings with metadata
- serverSafe flags for security
- Type information for validation
- Support for future API keys (local-only)

✅ **State Management**
- Login/logout transitions
- Anonymous vs logged-in flows
- Offline fallback

### Out of Scope (Future Work)

❌ **Settings UI**
- Visual interface for editing settings
- Locked/modified indicators
- Admin controls for site properties
- Future enhancement (#101 continuation)

❌ **API Key Management UI**
- Interface for entering S3/external API keys
- Connection testing
- Future when needed for integrations

## File Structure

```
src/
├── config-schema.js          # Settings schema definitions
├── config-manager.js         # Main ConfigManager class
└── config.js                 # Legacy - will be replaced

docs/
└── plans/
    └── 2025-11-15-properties-api-persistent-preferences-design.md
```

## Testing Considerations

### Test Coverage Needed

1. **Hierarchy resolution**
   - Embed config takes precedence
   - User property overrides site property
   - Site property overrides default
   - localStorage fallback works

2. **User state transitions**
   - Anonymous user config loading
   - Logged-in user config loading
   - Login transition (anonymous → logged in)
   - Logout transition (logged in → anonymous)

3. **Caching**
   - In-memory cache hit
   - Cache expiration triggers reload
   - localStorage fallback on network error
   - Cache invalidation on write

4. **Properties API**
   - Read site properties (all users)
   - Write site properties (admin only)
   - Read user properties (own only)
   - Write user properties (own only)
   - Permission denied handling

5. **Security**
   - serverSafe=false settings never sync to server
   - API keys stay in localStorage only
   - User cannot access other users' properties

6. **Edge cases**
   - window.Deki unavailable
   - Network offline
   - localStorage quota exceeded
   - Invalid API responses
   - Concurrent tab updates

## Success Metrics

1. **User preferences persist across sessions** ✅
2. **Cross-device sync works for logged-in users** ✅
3. **Anonymous users have functional local preferences** ✅
4. **Admins can set site-wide defaults** ✅
5. **System works offline** ✅
6. **No secrets leak to server** ✅
7. **Performance: <100ms config reads** (from cache) ✅

## Future Enhancements

1. **Settings UI** (#101 continuation)
   - Visual interface with categories
   - Locked/modified/default indicators
   - "Save as site default" for admins
   - Import/export configuration

2. **Real-time sync**
   - WebSocket updates when another tab changes settings
   - Broadcast channel for cross-tab sync

3. **Conflict resolution**
   - Detect concurrent edits across devices
   - Last-write-wins or merge strategies

4. **Configuration profiles**
   - Multiple named profiles per user
   - Quick switching between profiles
   - Team-shared profiles

5. **Audit logging**
   - Track who changed what settings when
   - Compliance/security tracking

## Related Issues

- #101: Persistent User Preferences (parent issue)
- #106: Migrate to Properties API (parent issue)
- #48: Extract hard-coded config (relates to config system)
- #98: Max tabs config bug (will use new config system)

## References

- Properties API test suite: `tests/api/suites/properties-permissions.test.js`
- API client implementation: `tests/api/lib/api-client.js`
- Current config system: `src/config.js` (to be replaced)
- Permission test results: `tests/api/reports/properties-permissions-*.json`
