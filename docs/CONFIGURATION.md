# Configuration System

## Overview

The CXone Expert Enhancements now features a comprehensive configuration system with hierarchical settings management:

```
Defaults → User Settings (UI) → Embed Config (highest priority)
```

## Features

✅ **Zero-config by default** - Works out of the box with sensible defaults
✅ **User-configurable via Settings UI** - Users can customize behavior, appearance, and performance
✅ **Embed-level overrides** - Administrators can lock settings via embed configuration
✅ **Visual indicators** - Shows which settings are locked or modified
✅ **Collapsible sections** - Organized by category (Behavior, Editor, Files, Overlay, Performance, Appearance, Advanced)
✅ **Reset functionality** - Reset individual settings or all settings to defaults
✅ **Export configuration** - Export current config to JSON for debugging

## Configuration Structure

### Priority 1: Behavioral Settings (User-Facing)

**Editor Behavior** ⚙️
- Format on save
- Confirm before discard
- Auto-save (future)

**Editor Appearance** ✏️
- Theme (Dark/Light)
- Font size (10-24px)
- Tab size (2/4/8 spaces)
- Indentation style (Spaces/Tabs)
- Quote style (Single/Double)
- Minimap enabled
- Word wrap

**File Operations** 📂
- Maximum file size (1-50 MB)
- Allowed extensions

**Overlay & Layout** 🖼️
- Default width/height
- Remember position
- Remember size

**Performance** ⚡
- Loading timeout (5-120s)
- Toast notification duration (1-10s)
- Live preview debounce delay (100-2000ms)

### Priority 2: Appearance Settings

**Colors & Theme** 🎨
- Primary color
- Header color
- Toast notification colors (future)

### Priority 3: Advanced/Debug Settings

**Advanced & Debug** 🔧
- LocalStorage prefix
- Monaco CDN URL
- Prettier CDN URLs
- Z-index layers
- Animation timings
- Breakpoints

## Using Embed Configuration

### Basic Example

```html
<script
  src="https://your-cdn.com/expert-enhancements-embed.js"
  data-config='{
    "editor": {
      "theme": "vs-light",
      "fontSize": 16
    },
    "behavior": {
      "formatOnSave": true
    }
  }'
></script>
```

### Lock Down Theme and Format Settings

```html
<script
  src="https://your-cdn.com/expert-enhancements-embed.js"
  data-config='{
    "editor": {
      "theme": "vs-dark",
      "fontSize": 14,
      "tabSize": 4
    },
    "behavior": {
      "formatOnSave": true,
      "confirmBeforeDiscard": true
    },
    "performance": {
      "loadingTimeout": 60000,
      "toastDuration": 3000
    }
  }'
></script>
```

When settings are locked via embed config:
- They appear with a 🔒 **Locked** badge in the Settings UI
- Input fields are disabled and greyed out
- Tooltip explains: "This setting is controlled by embed configuration"
- Users cannot override these settings

### Corporate Branding Example

```html
<script
  src="https://your-cdn.com/expert-enhancements-embed.js"
  data-config='{
    "appearance": {
      "primaryColor": "#0066cc",
      "headerColor": "#0066cc"
    },
    "overlay": {
      "defaultWidth": 1600,
      "defaultHeight": 900
    }
  }'
></script>
```

### Performance Tuning for Slow Networks

```html
<script
  src="https://your-cdn.com/expert-enhancements-embed.js"
  data-config='{
    "performance": {
      "loadingTimeout": 90000,
      "livePreviewDebounce": 1000
    },
    "advanced": {
      "cdnUrls": {
        "monaco": "https://your-internal-cdn.com/monaco/vs",
        "prettier": "https://your-internal-cdn.com/prettier.js"
      }
    }
  }'
></script>
```

## Settings UI Features

### Collapsible Sections

Settings are organized into collapsible sections:
- Click section header to expand/collapse
- Section state persists across sessions
- Default: Behavior and Editor sections expanded

### Visual Indicators

**🔒 Locked Badge**
- Setting is controlled by embed configuration
- Cannot be changed by user
- Input fields are disabled

**Modified Badge**
- Setting has been changed from default
- Shows "Reset" button to restore default
- Persists in localStorage

### Reset Functionality

**Individual Reset**
- Click "Reset" button next to any modified setting
- Restores that setting to default value
- Immediate feedback with toast notification

**Reset All**
- "Reset All to Defaults" button at bottom
- Confirmation dialog before resetting
- Clears all user preferences

### Export Configuration

- "Export Config" button copies full configuration to clipboard
- Includes: defaults, user settings, embed config, effective config
- Useful for debugging and sharing configurations

## API Usage

### Accessing Configuration in Code

```javascript
// Get the config instance
const config = window.ExpertEnhancements.Config;

// Get a configuration value
const theme = config.get('editor.theme');
const fontSize = config.get('editor.fontSize');

// Set a user preference (if not locked)
config.setUserSetting('editor.fontSize', 16);

// Check if setting is overridden
const isLocked = config.isEmbedOverridden('editor.theme');
const isModified = config.isUserModified('editor.fontSize');

// Get source of setting
const source = config.getSource('editor.theme'); // 'default' | 'user' | 'embed'

// Reset setting
config.resetUserSetting('editor.fontSize');

// Reset all user settings
config.resetAllUserSettings();

// Export configuration
const configData = config.exportConfig();
console.log(configData);
```

### Using Configuration in Apps

Apps receive the Config instance in their context:

```javascript
const MyApp = {
    async init(context) {
        this.config = context.Config;

        // Use configuration values
        const formatOnSave = this.config.get('behavior.formatOnSave');
        const theme = this.config.get('editor.theme');

        console.log(`Format on save: ${formatOnSave}`);
        console.log(`Editor theme: ${theme}`);
    }
};
```

## Configuration Schema

See `src/config.js` for the complete default configuration object with all available settings and their types.

## Storage

- **User settings**: Stored in localStorage under `expertEnhancements:config`
- **Section state**: Stored in localStorage under `expertEnhancements:settingsSections`
- **Embed config**: Parsed once at initialization from script tag's `data-config` attribute

## Migration Notes

The new configuration system maintains backward compatibility:
- Existing formatter settings in localStorage are automatically migrated
- Old storage keys are preserved for now
- Future version will include migration utility

## Future Enhancements

Planned features:
- [ ] Theme presets (Light/Dark/High Contrast/Custom)
- [ ] Import/Export configuration as JSON file
- [ ] Configuration profiles (Development/Production/Custom)
- [ ] Per-app settings overrides
- [ ] Real-time theme preview
- [ ] Color scheme generator
- [ ] Settings search/filter
- [ ] Keyboard shortcuts customization

## Troubleshooting

### Settings Not Persisting

Check browser console for localStorage errors. Some browsers block localStorage in private/incognito mode.

### Embed Config Not Working

1. Ensure `data-config` attribute contains valid JSON
2. Check browser console for parsing errors
3. Verify embed script tag is correct

### Settings Showing as Locked

Settings are locked when specified in embed config. Contact your administrator to change embed-level settings.

### Can't Change Monaco Theme

If theme is locked, it's controlled by embed configuration. Use browser DevTools to inspect the embed script tag.

## Examples

See the `examples/` directory for more embed configuration examples:
- `examples/basic-config.html` - Simple theme override
- `examples/locked-settings.html` - Locked corporate settings
- `examples/performance-tuning.html` - Performance optimizations
- `examples/custom-branding.html` - Custom colors and branding
