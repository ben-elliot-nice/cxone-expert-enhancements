# Visual Hierarchy Creator - Research & Technical Findings

**Issue:** #83
**Status:** Planning Complete
**Last Updated:** 2025-10-31

## Executive Summary

This document contains comprehensive research findings for building a Visual Hierarchy Creator application that enables users to interactively design and export CXone Expert knowledge base hierarchies through a visual diagramming interface.

**Recommendation:** Build using **D3.js with d3-hierarchy** for tree visualization, following existing vanilla JS app patterns.

---

## 1. Existing Codebase Architecture Analysis

### 1.1 App Structure Pattern

All apps in this codebase follow a consistent pattern established in `src/core.js`:

#### Required App Interface

```javascript
const MyApp = {
  // Required fields
  id: 'my-app',                          // Unique identifier
  name: 'My App',                        // Display name

  // Optional fields
  dependencies: ['settings'],            // Array of app IDs that must load first
  constraints: {
    minWidth: 420,                       // Minimum overlay width
    minHeight: 300                       // Minimum overlay height
  },

  // Required methods
  async init(context) {
    // Initialize app with context object
    // Context provides: Monaco, API, Storage, UI, DOM, Overlay, LoadingOverlay, FileImport, Formatter
  },

  async mount(container) {
    // Mount UI into container DOM element
    // Build HTML, attach event listeners, create editors
  },

  async unmount() {
    // Cleanup: dispose editors, remove listeners
  },

  // Optional methods
  getState() {
    // Return state object for persistence
  },

  setState(state) {
    // Restore from saved state
  },

  onResize() {
    // Handle overlay resize events
  }
};

// Register with AppManager
AppManager.register(MyApp);
export { MyApp };
```

#### File Organization

```
src/
├── hierarchy-creator.js      (Main app implementation)
├── hierarchy-creator.css     (App-specific styles)
├── core.js                   (Shared utilities - don't modify)
├── core.css                  (Shared styles)
└── main.js                   (Entry point - import new app here)
```

### 1.2 Context Object Utilities

Apps receive a `context` object in `init()` with these utilities:

| Utility | Purpose | Key Methods |
|---------|---------|-------------|
| **Monaco** | Code editor | `init()`, `isReady()`, `get()` |
| **API** | HTTP requests | `fetch(url, options)`, `parseFormHTML(html)`, `buildMultipartBody(data)` |
| **Storage** | localStorage | `getAppState(appId)`, `setAppState(appId, state)`, `getCommonState()` |
| **UI** | Toasts & dialogs | `showToast(msg, type)`, `showInlineConfirmation(btn, callback)` |
| **DOM** | Element creation | `create(tag, attrs, children)` |
| **Overlay** | App container | `setAppControls(elements)`, `clearAppControls()` |
| **LoadingOverlay** | Loading states | `show(msg)`, `hide()`, `showError(msg)` |
| **FileImport** | Drag & drop | `showRoleSelector(roles, type)` |
| **Formatter** | Code formatting | `formatCSS(code)`, `formatHTML(code)`, `isReady()` |

### 1.3 Registration & Dependencies

**Apps are registered in dependency order in `src/main.js`:**

```javascript
// src/main.js (lines 45-47)
import './settings.js';     // Base app (no dependencies)
import './css-editor.js';   // Depends on: settings
import './html-editor.js';  // Depends on: settings
// Add new app here:
import './hierarchy-creator.js'; // Depends on: settings (for consistency)
```

**AppManager handles dependency resolution automatically:**
- Apps with unmet dependencies fail to register gracefully
- Auto-initializes dependencies when switching to dependent app
- Logs warnings for missing dependencies

### 1.4 State Persistence Pattern

**Example from CSS Editor (css-editor.js:249-269):**

```javascript
getState() {
  return {
    activeRoles: Object.keys(editorState).filter(role => editorState[role].active),
    content: { ...content },
    isDirty: { ...dirtyFlags },
    // ... other state
  };
}

setState(state) {
  if (!state) return;
  // Restore activeRoles, content, etc.
}

// Save on changes
saveState() {
  const state = this.getState();
  context.Storage.setAppState(this.id, state);
}
```

