# Visual Hierarchy Creator - Technical Architecture

**Issue:** #83
**Status:** Architecture Design
**Last Updated:** 2025-10-31

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Architecture](#2-component-architecture)
3. [Data Model](#3-data-model)
4. [UI/UX Design](#4-uiux-design)
5. [State Management](#5-state-management)
6. [D3.js Integration](#6-d3js-integration)
7. [API Integration Strategy](#7-api-integration-strategy)
8. [Implementation Plan](#8-implementation-plan)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Environment                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │           CXone Expert Enhancement Overlay           │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  App Switcher: [CSS] [HTML] [Hierarchy] [Settings]  │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                       │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │     Visual Hierarchy Creator App            │    │    │
│  │  ├────────────────┬────────────────────────────┤    │    │
│  │  │ Canvas (D3.js) │  Properties Panel          │    │    │
│  │  │                │                             │    │    │
│  │  │  [Category]    │  Title: [___________]      │    │    │
│  │  │      |         │  Desc:  [___________]      │    │    │
│  │  │   [Guide]      │  Type:  ○ Topic            │    │    │
│  │  │      |         │         ○ Reference         │    │    │
│  │  │   [Article]    │         ○ How-To           │    │    │
│  │  │                │  [Delete] [Save]            │    │    │
│  │  ├────────────────┴────────────────────────────┤    │    │
│  │  │  Toolbar: [+Category] [+Guide] [+Article]   │    │    │
│  │  │           [Delete] [Export] [Save]          │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │                                                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │                                          │
          │ Context API                              │ localStorage
          ▼                                          ▼
    ┌─────────┐                               ┌─────────────┐
    │ Core.js │                               │   Storage   │
    │ (Monaco,│                               │  State JSON │
    │  API,   │                               └─────────────┘
    │  UI,    │
    │  DOM)   │
    └─────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Vanilla JavaScript (ES2020+) | Core language |
| **Visualization** | D3.js (v7.x) | Tree rendering & interaction |
| **Module System** | ES Modules | Import/export |
| **Build Tool** | Vite (v7.1.12) | Bundling & dev server |
| **Persistence** | localStorage API | Client-side storage |
| **HTTP Client** | Fetch API | API requests (future) |
| **UI Framework** | Custom (via core.js) | Overlay, toasts, dialogs |

### 1.3 File Structure

```
src/
├── hierarchy-creator.js       (Main app: 800-1200 lines est.)
├── hierarchy-creator.css      (Styles: 200-300 lines est.)
├── core.js                    (Existing - do not modify)
├── core.css                   (Existing - shared styles)
└── main.js                    (Add import for hierarchy-creator.js)

docs/
├── HIERARCHY_CREATOR_RESEARCH.md       (This file's companion)
├── HIERARCHY_CREATOR_ARCHITECTURE.md   (This file)
└── HIERARCHY_CREATOR_MVP.md            (Feature spec)
```

---

## 2. Component Architecture

### 2.1 App Component Structure

```
HierarchyCreatorApp (Main App Object)
│
├── State Management
│   ├── diagrams[]          (All saved diagrams)
│   ├── activeDiagramId     (Currently open diagram)
│   ├── selectedNodeId      (Currently selected node)
│   └── validationErrors[]  (Current validation issues)
│
├── UI Components
│   ├── Toolbar
│   │   ├── DiagramSelector (Dropdown)
│   │   ├── AddButtons (Category/Guide/Article)
│   │   ├── DeleteButton
│   │   ├── SaveButton
│   │   └── ExportButton
│   │
│   ├── Canvas (D3.js)
│   │   ├── SVG Container
│   │   ├── Tree Layout
│   │   ├── Nodes (Category/Guide/Article)
│   │   ├── Edges (Parent-child links)
│   │   └── Zoom/Pan Controls
│   │
│   └── Properties Panel
│       ├── Node Title Input
│       ├── Description Textarea
│       ├── Article Type Radio (for articles)
│       ├── Delete Button
│       └── Validation Messages
│
├── Core Methods (App Interface)
│   ├── init(context)       (Initialize with Core utilities)
│   ├── mount(container)    (Build UI & render)
│   ├── unmount()           (Cleanup)
│   ├── getState()          (Serialize for persistence)
│   ├── setState(state)     (Restore from persistence)
│   └── onResize()          (Handle overlay resize)
│
├── Diagram Operations
│   ├── createDiagram(name)
│   ├── loadDiagram(id)
│   ├── deleteDiagram(id)
│   ├── renameDiagram(id, name)
│   └── exportDiagram(id)   (Download as JSON)
│
├── Node Operations
│   ├── addNode(type, parentId, props)
│   ├── updateNode(id, props)
│   ├── deleteNode(id)      (Cascade delete children)
│   ├── selectNode(id)
│   └── getNodeChildren(id)
│
├── Layout & Rendering
│   ├── renderTree()        (D3 tree layout)
│   ├── renderNode(node)    (Render single node)
│   ├── renderEdges()       (Render parent-child links)
│   ├── updateCanvas()      (Refresh D3 visualization)
│   └── handleNodeClick(id)
│
└── Validation
    ├── validateDiagram(diagram)
    ├── checkForCycles()
    ├── checkUniqueTitles()
    ├── checkRequiredFields()
    └── checkValidParentTypes()
```

### 2.2 Component Responsibilities

#### **Toolbar Component**

**Purpose:** Provide actions for diagram and node management

**Elements:**
- Diagram selector dropdown (switch between saved diagrams)
- "New Diagram" button
- "Add Category/Guide/Article" buttons
- "Delete Selected" button
- "Save" button (persist to localStorage)
- "Export JSON" button (download file)

**Behavior:**
- Add buttons are enabled based on selection (e.g., can't add Article unless Guide is selected)
- Delete button is disabled if no selection
- Save button shows dirty indicator if changes exist

#### **Canvas Component (D3.js)**

**Purpose:** Render interactive tree diagram

**Features:**
- SVG-based rendering via D3.js
- Automatic tree layout (vertical orientation)
- Node shapes vary by type:
  - Category: Rectangle with rounded corners
  - Guide: Rounded rectangle
  - Article: Circle with type badge
- Edges: Curved lines (Bezier) connecting parent to children
- Zoom & pan controls
- Click to select node
- Visual selection state (highlight border)

**Interactions:**
- **Click node:** Select and show properties panel
- **Double-click node:** Focus & edit title inline (stretch goal)
- **Mouse wheel:** Zoom in/out
- **Drag canvas:** Pan view
- **Hover node:** Show tooltip with full description

#### **Properties Panel Component**

**Purpose:** Edit selected node's properties

**Fields:**
- **Title:** Text input (required, max 100 chars)
- **Description:** Textarea (optional, max 500 chars)
- **Article Type:** Radio buttons (only visible when node type = article)
  - ○ Topic
  - ○ Reference
  - ○ How-To
- **Delete Node:** Button with confirmation

**Behavior:**
- Auto-save on blur (debounced 500ms)
- Show validation errors inline
- Disabled if no node selected

---

## 3. Data Model

### 3.1 State Schema

```javascript
// Root state object (saved to localStorage)
{
  // All diagrams
  diagrams: [
    {
      id: 'uuid-v4',                  // Unique identifier
      name: 'Product Knowledge Base', // User-defined name
      created: 1698765432000,         // Timestamp
      modified: 1698765432000,        // Timestamp

      // Tree structure
      nodes: [
        {
          id: 'node-uuid-1',
          type: 'category',           // 'category' | 'guide' | 'article'
          title: 'Getting Started',
          description: 'Introduction to our product',
          parentId: null,             // null = root node

          // Article-specific (only when type='article')
          articleType: 'topic',       // 'topic' | 'reference' | 'how-to'

          // Optional metadata
          position: { x: 100, y: 50 }, // For manual positioning (future)
          collapsed: false,            // For collapsible nodes (future)
          metadata: {}                 // Extension point
        },
        // ... more nodes
      ],

      // Validation state
      validation: {
        valid: true,
        errors: []  // Array of { nodeId, type, message }
      }
    }
  ],

  // Active diagram ID
  activeDiagramId: 'uuid-v4',

  // UI state
  selectedNodeId: 'node-uuid-1',
  canvasTransform: { x: 0, y: 0, scale: 1 }  // Zoom/pan state
}
```

### 3.2 Node Type Definitions

```typescript
// TypeScript-style type definitions (for documentation)

type NodeType = 'category' | 'guide' | 'article';
type ArticleType = 'topic' | 'reference' | 'how-to';

interface Node {
  id: string;              // UUID v4
  type: NodeType;
  title: string;           // Required, max 100 chars
  description: string;     // Optional, max 500 chars
  parentId: string | null; // null = root

  // Article-specific
  articleType?: ArticleType; // Required if type='article'

  // Future extensions
  position?: { x: number, y: number };
  collapsed?: boolean;
  metadata?: Record<string, any>;
}

interface Diagram {
  id: string;
  name: string;
  created: number;         // Unix timestamp (ms)
  modified: number;
  nodes: Node[];
  validation: {
    valid: boolean;
    errors: ValidationError[];
  };
}

interface ValidationError {
  nodeId: string;
  type: 'cycle' | 'duplicate-title' | 'missing-field' | 'invalid-parent';
  message: string;
}

interface AppState {
  diagrams: Diagram[];
  activeDiagramId: string;
  selectedNodeId: string | null;
  canvasTransform: { x: number, y: number, scale: number };
}
```

### 3.3 Data Flow

```
User Action → Event Handler → State Update → Validation → Render → Save

Example: Add new node

1. User clicks "Add Guide" button
2. handleAddGuide() called
3. Create new node object with UUID
4. Update state: diagram.nodes.push(newNode)
5. Validate diagram (check parent type is category)
6. renderTree() - D3 updates canvas
7. saveState() - Persist to localStorage
8. selectNode(newNode.id) - Show in properties panel
```

---

## 4. UI/UX Design

### 4.1 Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│ Visual Hierarchy Creator                          [─] [□] [X]   │
├─────────────────────────────────────────────────────────────────┤
│ Toolbar                                                          │
│ ┌──────────────────┐  [+ Category] [+ Guide] [+ Article]       │
│ │ Diagram: My KB ▼ │  [🗑 Delete] [💾 Save] [📥 Export]         │
│ └──────────────────┘                                            │
├────────────────────────────────┬────────────────────────────────┤
│                                │  Properties Panel              │
│  Canvas (SVG)                  │  ┌──────────────────────────┐  │
│                                │  │ Selected Node             │  │
│  ┌────────────────────┐        │  │                           │  │
│  │ Getting Started    │        │  │ Type: Category            │  │
│  │ (Category)         │        │  │                           │  │
│  └────────┬───────────┘        │  │ Title:                    │  │
│           │                    │  │ [Getting Started_______]  │  │
│     ┌─────┴──────┬─────┐       │  │                           │  │
│     │            │     │       │  │ Description:              │  │
│  ┌──▼──┐     ┌──▼──┐  │       │  │ [____________________]    │  │
│  │Setup│     │Admin│  │       │  │ [____________________]    │  │
│  │Guide│     │Guide│  │       │  │                           │  │
│  └──┬──┘     └──┬──┘  │       │  │ Article Type:             │  │
│     │           │     │       │  │ (not applicable)          │  │
│  ┌──▼──┐     ┌──▼──┐  │       │  │                           │  │
│  │ 📄  │     │ 📄  │  │       │  │ [Delete Node]             │  │
│  │Topic│     │Ref. │  │       │  │                           │  │
│  └─────┘     └─────┘  │       │  │ Validation:               │  │
│                       │       │  │ ✅ No errors              │  │
│                       │       │  └──────────────────────────┘  │
│  Zoom: [─] [+] Reset   │       │                              │
│                        │       │                              │
└────────────────────────────────┴────────────────────────────────┘
```

### 4.2 Layout (Mobile/Narrow)

```
┌──────────────────────────────┐
│ Visual Hierarchy Creator  [X]│
├──────────────────────────────┤
│ [Diagram: My KB ▼]           │
│ [+ Category ▼] [Save] [⋮]    │
├──────────────────────────────┤
│ Canvas (Full Width)          │
│                              │
│  [Getting Started]           │
│         |                    │
│     [Setup Guide]            │
│         |                    │
│      [Topic]                 │
│                              │
│  Zoom: [─] [+]               │
├──────────────────────────────┤
│ Selected: Getting Started    │
│ Title: [____________]        │
│ Desc:  [____________]        │
│ [Delete] [Update]            │
└──────────────────────────────┘
```

### 4.3 Color Scheme

**Node Colors (by type):**

```css
.node-category {
  fill: #667eea;           /* Purple */
  stroke: #5568d3;
  stroke-width: 2px;
}

.node-guide {
  fill: #48bb78;           /* Green */
  stroke: #38a169;
  stroke-width: 2px;
}

.node-article {
  fill: #ed8936;           /* Orange */
  stroke: #dd6b20;
  stroke-width: 2px;
}

.node-selected {
  stroke: #f6e05e !important;  /* Yellow highlight */
  stroke-width: 3px;
  filter: drop-shadow(0 0 8px #f6e05e);
}
```

**Article Type Badges:**

```css
.article-topic {
  background: #3182ce;     /* Blue */
}

.article-reference {
  background: #805ad5;     /* Purple */
}

.article-how-to {
  background: #d69e2e;     /* Gold */
}
```

### 4.4 Responsive Behavior

| Viewport Width | Layout | Properties Panel |
|----------------|--------|------------------|
| **> 920px** | Split view (canvas 60% / panel 40%) | Always visible |
| **600-920px** | Split view (canvas 55% / panel 45%) | Collapsible |
| **< 600px** | Single column (canvas above panel) | Bottom sheet |

---

## 5. State Management

### 5.1 State Lifecycle

```javascript
// 1. Initialize (on mount)
async mount(container) {
  // Load saved state from localStorage
  const savedState = context.Storage.getAppState(this.id);

  if (savedState) {
    this.setState(savedState);
  } else {
    // Create default diagram
    this.createDefaultDiagram();
  }

  // Render UI
  this.renderUI();
  this.renderTree();
}

// 2. Update state (on user action)
addNode(type, parentId, props) {
  const newNode = {
    id: this.generateUUID(),
    type,
    parentId,
    title: props.title || `New ${type}`,
    description: props.description || '',
    ...(type === 'article' && { articleType: props.articleType || 'topic' })
  };

  const diagram = this.getActiveDiagram();
  diagram.nodes.push(newNode);
  diagram.modified = Date.now();

  // Validate
  this.validateDiagram(diagram);

  // Render
  this.renderTree();

  // Persist (debounced)
  this.saveState();

  // Select new node
  this.selectNode(newNode.id);
}

// 3. Persist state (debounced to avoid excessive writes)
saveState() {
  clearTimeout(this.saveDebounceTimer);
  this.saveDebounceTimer = setTimeout(() => {
    const state = this.getState();
    context.Storage.setAppState(this.id, state);
    console.log('[Hierarchy Creator] State saved');
  }, 500);
}

// 4. Serialize state (for persistence)
getState() {
  return {
    diagrams: this.diagrams,
    activeDiagramId: this.activeDiagramId,
    selectedNodeId: this.selectedNodeId,
    canvasTransform: this.canvasTransform
  };
}

// 5. Deserialize state (on restore)
setState(state) {
  if (!state) return;

  this.diagrams = state.diagrams || [];
  this.activeDiagramId = state.activeDiagramId;
  this.selectedNodeId = state.selectedNodeId;
  this.canvasTransform = state.canvasTransform || { x: 0, y: 0, scale: 1 };

  // Validate all diagrams
  this.diagrams.forEach(d => this.validateDiagram(d));
}
```

### 5.2 Undo/Redo (Future Enhancement)

```javascript
// History stack pattern (post-MVP)
class HistoryManager {
  constructor(maxSize = 50) {
    this.past = [];
    this.future = [];
    this.maxSize = maxSize;
  }

  pushState(state) {
    this.past.push(JSON.parse(JSON.stringify(state)));
    if (this.past.length > this.maxSize) {
      this.past.shift();
    }
    this.future = []; // Clear redo stack
  }

  undo(currentState) {
    if (this.past.length === 0) return null;
    this.future.push(JSON.parse(JSON.stringify(currentState)));
    return this.past.pop();
  }

  redo() {
    if (this.future.length === 0) return null;
    const state = this.future.pop();
    this.past.push(JSON.parse(JSON.stringify(state)));
    return state;
  }
}
```

---

## 6. D3.js Integration

### 6.1 Tree Layout Setup

```javascript
// Initialize D3 tree layout
initD3Tree() {
  const width = 800;
  const height = 600;

  // Create SVG
  this.svg = d3.select('#hierarchy-canvas')
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .call(d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => this.handleZoom(event))
    );

  this.g = this.svg.append('g');

  // Create tree layout
  this.treeLayout = d3.tree()
    .size([width - 100, height - 100])
    .separation((a, b) => a.parent === b.parent ? 1 : 1.5);
}

// Render tree
renderTree() {
  const diagram = this.getActiveDiagram();
  if (!diagram || diagram.nodes.length === 0) {
    this.showEmptyState();
    return;
  }

  // Build hierarchy from flat nodes array
  const root = this.buildHierarchy(diagram.nodes);

  // Compute tree layout
  this.treeLayout(root);

  // Render nodes
  this.renderNodes(root.descendants());

  // Render edges
  this.renderEdges(root.links());
}

// Build D3 hierarchy from flat nodes
buildHierarchy(nodes) {
  // Find root node
  const rootNode = nodes.find(n => n.parentId === null);
  if (!rootNode) {
    throw new Error('No root node found');
  }

  // Build tree structure
  const buildChildren = (node) => {
    const children = nodes.filter(n => n.parentId === node.id);
    return {
      ...node,
      children: children.length > 0 ? children.map(buildChildren) : undefined
    };
  };

  const treeData = buildChildren(rootNode);

  // Create D3 hierarchy
  return d3.hierarchy(treeData);
}
```

### 6.2 Node Rendering

```javascript
renderNodes(nodes) {
  // Data join
  const nodeGroups = this.g.selectAll('.node')
    .data(nodes, d => d.data.id);

  // Enter
  const nodeEnter = nodeGroups.enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .on('click', (event, d) => this.handleNodeClick(event, d));

  // Render node shape based on type
  nodeEnter.each(function(d) {
    const g = d3.select(this);
    const node = d.data;

    if (node.type === 'category') {
      // Rectangle with rounded corners
      g.append('rect')
        .attr('class', 'node-category')
        .attr('x', -60)
        .attr('y', -25)
        .attr('width', 120)
        .attr('height', 50)
        .attr('rx', 8);
    } else if (node.type === 'guide') {
      // Rounded rectangle
      g.append('rect')
        .attr('class', 'node-guide')
        .attr('x', -50)
        .attr('y', -20)
        .attr('width', 100)
        .attr('height', 40)
        .attr('rx', 12);
    } else if (node.type === 'article') {
      // Circle
      g.append('circle')
        .attr('class', 'node-article')
        .attr('r', 20);

      // Article type badge
      g.append('text')
        .attr('class', 'article-type-badge')
        .attr('y', 4)
        .text(node.articleType[0].toUpperCase()); // T, R, or H
    }

    // Title text
    g.append('text')
      .attr('class', 'node-title')
      .attr('y', node.type === 'article' ? 35 : 5)
      .attr('text-anchor', 'middle')
      .text(node.title.substring(0, 15) + (node.title.length > 15 ? '...' : ''));
  });

  // Update
  nodeGroups.merge(nodeEnter)
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .classed('selected', d => d.data.id === this.selectedNodeId);

  // Exit
  nodeGroups.exit().remove();
}
```

### 6.3 Edge Rendering

```javascript
renderEdges(links) {
  // Link generator (curved paths)
  const linkGenerator = d3.linkVertical()
    .x(d => d.x)
    .y(d => d.y);

  // Data join
  const paths = this.g.selectAll('.link')
    .data(links, d => `${d.source.data.id}-${d.target.data.id}`);

  // Enter
  paths.enter()
    .append('path')
    .attr('class', 'link')
    .attr('fill', 'none')
    .attr('stroke', '#cbd5e0')
    .attr('stroke-width', 2)
    .merge(paths)
    .attr('d', linkGenerator);

  // Exit
  paths.exit().remove();
}
```

### 6.4 Zoom & Pan

```javascript
handleZoom(event) {
  this.g.attr('transform', event.transform);
  this.canvasTransform = {
    x: event.transform.x,
    y: event.transform.y,
    scale: event.transform.k
  };
  this.saveState();
}

resetZoom() {
  this.svg.transition()
    .duration(750)
    .call(this.zoom.transform, d3.zoomIdentity);
}
```

---

## 7. API Integration Strategy

### 7.1 Phase 1: MVP (Mock API)

**Scope:** JSON export only, no Expert API calls

```javascript
exportDiagram(diagramId) {
  const diagram = this.diagrams.find(d => d.id === diagramId);
  if (!diagram) return;

  // Export as JSON
  const json = JSON.stringify(diagram, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Download
  const a = document.createElement('a');
  a.href = url;
  a.download = `${diagram.name}.json`;
  a.click();

  URL.revokeObjectURL(url);

  context.UI.showToast('Diagram exported successfully', 'success');
}
```

### 7.2 Phase 2: Import from Expert API

**Scope:** Fetch existing Expert hierarchy and visualize

```javascript
async importFromExpert() {
  try {
    context.LoadingOverlay.show('Fetching hierarchy from Expert...');

    // Fetch hierarchy tree
    const response = await context.API.fetch('/deki/@api/deki/pages/home/tree');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    // Convert Expert structure to our format
    const diagram = this.convertExpertToDiagram(data);

    // Add to diagrams
    this.diagrams.push(diagram);
    this.activeDiagramId = diagram.id;

    // Render
    this.renderTree();
    this.saveState();

    context.LoadingOverlay.hide();
    context.UI.showToast('Imported hierarchy from Expert', 'success');

  } catch (error) {
    console.error('[Hierarchy Creator] Import failed:', error);
    context.LoadingOverlay.showError(`Import failed: ${error.message}`);
  }
}

convertExpertToDiagram(expertData) {
  // Convert Expert API format to our node format
  // Details TBD based on actual API response structure
}
```

### 7.3 Phase 3: Commit to Expert API

**Scope:** Create hierarchy in Expert

```javascript
async commitToExpert(diagramId, dryRun = false) {
  const diagram = this.diagrams.find(d => d.id === diagramId);
  if (!diagram) return;

  // Validate first
  this.validateDiagram(diagram);
  if (!diagram.validation.valid) {
    context.UI.showToast('Cannot commit: diagram has validation errors', 'error');
    return;
  }

  try {
    const progressMsg = dryRun ? 'Validating hierarchy...' : 'Creating hierarchy in Expert...';
    context.LoadingOverlay.show(progressMsg, { showProgress: true });

    // Topological sort (parents before children)
    const sortedNodes = this.topologicalSort(diagram.nodes);

    // Create nodes in order
    const createdNodes = new Map(); // Map original ID to created Expert page ID

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      const parentExpertId = node.parentId ? createdNodes.get(node.parentId) : 'home';

      context.LoadingOverlay.setMessage(`Creating ${node.type}: ${node.title} (${i+1}/${sortedNodes.length})`);

      if (!dryRun) {
        const expertId = await this.createExpertPage(node, parentExpertId);
        createdNodes.set(node.id, expertId);
      }

      // Simulate delay for dry run
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    context.LoadingOverlay.hide();

    if (dryRun) {
      context.UI.showToast('✅ Validation successful - ready to commit', 'success');
    } else {
      context.UI.showToast(`✅ Created ${sortedNodes.length} pages in Expert`, 'success', 5000);
    }

  } catch (error) {
    console.error('[Hierarchy Creator] Commit failed:', error);
    context.LoadingOverlay.showError(`Commit failed: ${error.message}`);
  }
}

async createExpertPage(node, parentExpertId) {
  // Use Expert API to create page
  // POST /deki/@api/deki/pages/{parentId}/contents
  // Details TBD based on actual API documentation
}
```

---

## 8. Implementation Plan

### 8.1 Step-by-Step Development

#### Step 1: App Skeleton (1-2 hours)

**Tasks:**
- [ ] Create `src/hierarchy-creator.js`
- [ ] Implement app interface (id, name, init, mount, unmount)
- [ ] Register with AppManager
- [ ] Add import to `src/main.js`
- [ ] Create `src/hierarchy-creator.css`
- [ ] Test app loads in overlay

**Deliverable:** Empty app that loads without errors

---

#### Step 2: D3.js Setup (2-3 hours)

**Tasks:**
- [ ] Install D3.js: `npm install d3 d3-hierarchy`
- [ ] Create SVG container in mount()
- [ ] Initialize d3.tree() layout
- [ ] Implement zoom/pan controls
- [ ] Test with dummy tree data (3 nodes)
- [ ] Add CSS styles for canvas

**Deliverable:** D3 tree renders dummy data

---

#### Step 3: Node Rendering (3-4 hours)

**Tasks:**
- [ ] Implement `renderNodes(nodes)` with D3 data join
- [ ] Render Category nodes (rectangles)
- [ ] Render Guide nodes (rounded rectangles)
- [ ] Render Article nodes (circles with badges)
- [ ] Implement `renderEdges(links)` for parent-child connections
- [ ] Add CSS styles for each node type
- [ ] Add selection highlighting
- [ ] Add hover effects

**Deliverable:** Tree renders with proper node shapes and colors

---

#### Step 4: Properties Panel (2-3 hours)

**Tasks:**
- [ ] Create HTML structure for properties panel
- [ ] Title input field
- [ ] Description textarea
- [ ] Article type radio buttons (conditional)
- [ ] Delete button
- [ ] Wire up event handlers
- [ ] Implement `updateNode(id, props)` method
- [ ] Auto-save on blur (debounced)

**Deliverable:** Can select node and edit its properties

---

#### Step 5: Toolbar & Node Creation (3-4 hours)

**Tasks:**
- [ ] Create toolbar HTML structure
- [ ] Diagram selector dropdown
- [ ] "New Diagram" button + modal
- [ ] "Add Category/Guide/Article" buttons
- [ ] Implement `addNode(type, parentId, props)` method
- [ ] Generate UUIDs for new nodes
- [ ] Update tree layout after adding node
- [ ] Enable/disable buttons based on selection

**Deliverable:** Can create new nodes via toolbar

---

#### Step 6: Node Deletion (2 hours)

**Tasks:**
- [ ] Implement `deleteNode(id)` method
- [ ] Cascade delete all children
- [ ] Add confirmation dialog (use context.UI)
- [ ] Update tree layout after deletion
- [ ] Handle deleting root node (prevent or warn)

**Deliverable:** Can delete nodes with confirmation

---

#### Step 7: Validation (2-3 hours)

**Tasks:**
- [ ] Implement `validateDiagram(diagram)` method
- [ ] Check for cycles (DFS traversal)
- [ ] Check unique titles among siblings
- [ ] Check required fields (title)
- [ ] Check valid parent types
- [ ] Display validation errors in properties panel
- [ ] Disable export/commit if invalid

**Deliverable:** Diagram validation working

---

#### Step 8: State Persistence (2-3 hours)

**Tasks:**
- [ ] Implement `getState()` method
- [ ] Implement `setState(state)` method
- [ ] Implement `saveState()` with debouncing
- [ ] Load saved state on mount
- [ ] Create default diagram if no saved state
- [ ] Support multiple diagrams

**Deliverable:** State persists across page reloads

---

#### Step 9: Export (1-2 hours)

**Tasks:**
- [ ] Implement `exportDiagram(id)` method
- [ ] Generate JSON file
- [ ] Trigger download
- [ ] Add "Copy to Clipboard" option
- [ ] Show success toast

**Deliverable:** Can export diagram as JSON file

---

#### Step 10: Styling & Polish (2-3 hours)

**Tasks:**
- [ ] Finalize CSS for all components
- [ ] Add responsive behavior (mobile layout)
- [ ] Add loading states
- [ ] Add empty state (no diagrams)
- [ ] Add tooltips
- [ ] Add keyboard shortcuts (Delete key, Escape)
- [ ] Add icons (use Unicode symbols or inline SVG)
- [ ] Test cross-browser (Chrome, Firefox, Safari, Edge)

**Deliverable:** Polished, production-ready MVP

---

### 8.2 Testing Checklist

#### Unit Tests (Manual)

- [ ] Create new diagram
- [ ] Add Category node
- [ ] Add Guide under Category
- [ ] Add Article under Guide
- [ ] Edit node title
- [ ] Edit node description
- [ ] Change article type
- [ ] Delete leaf node
- [ ] Delete node with children (cascade)
- [ ] Export diagram
- [ ] Load saved diagram
- [ ] Switch between diagrams

#### Validation Tests

- [ ] Attempt to create cycle (should fail)
- [ ] Create duplicate titles among siblings (should warn)
- [ ] Leave title blank (should error)
- [ ] Add Guide under Article (should prevent)
- [ ] Add Category under Guide (should prevent)

#### Edge Cases

- [ ] Load app with no saved state
- [ ] Delete root node
- [ ] Delete all nodes
- [ ] Very large tree (100+ nodes)
- [ ] Very long title (truncation)
- [ ] Special characters in title
- [ ] Rapid-fire actions (debouncing)

#### Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## 9. Future Enhancements (Post-MVP)

| Feature | Complexity | Value | Priority |
|---------|-----------|-------|----------|
| **Undo/Redo** | Medium | High | P1 |
| **Import from Expert API** | High | High | P1 |
| **Commit to Expert API** | High | Very High | P1 |
| **Templates** | Low | Medium | P2 |
| **Export to PNG** | Medium | Medium | P2 |
| **Export to Markdown** | Low | Medium | P2 |
| **Drag to reorder** | Medium | Low | P3 |
| **Collapsible nodes** | Medium | Medium | P3 |
| **Search/filter nodes** | Low | High | P2 |
| **Keyboard navigation** | Medium | Medium | P3 |
| **Collaboration (share link)** | Very High | Medium | P4 |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **Category** | Top-level organizational container (can contain Categories and Guides) |
| **Guide** | Mid-level container for related articles (can only contain Articles) |
| **Article** | Leaf content node (Topic, Reference, or How-To) |
| **Hierarchy** | Tree structure of Categories → Guides → Articles |
| **Node** | Generic term for Category, Guide, or Article |
| **Edge** | Parent-child relationship between nodes |
| **Root Node** | Top-most node with no parent (typically Homepage) |
| **Tree Layout** | Algorithm for positioning nodes (Reingold-Tilford) |
| **Diagram** | A saved hierarchy design |

---

**Document Status:** ✅ Complete
**Next Document:** HIERARCHY_CREATOR_MVP.md
**Implementation Start:** Ready to begin Step 1
