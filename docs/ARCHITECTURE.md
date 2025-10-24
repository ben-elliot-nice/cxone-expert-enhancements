# Architecture

This document explains the technical architecture of CXone Expert Enhancements.

## Overview

CXone Expert Enhancements is a **modular enhancement loader** that provides extensible developer tools for CXone Expert. It uses a **no-build approach** with vanilla JavaScript and CSS loaded directly from a CDN.

## Project Structure

```
cxone-expert-enhancements/
├── dist/                           # Production-ready files (no build step)
│   ├── expert-enhancements-embed.js        # Loader (entry point)
│   ├── expert-enhancements-core.js         # Core app manager
│   ├── expert-enhancements-core.css        # Core styling
│   ├── expert-enhancements-css.js          # CSS Editor module
│   ├── expert-enhancements-css.css         # CSS Editor styling
│   └── expert-enhancements-html.js         # HTML Editor module
│
├── deploy/                         # Deployment scripts
│   ├── deploy-v2.js                # S3/DO Spaces uploader
│   └── cleanup-feature.js          # Feature branch cleanup
│
├── .github/workflows/              # CI/CD automation
│   ├── release.yml                 # Main branch releases
│   ├── develop-deploy.yml          # Develop branch integration
│   ├── feature-deploy.yml          # Feature branch testing
│   ├── cleanup-feature.yml         # Cleanup deployments
│   └── version-check.yml           # Version validation
│
├── docs/                           # Documentation
│   ├── GIT_WORKFLOW.md             # Git workflow guide
│   ├── DEVELOPMENT.md              # Development setup
│   ├── DEPLOYMENT.md               # Deployment & CI/CD
│   └── ARCHITECTURE.md             # This file
│
├── package.json                    # Project metadata & scripts
├── .env.example                    # Environment template
└── README.md                       # User-facing documentation
```

## Module System

### Loading Sequence

```
1. User adds embed script to <head>
   ↓
2. expert-enhancements-embed.js loads
   ↓
3. Detects CDN location automatically
   ↓
4. Loads core system (core.js + core.css)
   ↓
5. Creates floating toggle button
   ↓
6. Lazy-loads app modules on demand
   ↓
7. Mounts selected app into overlay
```

### File Dependencies

```
expert-enhancements-embed.js (entry point)
    ↓
    Loads:
    ├── expert-enhancements-core.js
    └── expert-enhancements-core.css
            ↓
            Provides context to apps:
            ├── expert-enhancements-css.js + css.css
            └── expert-enhancements-html.js
```

## Core Components

### 1. Embed Script (`expert-enhancements-embed.js`)

**Purpose:** Single-script loader that initializes the entire system

**Responsibilities:**
- Auto-detect CDN location
- Load core JavaScript and CSS
- Initialize app registry
- Wait for DOM ready

**Key features:**
- Self-contained (no external dependencies)
- Tiny footprint (~300 lines)
- Error handling for failed loads

### 2. Core System (`expert-enhancements-core.js`)

**Purpose:** Central app manager and shared utilities

**Modules:**
- **AppManager** - Registers and manages apps
- **Storage** - localStorage wrapper with namespacing
- **UI** - Common UI utilities (messages, toasts)
- **DOM** - DOM manipulation helpers
- **API** - Network requests and form handling
- **Overlay** - Draggable/resizable overlay window
- **Monaco** - Monaco Editor initialization and caching

**Responsibilities:**
- App lifecycle management (init, mount, unmount)
- Overlay window management
- Shared state persistence
- Common UI components

### 3. App Modules

Each app follows this interface:

```javascript
const MyApp = {
    name: 'My App',              // Display name
    id: 'my-app',                // Unique identifier

    constraints: {               // Optional UI constraints
        minWidth: 420,
        minHeight: 300
    },

    async init(context) {
        // One-time initialization
        // Load dependencies, setup state
    },

    async mount(container) {
        // Build UI and mount to container
        // Attach event listeners
    },

    async unmount() {
        // Cleanup when app is hidden
        // Remove event listeners, dispose resources
    }
};

AppManager.registerApp(MyApp.id, MyApp);
```

### Context API

Apps receive a `context` object with shared utilities:

```javascript
context = {
    AppManager,  // App management
    Storage,     // localStorage utilities
    UI,          // UI helpers (showMessage, showToast)
    DOM,         // DOM utilities
    API,         // Network requests
    Overlay,     // Overlay controls
    Monaco       // Monaco Editor helpers
}
```

## Data Flow

### App Lifecycle

```
User clicks toggle button
    ↓
AppManager.switchToApp('css-editor')
    ↓
1. Unmount current app (if any)
2. Call app.init(context) if first time
3. Call app.mount(container)
4. Update app switcher UI
5. Save last active app to localStorage
```

### State Persistence

