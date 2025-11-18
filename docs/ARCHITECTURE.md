# Architecture

This document explains the technical architecture of CXone Expert Enhancements.

## Overview

CXone Expert Enhancements is a **modular enhancement loader** that provides extensible developer tools for CXone Expert. It uses **Vite** for bundling ES modules into a single IIFE bundle optimized for CDN delivery.

## Project Structure

```
cxone-expert-enhancements/
├── src/                            # Source files (ES modules)
│   ├── main.js                     # Main entry point (Vite)
│   ├── core.js                     # Core app manager
│   ├── core.css                    # Core styling
│   ├── css-editor.js               # CSS Editor module
│   ├── css-editor.css              # CSS Editor styling
│   ├── html-editor.js              # HTML Editor module
│   └── settings.js                 # Settings module
│
├── dist/                           # Built files (Vite output)
│   ├── embed.js                    # Bundled JS (IIFE)
│   ├── embed.js.map                # Source map
│   ├── core.css                    # Bundled CSS
│   └── ... (old files for compatibility)
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
2. embed.js loads (bundled IIFE)
   ↓
3. All modules execute from bundle (core, apps)
   ↓
4. Loads CSS dynamically from CDN
   ↓
5. Pre-loads Monaco Editor
   ↓
6. Creates floating toggle button
   ↓
7. Switches between apps in overlay
   ↓
8. Mounts selected app into overlay
```

### File Dependencies

```
embed.js (bundled IIFE entry point)
    Contains:
    ├── main.js (initialization)
    ├── core.js (app manager & utilities)
    ├── css-editor.js (CSS editor app)
    ├── html-editor.js (HTML editor app)
    └── settings.js (settings app)

    Loads externally:
    └── core.css (bundled styles from CDN)
```

## Core Components

### 1. Main Entry Point (`src/main.js` → `dist/embed.js`)

**Purpose:** Single-script bundle that initializes the entire system

**Responsibilities:**
- Import all ES modules (core, apps)
- Load CSS dynamically from CDN
- Pre-load Monaco Editor
- Initialize app registry
- Create toggle button and overlay
- Wait for DOM ready

**Key features:**
- Bundled by Vite into IIFE format
- Contains all JavaScript in single file
- Auto-detects CDN path for CSS
- Handles Monaco AMD loader conflicts

### 2. Core System (`src/core.js`)

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

**#49: Vite build system** (✅ COMPLETED)
- Source files in `/src/` with ES modules
- Bundled builds in `/dist/` (embed.js, core.css)
- Source maps for debugging
- IIFE format for browser compatibility

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
1. Create new JS file in `src/` (e.g., `src/myapp.js`)
2. Implement app interface (`init`, `mount`, `unmount`)
3. Register with `AppManager.register()` at module load
4. Import in `src/main.js`
5. Run `npm run build` to bundle

**Adding new features to existing apps:**
1. Add feature code to app module
2. Use context API for shared utilities
3. Persist state via `context.Storage`
4. Follow existing patterns

## Technology Stack

**Frontend:**
- Vanilla JavaScript (ES6+ modules)
- CSS (no preprocessors)
- Monaco Editor (VS Code editor)

**Build Tools:**
- Vite 7.1.12 - Module bundler
- IIFE format - Browser compatibility
- Source maps - Debugging support

**Backend/Infrastructure:**
- Digital Ocean Spaces (S3-compatible storage)
- GitHub Actions (CI/CD)
- Node.js (build & deployment scripts)

**Dependencies:**
- `vite` - Build tool
- `@aws-sdk/client-s3` - S3 uploads
- `dotenv` - Environment variables
- `monaco-editor` (CDN) - Code editor

## Development Philosophy

**Modern Build System (Vite):**
- Source files in `/src/` with ES modules
- Built output in `/dist/` optimized for production
- Hot Module Replacement for fast development
- Source maps for easy debugging

**Benefits:**
- Clean ES module architecture
- Single bundled output file (embed.js)
- Better code organization and imports
- Foundation for future tree-shaking

**Trade-offs:**
- Build step required (`npm run build`)
- Slightly more complex for contributors
- But: Modern development practices
- But: Better long-term maintainability