### 1.5 Build System

**Vite Configuration (package.json):**

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "deploy": "npm run build && node deploy/deploy-v2.js"
  },
  "devDependencies": {
    "vite": "^7.1.12"
  }
}
```

**Key Points:**
- ES Modules (import/export)
- Vite bundles all JS/CSS into `dist/`
- No framework dependencies (React, Vue, etc.)
- Monaco Editor loaded from CDN

---

## 2. Diagramming Library Research

### 2.1 Requirements

For the Visual Hierarchy Creator, we need:

1. **Tree/Hierarchical Layout** - Represent Category → Guide → Article relationships
2. **Interactive Nodes** - Click, drag, select, edit properties
3. **Automatic Positioning** - Reflow layout when adding/removing nodes
4. **Vanilla JS Compatible** - No React/Vue required
5. **Open Source License** - MIT/BSD preferred
6. **Customizable Rendering** - Control node shapes, colors, styles
7. **Good Performance** - Handle 50-100+ node hierarchies smoothly

### 2.2 Library Comparison

#### **D3.js + d3-hierarchy** ✅ RECOMMENDED

**Overview:**
D3 (Data-Driven Documents) is the industry-standard library for data visualization. The `d3-hierarchy` module provides specialized layouts for hierarchical data including tree diagrams.

**Pros:**
- ✅ **Perfect fit for vanilla JS** - No framework required
- ✅ **Built-in tree layouts** - Reingold-Tilford "tidy tree" algorithm included
- ✅ **Highly customizable** - Full control over node/edge rendering
- ✅ **Mature & stable** - Used by thousands of production apps since 2011
- ✅ **MIT License** - Completely free
- ✅ **Excellent documentation** - Observable notebooks, tutorials, examples
- ✅ **Small bundle size** - Only ~75KB for core + hierarchy modules
- ✅ **Active community** - Large ecosystem of examples and plugins

**Cons:**
- ⚠️ **Steeper learning curve** - Lower-level API requires more code
- ⚠️ **Manual interaction handling** - Must implement drag, zoom, etc. yourself
- ⚠️ **No built-in UI components** - Need to build toolbars, panels from scratch

**Tree Layout Features:**
- Reingold-Tilford algorithm for optimal space efficiency
- Horizontal/vertical orientation
- Configurable node spacing
- Automatic collision detection
- Parent-child link curves (Bezier, step, straight)

**Bundle Size:** ~75KB (d3-selection + d3-hierarchy + d3-zoom)

**Code Example:**

```javascript
import * as d3 from 'd3';

// Create hierarchy from data
const root = d3.hierarchy(data);

// Create tree layout
const treeLayout = d3.tree()
  .size([height, width])
  .separation((a, b) => a.parent === b.parent ? 1 : 2);

// Compute positions
treeLayout(root);

// Render nodes
svg.selectAll('.node')
  .data(root.descendants())
  .join('circle')
  .attr('cx', d => d.x)
  .attr('cy', d => d.y)
  .attr('r', 5);

// Render links
svg.selectAll('.link')
  .data(root.links())
  .join('path')
  .attr('d', d3.linkVertical()
    .x(d => d.x)
    .y(d => d.y)
  );
