# Configuration System

## Overview

The CXone Expert Enhancements uses a hierarchical configuration system with cross-device preference sync via the Expert Properties API.

## Configuration Hierarchy

Settings are resolved in this order (highest to lowest priority):

1. **Embed Config** (locked) - Set via `data-config` attribute
2. **User Properties** (personal) - Synced across devices when logged in
3. **Site Properties** (defaults) - Admin-managed defaults for all users
4. **localStorage** (cache/fallback) - Works offline, anonymous users
5. **Hard-coded defaults** - Sensible defaults built-in

### Priority Visualization

```
Priority 1 (Highest): Embed Config (locked, deployment-level)
    ↓
Priority 2: User Properties (personal preferences, Expert API)
    ↓
Priority 3: Site Properties (admin defaults, Expert API)
    ↓
Priority 4 (Lowest): localStorage (cache + fallback)
    ↓
Hard-coded Defaults (from schema)
```

## Embed Configuration

Lock settings for your organization by adding a `data-config` attribute to the embed script.

### Basic Example

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

### Lock Down Theme and Format Settings

```html
<script
  src="https://releases.benelliot-nice.com/cxone-expert-enhancements/latest/embed.js"
  data-config='{
    "editor": {
      "theme": "vs-dark",
      "fontSize": 14,
      "wordWrap": true,
      "minimap": false
    },
    "formatting": {
      "indentSize": 2,
      "indentType": "spaces",
      "quoteStyle": "single"
    },
    "behavior": {
      "formatOnSave": true,
      "confirmBeforeDiscard": true
    }
  }'
></script>
```

When settings are locked via embed config:
- They cannot be overridden by user or site properties
- All users in your organization use the same settings
- Ensures consistent coding standards

## Available Settings

See full schema in `src/config-schema.js`. Key settings:

### Editor Settings

- `editor.theme` - vs-dark | vs-light | hc-black (default: vs-dark)
- `editor.fontSize` - 10-24px (default: 14)
- `editor.wordWrap` - true | false (default: false)
- `editor.minimap` - true | false (default: true)

### Formatting Settings

- `formatting.indentSize` - 2 | 4 | 8 (default: 2)
- `formatting.indentType` - spaces | tabs (default: spaces)
- `formatting.quoteStyle` - single | double (default: single)

### Behavior Settings

- `behavior.formatOnSave` - true | false (default: true)
- `behavior.confirmBeforeDiscard` - true | false (default: true)

## Cross-Device Sync

When logged in to CXone Expert, your preferences automatically sync across devices via the Expert Properties API.

### How It Works

**For Logged-In Users:**
1. Settings saved via `set()` are stored in Expert user properties
2. Properties sync to server automatically
3. Settings available on any device you log in from
4. Offline changes sync when connection restored

**For Anonymous Users:**
1. Settings saved to localStorage only
2. No cross-device sync
3. Settings persist in browser only
4. Site properties still apply as defaults

### User vs Site Properties

**User Properties:**
- Endpoint: `/@api/deki/users/{user}/properties/urn:expertEnhancements.user.*`
- Access: Own user only
- Use case: Personal cross-device sync
- Example: `urn:expertEnhancements.user.editor.theme`

**Site Properties:**
- Endpoint: `/@api/deki/site/properties/urn:expertEnhancements.site.*`
- Write access: Admin only
- Read access: All users
- Use case: Site-wide defaults
- Example: `urn:expertEnhancements.site.editor.theme`

### Security

**Secret Protection:**
Settings marked with `serverSafe: false` in the schema are never synced to the server:
- API keys
- Tokens
- Sensitive credentials

These settings remain in localStorage only.

## Browser Console API

Debug configuration in browser console:

### View Current Configuration

```javascript
// View current config
window.ExpertEnhancements.Config.debug()

// Export full config state
window.ExpertEnhancements.Config.export()

// Get a specific value
window.ExpertEnhancements.Config.instance.get('editor.theme')

// Get value with source tracking
window.ExpertEnhancements.Config.getSource('editor.theme')
// Returns: { value: 'vs-dark', source: 'embed', locked: true }
```

### Debug a Specific Setting

```javascript
// See full resolution path for a setting
window.ExpertEnhancements.Config.debug('editor.theme')

// Shows:
// - Embed Config value
// - User Properties value
// - Site Properties value
// - localStorage value
// - Default value
// - Effective value (which one won)
// - Source (where it came from)
// - Locked status
```

### Set User Preferences

```javascript
// Set a preference (auto-syncs if logged in)
await window.ExpertEnhancements.Config.instance.set('editor.fontSize', 16)

// Reset to default
await window.ExpertEnhancements.Config.instance.reset('editor.fontSize')
```

## Configuration Architecture

### ConfigManager

**Purpose:** Manage hierarchical configuration with cross-device sync

**Location:** `src/config-manager.js`