**localStorage keys:**
- `expert-enhancements:common` - Shared state (overlay dimensions, last app)
- `expert-enhancements:app:css-editor` - CSS editor state
- `expert-enhancements:app:html-editor` - HTML editor state

**State includes:**
- Overlay position and size
- Editor content (per role)
- Active tabs
- User preferences

### Save Flow (CSS Editor)

```
User clicks "Save All"
    ↓
1. Sync Monaco editor values to state
2. Build multipart form data
3. Fetch CSRF token from DOM
4. POST to /deki/cp/custom_css.php
5. Update originalContent (for dirty tracking)
6. Save state to localStorage
7. Show success message
```

## Monaco Editor Integration

### Loading Strategy

1. Monaco loaded from CDN: `https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0`
2. Loaded once and cached globally
3. Multiple editor instances share same Monaco
4. Language configuration (CSS, HTML) set up once

### Editor Features

- **Syntax highlighting** - Full CSS/HTML support
- **Auto-complete** - Context-aware suggestions
- **Error detection** - Linting for CSS
- **Custom themes** - Dark/light modes
- **Keyboard shortcuts** - Standard VS Code shortcuts

## UI Components

### Overlay Window

**Features:**
- Draggable header
- Resizable handles (5 handles: left, right, bottom, corner-left, corner-right)
- Fullscreen mode (double-click header)
- Minimize functionality
- Persistent position/size
- Mobile responsive (auto-adapts below 768px)

**Resize handles:**
- Sides: 12px wide/tall
- Corners: 20px × 20px
- Gradient hover effects
- Touch-device support

### App Switcher

Dropdown in header showing available apps:
- CSS Editor
- HTML Editor
- (More apps can be registered)

### Message System

Two types of notifications:

1. **Message Area** (in-app):
   - Persistent messages
   - Success/error/warning/info states
   - Close button
   - Stacks multiple messages

2. **Toast Notifications** (floating):
   - Auto-dismiss after 4 seconds
   - Slide-up animation
   - For quick confirmations

## Security

### CSRF Protection

- Extracts CSRF token from DOM (`input[name="csrf_token"]`)
- Includes in all save requests
- Validates on server side

### XSS Prevention

**Current:** Basic escaping
**Planned (#50):** DOMPurify integration for HTML editor

### Content Security Policy

**Current:** Relies on CXone Expert's CSP
**Consideration:** Scripts loaded from trusted CDN only

## Performance

### Lazy Loading

- Apps only initialize when first accessed
- Monaco loaded on-demand (when first editor opens)
- CSS/HTML modules loaded lazily

### localStorage Optimization

- Namespaced keys prevent collisions
- State only saved on changes
- Large content (CSS/HTML) compressed in future

### Caching Strategy

**CDN:**
- Versioned releases: Cached forever
- Latest/develop: No cache (always fresh)

**localStorage:**
- Persists across page loads
- Auto-recovery on errors
- Quota: ~5-10MB per domain

## Browser Compatibility

**Target browsers:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Known limitations:**
- localStorage quota varies by browser
- Monaco Editor requires modern JavaScript
- CSS Grid/Flexbox required

**Planned (#53):** Comprehensive cross-browser testing and fixes

## Future Architecture Improvements

### Planned Enhancements

**#49: Webpack build step** (Breaking change)
- Source files in `/src/`
- Minified builds in `/dist/`
- Source maps for debugging
- Tree shaking for smaller bundles

**#48: Configurable system**
- Centralized config object
- Data attribute overrides on embed tag
- Runtime configuration API

**#46: CSS extraction service**
- External URL scraping
- CSS parsing and optimization
- Conflict detection

### Extensibility

**Adding new apps:**
1. Create new JS file (e.g., `expert-enhancements-myapp.js`)
2. Implement app interface (`init`, `mount`, `unmount`)
3. Register with `AppManager.registerApp()`
4. Update embed script to load new file

**Adding new features to existing apps:**
1. Add feature code to app module
2. Use context API for shared utilities
3. Persist state via `context.Storage`
4. Follow existing patterns

## Technology Stack

**Frontend:**
- Vanilla JavaScript (ES6+)
- CSS (no preprocessors)
- Monaco Editor (VS Code editor)

**Backend/Infrastructure:**
- Digital Ocean Spaces (S3-compatible storage)
- GitHub Actions (CI/CD)
- Node.js (deployment scripts only)

**Dependencies:**
- `@aws-sdk/client-s3` - S3 uploads
- `dotenv` - Environment variables
- `monaco-editor` (CDN) - Code editor

## Development Philosophy

**No Build Step:**
- Files in `/dist/` are production-ready
- Edit directly, deploy directly
- Faster development cycle
- Lower barrier to entry

**Trade-offs:**
- No minification (planned in #49)
- No module bundling
- Larger file sizes
- Manual dependency management

**Why no build step?**
- Simplicity for contributors
- Rapid prototyping
- Easy debugging (no source maps needed yet)
- Project started small, will migrate when needed