```

**Use Case Verdict:** ✅ **Best choice** - Perfect alignment with project's vanilla JS architecture

---

#### **React Flow**

**Overview:**
Feature-rich React library for building node-based editors, flowcharts, and diagrams.

**Pros:**
- ✅ Batteries-included (minimap, controls, selection box)
- ✅ Great UX out-of-the-box
- ✅ Active development & community
- ✅ Good TypeScript support
- ✅ MIT License

**Cons:**
- ❌ **Requires React** - Would need to add React framework (~50KB+)
- ❌ **Framework mismatch** - Project is vanilla JS, adding React is overkill
- ❌ **Bundle bloat** - React + React Flow = ~100KB+ min
- ❌ **No hierarchical layout** - Built-in layouts are force-directed, not tree-based
- ⚠️ **Need external layout library** - Would still need Dagre or d3-hierarchy

**Use Case Verdict:** ❌ **Not suitable** - Framework dependency dealbreaker

---

#### **Cytoscape.js**

**Overview:**
Graph theory library for network and graph visualization, originally built for bioinformatics.

**Pros:**
- ✅ Vanilla JS compatible
- ✅ Powerful graph algorithms (shortest path, clustering, etc.)
- ✅ Multiple layout algorithms (breadthfirst, cose, circle, grid)
- ✅ MIT License
- ✅ Good performance with large graphs

**Cons:**
- ⚠️ **Overkill for simple trees** - Designed for complex graphs with cycles
- ⚠️ **Complex API** - Steeper learning curve than needed
- ⚠️ **Larger bundle** - ~300KB minified
- ⚠️ **Graph-focused, not tree-focused** - Tree layouts are secondary feature

**Use Case Verdict:** ❌ **Too complex** - Over-engineered for hierarchical trees

---

#### **vis.js (vis-network)**

**Overview:**
Easy-to-use network visualization library with interactive features.

**Pros:**
- ✅ Vanilla JS compatible
- ✅ Very easy to use - simple configuration object
- ✅ Good interactivity (drag, zoom, click)
- ✅ MIT/Apache License
- ✅ Built-in hierarchical layout

**Cons:**
- ⚠️ **Performance issues** - Struggles with 100+ nodes
- ⚠️ **Limited customization** - Harder to style nodes precisely
- ⚠️ **Maintenance concerns** - Less active development than D3
- ⚠️ **Bundle size** - ~200KB for vis-network

**Use Case Verdict:** ⚠️ **Backup option** - Could work but D3 is better

---

#### **GoJS**

**Overview:**
Commercial diagramming library with extensive features and pre-built components.

**Pros:**
- ✅ Extensive features (org charts, swimlanes, templates)
- ✅ Excellent documentation
- ✅ Great performance
- ✅ Batteries-included UI components

**Cons:**
- ❌ **Commercial license** - $3,995 per developer
- ❌ **Watermark in eval mode** - Not suitable for open source
- ❌ **Vendor lock-in** - Proprietary API
- ❌ **No free tier** - Cannot use without purchasing

**Use Case Verdict:** ❌ **Not viable** - Cost prohibitive for open source project

---

#### **Vanilla Canvas/SVG**

**Overview:**
Build tree visualization from scratch using native browser APIs.

**Pros:**
- ✅ Zero dependencies
- ✅ Complete control
- ✅ Smallest possible bundle size

**Cons:**
- ❌ **Huge development effort** - Would need to implement:
  - Tree layout algorithm (Reingold-Tilford or similar)
  - Automatic positioning
  - Collision detection
  - Pan & zoom
  - Drag interactions
  - Selection handling
  - Link routing
- ❌ **Reinventing the wheel** - D3 already does all of this
- ❌ **Maintenance burden** - Custom code to maintain long-term

**Use Case Verdict:** ❌ **Not practical** - Would take weeks to implement what D3 provides

---

### 2.3 Decision Matrix

| Criteria | D3.js | React Flow | Cytoscape.js | vis.js | GoJS | Vanilla |
|----------|-------|------------|--------------|--------|------|---------|
| **Vanilla JS Compatible** | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Tree Layout Built-in** | ✅ | ❌ | ⚠️ | ✅ | ✅ | ❌ |
| **Open Source / Free** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Small Bundle Size** | ✅ 75KB | ❌ 150KB+ | ❌ 300KB | ⚠️ 200KB | ⚠️ 500KB+ | ✅ 0KB |
| **Customization** | ✅ Full | ⚠️ Moderate | ✅ Full | ⚠️ Limited | ✅ Full | ✅ Full |
| **Learning Curve** | ⚠️ Medium | ✅ Easy | ⚠️ Hard | ✅ Easy | ⚠️ Medium | ❌ Very Hard |
| **Community/Docs** | ✅ Excellent | ✅ Good | ⚠️ Moderate | ⚠️ Moderate | ✅ Excellent | ❌ N/A |
| **Development Time** | ⚠️ 2-3 days | ✅ 1-2 days | ❌ 3-4 days | ✅ 1-2 days | ✅ 1-2 days | ❌ 2-3 weeks |

### 2.4 Final Recommendation

**Winner: D3.js + d3-hierarchy** ✅

**Rationale:**
1. **Perfect alignment with existing codebase** - Vanilla JS, no framework needed
2. **Tree layouts are first-class** - d3-hierarchy is purpose-built for this
3. **Proven at scale** - Used by Observable, Financial Times, NYT for production viz
4. **Best long-term choice** - Industry standard with 14+ years of stability
5. **Educational value** - Team gains transferable D3 skills
6. **Flexibility** - Can extend to more complex visualizations later

**Trade-off Accepted:** Slightly more code to write than vis.js, but result is more maintainable and performant.

---

## 3. CXone Expert API Integration Research

### 3.1 Expert Content Hierarchy Structure

Based on official documentation (https://expert-help.nice.com/Integrations/API):

```
Homepage (Root Category)
├── Category
│   ├── Category (nested)
│   │   └── Guide
│   │       ├── Article (Topic)
│   │       ├── Article (Reference)
│   │       └── Article (How-To)
│   └── Guide
│       └── Article
└── Category
    └── Guide
        └── Article