**Key Methods:**
- `get(key)` - Get effective value for a setting
- `set(key, value)` - Set user preference (with auto-sync)
- `reset(key)` - Reset to default
- `getEffectiveValue(key)` - Get value with source tracking
- `exportConfig()` - Export for debugging
- `debugConfig(key)` - Log resolution path

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
- `options` - Allowed values (for enums)
- `min/max` - Numeric constraints

## State Management

### Anonymous User Flow

1. Load site properties (if available)
2. Load localStorage preferences
3. Apply embed config overrides
4. Result: Site defaults + local preferences + embed locks

### Logged-In User Flow

1. Load site properties (admin defaults)
2. Load user properties from server
3. Cache to localStorage
4. Apply embed config overrides
5. Result: Site defaults + synced preferences + embed locks

### Login Transition

When user logs in:
- User properties loaded from server
- Override localStorage cache
- Settings from other devices now available

### Logout Transition

When user logs out:
- Continue using localStorage cache
- Settings preserved for next login
- Can still modify settings (localStorage only)

## Offline Support

The configuration system works offline:

1. **Initial Load:** Tries to fetch from server, falls back to localStorage cache
2. **Offline Operation:** All settings available from cache
3. **Set Operations:** Save to localStorage, queue server sync
4. **Reconnect:** Sync queued changes to server

## Troubleshooting

### Settings Not Persisting

Check browser console for localStorage errors. Some browsers block localStorage in private/incognito mode.

### Can't Change a Setting

If a setting is locked, it's controlled by embed configuration. Check the embed script tag's `data-config` attribute.

### Settings Not Syncing Across Devices

1. Verify you're logged in (not anonymous)
2. Check network tab for Properties API requests
3. Verify setting has `serverSafe: true` in schema
4. Check browser console for sync errors

### Different Settings on Different Devices

This can happen if:
- You have embed config on one site but not another
- Site properties differ between environments
- Sync hasn't completed yet (wait a few seconds)

### Export Configuration for Debugging

```javascript
const config = window.ExpertEnhancements.Config.export()
console.log(JSON.stringify(config, null, 2))
```

This shows:
- All hierarchy levels
- Effective config
- Current user info
- Cache status
- Last sync times

## Migration from Old System

If you were using the previous configuration system:

1. **Old localStorage keys** are preserved
2. **Settings UI** replaced with Properties API sync
3. **Embed config** syntax remains compatible
4. **No action required** - migration is automatic

## Examples

### Setting Site-Wide Defaults (Admin)

Admins can set site properties via API:

```bash
# Set site-wide theme default
curl -X PUT \
  "https://your-expert-site/@api/deki/site/properties/urn:expertEnhancements.site.editor.theme" \
  -H "Content-Type: application/json" \
  -d '"vs-light"' \
  --cookie "your-session-cookie"
```

### Checking Where a Setting Comes From

```javascript
const source = window.ExpertEnhancements.Config.getSource('editor.theme')
console.log(`Theme is "${source.value}" from ${source.source}`)
// Output: Theme is "vs-dark" from embed
```

### Testing Configuration Hierarchy

```javascript
// Clear localStorage to test
localStorage.clear()

// Set via user preference
await window.ExpertEnhancements.Config.instance.set('editor.fontSize', 16)

// Check where it came from
window.ExpertEnhancements.Config.debug('editor.fontSize')
```

## API Reference

### ConfigManager Instance

```javascript
const config = window.ExpertEnhancements.Config.instance
```

#### Methods

**`get(key: string): any`**
Get effective value for a setting.

**`set(key: string, value: any): Promise<void>`**
Set user preference. Auto-syncs to server if logged in and serverSafe.

**`reset(key: string): Promise<void>`**
Reset setting to default. Removes from localStorage and server.

**`getEffectiveValue(key: string): {value: any, source: string, locked: boolean}`**
Get value with source tracking.

**`exportConfig(): object`**
Export complete configuration state for debugging.

**`debugConfig(key: string): void`**
Log detailed resolution path for a setting.

### Global Helpers

**`window.ExpertEnhancements.Config.export()`**
Shortcut for `instance.exportConfig()`.

**`window.ExpertEnhancements.Config.getSource(key: string)`**
Shortcut for `instance.getEffectiveValue(key)`.

**`window.ExpertEnhancements.Config.debug(key?: string)`**
Debug configuration. If key provided, shows resolution for that setting. Otherwise shows full export.

## Best Practices

1. **Use embed config for organization-wide standards** - Lock settings that should be consistent
2. **Use site properties for sensible defaults** - Provide good defaults for your team
3. **Let users customize** - Don't lock everything, allow personalization
4. **Mark secrets as serverSafe: false** - Never sync API keys or tokens
5. **Test offline** - Ensure app works without network connection
6. **Export for debugging** - Use `Config.export()` to troubleshoot issues