```

**Rules:**
- **Homepage** is always the root (a special Category page)
- **Categories** can contain Categories and Guides
- **Guides** can only contain Articles
- **Articles** have three types:
  - **Topic** - Conceptual/explanatory content
  - **Reference** - Technical specs, API docs, glossaries
  - **How-To** - Step-by-step procedural guides

### 3.2 API Endpoint Patterns

From existing code analysis (src/core.js:351-401 & src/css-editor.js:323-372):

**Current API Pattern:**

```javascript
// 1. Fetch form page to get CSRF token
const response = await API.fetch('/deki/cp/custom_css.php?params=%2F');
const html = await response.text();
const { doc, data } = API.parseFormHTML(html);
const csrfToken = data.csrf_token;

// 2. Submit form with CSRF token
const formData = {
  csrf_token: csrfToken,
  field_name: 'value',
  // ...
};

const { body, boundary } = API.buildMultipartBody(formData);

const submitResponse = await API.fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*',
  },
  credentials: 'include',
  body: body,
  redirect: 'follow'
});
```

**Expected Expert API Endpoints (need verification):**

| Action | Likely Endpoint | Method | Notes |
|--------|----------------|--------|-------|
| List hierarchy | `/deki/@api/deki/pages/{pageid}/tree` | GET | Fetch existing structure |
| Create category | `/deki/@api/deki/pages/{parentid}/contents` | POST | parent = category or homepage |
| Create guide | `/deki/@api/deki/pages/{parentid}/contents` | POST | parent = category |
| Create article | `/deki/@api/deki/pages/{parentid}/contents` | POST | parent = guide |
| Update page | `/deki/@api/deki/pages/{pageid}/contents` | PUT | Modify existing page |
| Delete page | `/deki/@api/deki/pages/{pageid}` | DELETE | Remove page |

**⚠️ Note:** Official CXone Expert API documentation (https://expert-help.nice.com/Integrations/API) should be consulted for exact endpoint URLs and request/response formats.

### 3.3 Authentication

**Existing pattern uses session-based auth:**
- User must be logged into Expert in same browser
- Requests use `credentials: 'include'` to send session cookies
- CSRF tokens protect against cross-site attacks

**For API integration:**
- Same pattern should work for Expert API
- Need to handle authentication errors gracefully
- May need API key for server-to-server operations (future)

### 3.4 Integration Strategy

**Phase 1 (MVP - Current Plan):**
- ✅ Mock API responses with fake data
- ✅ Focus on diagramming UX and data model
- ✅ Build JSON export functionality
- ✅ Validate structure against Expert rules

**Phase 2 (API Integration):**
- 📋 Research exact Expert API endpoints
- 📋 Implement GET /tree to fetch existing hierarchy
- 📋 Add "Import from Expert" feature
- 📋 Test with staging environment

**Phase 3 (API Commit):**
- 📋 Implement POST endpoints for Category/Guide/Article creation
- 📋 Batch operations with progress tracking
- 📋 Dry-run mode (validate without committing)
- 📋 Error handling & rollback on failures

**Why MVP doesn't need real API:**
1. **API endpoints not yet verified** - Need time to research correct URLs/params
2. **UX-first approach** - Validate diagramming interface with users first
3. **Faster iteration** - No API dependencies = faster development
4. **JSON export sufficient** - Users can manually create hierarchy initially

---

## 4. Storage & State Management

### 4.1 LocalStorage Pattern

**Use existing Storage utility (core.js:407-449):**

```javascript
// Save diagram state
const state = {
  diagrams: [
    {
      id: 'uuid-1',
      name: 'My Knowledge Base',
      nodes: [...],
      edges: [...],
      created: timestamp,
      modified: timestamp
    }
  ],
  activeDiagramId: 'uuid-1'
};

context.Storage.setAppState('hierarchy-creator', state);

// Load diagram state
const savedState = context.Storage.getAppState('hierarchy-creator');
if (savedState) {
  this.setState(savedState);
}
```

### 4.2 Data Model

**Diagram Structure:**

```javascript
{
  // App-level state
  diagrams: [
    {
      // Diagram metadata
      id: 'uuid-v4',
      name: 'My Knowledge Base V1',
      created: 1698765432000,
      modified: 1698765432000,

      // Graph structure
      nodes: [
        {
          id: 'node-1',
          type: 'category',  // or 'guide' or 'article'
          title: 'Getting Started',
          description: 'Introduction to the product',
          position: { x: 100, y: 50 },  // For manual positioning (optional)
          parentId: null,  // null = root node

          // Article-specific fields (only when type='article')
          articleType: 'topic'  // or 'reference' or 'how-to'
        },
        {
          id: 'node-2',
          type: 'guide',
          title: 'Installation Guide',
          description: '',
          position: { x: 100, y: 150 },
          parentId: 'node-1'  // Child of Getting Started category
        },
        {
          id: 'node-3',
          type: 'article',
          title: 'System Requirements',
          description: '',
          position: { x: 100, y: 250 },
          parentId: 'node-2',
          articleType: 'reference'
        }
      ],

      // Edges (parent-child relationships)
      // Note: Could be derived from parentId, but explicit edges allow
      // for graph visualization features later
      edges: [
        { from: 'node-1', to: 'node-2' },
        { from: 'node-2', to: 'node-3' }
      ],

      // Validation state
      validation: {
        valid: true,
        errors: []
      }
    }
  ],

  // Active diagram
  activeDiagramId: 'uuid-v4'
}
```

### 4.3 Validation Rules

**Must be enforced before export/commit:**

| Rule | Description | Implementation |
|------|-------------|----------------|
| **No cycles** | Prevent A → B → A | DFS traversal to detect back edges |
| **Unique titles** | No sibling nodes with same title | Check children of each parent |
| **Valid parent types** | Category can contain Category/Guide, Guide can contain Article | Type checking on add node |
| **Required fields** | Title must be non-empty | Form validation |
| **Root node** | Exactly one root node | Check `parentId === null` count |
| **No orphans** | All nodes must be connected to root | BFS/DFS from root |
| **Article type set** | Articles must have articleType | Field validation |

---

## 5. Technology Stack Summary

### 5.1 Final Tech Stack

| Component | Technology | Version | Size | License |
|-----------|-----------|---------|------|---------|
| **Core** | Vanilla JavaScript (ES Modules) | ES2020+ | - | - |
| **Diagramming** | D3.js (d3-selection, d3-hierarchy, d3-zoom) | 7.x | 75KB | MIT |
| **Build Tool** | Vite | 7.1.12 | - | MIT |
| **Persistence** | localStorage API | Native | - | - |
| **API Client** | Fetch API | Native | - | - |

### 5.2 External Dependencies

**Add to package.json:**

```json
{
  "dependencies": {
    "d3": "^7.9.0",
    "d3-hierarchy": "^3.1.2",
    "d3-selection": "^3.0.0",
    "d3-zoom": "^3.0.0"
  }
}
```

**Alternative (CDN):**

```javascript
// Load from CDN in hierarchy-creator.js
const D3_CDN = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
```

**Recommendation:** Use npm install for better build optimization and version control.

---

## 6. Development Timeline Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Setup** | Create files, register app, basic skeleton | 1-2 hours |
| **D3 Integration** | Load D3, create SVG workspace, basic tree layout | 2-3 hours |
| **Node Rendering** | Render Category/Guide/Article nodes with styles | 3-4 hours |
| **Properties Panel** | HTML form for editing selected node | 2-3 hours |
| **Node CRUD** | Add, edit, delete nodes with validation | 3-4 hours |
| **Toolbar** | Buttons for actions, diagram selector dropdown | 2-3 hours |
| **State Management** | getState/setState, auto-save on changes | 2-3 hours |
| **Export** | JSON export, download file | 1-2 hours |
| **Styling & Polish** | CSS, responsive behavior, error states | 2-3 hours |
| **Testing & Fixes** | Edge cases, browser testing, bug fixes | 3-4 hours |
| **TOTAL (MVP)** | - | **20-30 hours** |

**Post-MVP (Future):**

| Feature | Estimated Time |
|---------|----------------|
| Undo/Redo | 3-4 hours |
| Import from Expert API | 4-6 hours |
| Commit to Expert API | 6-8 hours |
| Templates | 2-3 hours |
| PNG/Markdown export | 2-3 hours |

---

## 7. Open Questions & Next Steps

### 7.1 Questions for Stakeholders

1. **Priority Level:**
   - Is this a high-priority feature or exploratory/nice-to-have?
   - What's the target completion date for MVP?

2. **API Access:**
   - Do we have access to Expert API staging environment?
   - Can we get API credentials for testing?
   - Do we have documentation for page creation endpoints?

3. **User Feedback:**
   - Can we get early user feedback on mockups before building?
   - Who are the target users (content managers, architects, admins)?
   - What's the typical size of hierarchies they create (10 nodes? 100? 1000)?

4. **Scope Clarification:**
   - Is MVP (JSON export only) acceptable initially?
   - Or is API integration required for launch?

### 7.2 Next Steps

1. ✅ **Research Complete** - This document
2. 📋 **Create Architecture Doc** - `docs/HIERARCHY_CREATOR_ARCHITECTURE.md`
3. 📋 **Create MVP Spec** - `docs/HIERARCHY_CREATOR_MVP.md`
4. 📋 **Get stakeholder approval** - Review plan with team
5. 📋 **Begin implementation** - Follow 10-step plan in Architecture doc

---

## 8. References

### Documentation Links

- **D3.js Official Docs:** https://d3js.org/
- **d3-hierarchy Module:** https://d3js.org/d3-hierarchy
- **D3 Tree Layout Examples:** https://observablehq.com/@d3/tidy-tree
- **CXone Expert API Reference:** https://expert-help.nice.com/Integrations/API
- **Expert Information Architecture:** https://expert-help.nice.com/Manage/Organize/Structure/Information_Architecture

### Internal References

- **Issue #83:** Visual Hierarchy Creator feature proposal
- **GIT_WORKFLOW.md:** Development and deployment workflow
- **core.js:** App framework and utilities (lines 1-900)
- **css-editor.js:** Example app implementation (lines 1-2133)

---

**Document Status:** ✅ Complete
**Next Document:** HIERARCHY_CREATOR_ARCHITECTURE.md
