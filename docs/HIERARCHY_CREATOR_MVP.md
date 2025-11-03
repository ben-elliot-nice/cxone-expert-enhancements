# Visual Hierarchy Creator - MVP Specification

**Issue:** #83
**Status:** MVP Scope Defined
**Last Updated:** 2025-10-31
**Target:** MVP - JSON export only (no Expert API integration)

## Table of Contents

1. [MVP Scope](#1-mvp-scope)
2. [User Stories](#2-user-stories)
3. [Feature Specifications](#3-feature-specifications)
4. [Acceptance Criteria](#4-acceptance-criteria)
5. [Test Scenarios](#5-test-scenarios)
6. [Out of Scope (Post-MVP)](#6-out-of-scope-post-mvp)

---

## 1. MVP Scope

### 1.1 Goal

Create a visual diagramming tool that allows content managers to:
1. **Plan** knowledge base hierarchies interactively
2. **Visualize** Category → Guide → Article relationships as a tree
3. **Export** the structure as JSON for manual or programmatic import to Expert

### 1.2 Target Users

- **Content Managers:** Planning new knowledge base structures
- **Information Architects:** Designing content organization
- **Migration Teams:** Mapping content from other systems

### 1.3 Must-Have Features ✅

| Feature | Description | Priority |
|---------|-------------|----------|
| **Visual Canvas** | D3.js tree diagram with zoom/pan | P0 |
| **Node Types** | Category (box), Guide (rounded), Article (circle) | P0 |
| **Add Nodes** | Create Category, Guide, Article via toolbar | P0 |
| **Edit Properties** | Title, description, article type | P0 |
| **Delete Nodes** | Remove node and cascade delete children | P0 |
| **Select Nodes** | Click to select, show in properties panel | P0 |
| **Multiple Diagrams** | Save multiple hierarchies, switch between them | P0 |
| **Auto-Save** | Persist to localStorage automatically | P0 |
| **Export JSON** | Download diagram as JSON file | P0 |
| **Validation** | Prevent cycles, duplicate names, invalid parent types | P0 |

### 1.4 Nice-to-Have (If Time Allows) 🎯

| Feature | Description | Effort |
|---------|-------------|--------|
| **Undo/Redo** | History stack for reverting changes | 3-4h |
| **Zoom Controls** | Buttons for zoom in/out/reset | 1h |
| **Node Count Badge** | Show child count on nodes | 1h |
| **Empty State Guidance** | Tutorial/help for first-time users | 2h |

### 1.5 Explicitly Out of Scope ❌

**NOT included in MVP:**
- ❌ Import from Expert API
- ❌ Commit to Expert API
- ❌ Templates/presets
- ❌ Export to PNG/SVG
- ❌ Collaboration/sharing
- ❌ Diff/comparison tools
- ❌ Drag-to-reorder nodes

**Rationale:** MVP focuses on proving the diagramming UX is valuable. API integration is Phase 2.

---

## 2. User Stories

### Epic: Visual Hierarchy Planning

#### Story 1: Create New Diagram

**As a** content manager
**I want to** create a new hierarchy diagram
**So that** I can start planning my knowledge base structure

**Acceptance Criteria:**
- [ ] Click "New Diagram" button opens a modal
- [ ] Enter diagram name (required, max 100 chars)
- [ ] Click "Create" adds diagram to list and activates it
- [ ] New diagram has a default root Category node ("Homepage")
- [ ] Diagram appears in diagram selector dropdown

---

#### Story 2: Add Category Node

**As a** content manager
**I want to** add a Category to my hierarchy
**So that** I can organize guides into logical sections

**Acceptance Criteria:**
- [ ] Click "Add Category" button is enabled when a Category is selected (or no selection)
- [ ] Click creates new Category node as child of selected Category (or as root if none selected)
- [ ] New Category has default title "New Category"
- [ ] New Category appears in tree diagram
- [ ] New Category is automatically selected and properties panel shows it

---

#### Story 3: Add Guide Node

**As a** content manager
**I want to** add a Guide under a Category
**So that** I can group related articles together

**Acceptance Criteria:**
- [ ] Click "Add Guide" button is enabled only when a Category is selected
- [ ] Click creates new Guide node as child of selected Category
- [ ] New Guide has default title "New Guide"
- [ ] New Guide appears in tree diagram
- [ ] New Guide is automatically selected

**Error Handling:**
- [ ] If no Category selected, button is disabled
- [ ] If Guide or Article selected, button is disabled

---

#### Story 4: Add Article Node

**As a** content manager
**I want to** add an Article under a Guide
**So that** I can represent actual content pages

**Acceptance Criteria:**
- [ ] Click "Add Article" button is enabled only when a Guide is selected
- [ ] Click creates new Article node as child of selected Guide
- [ ] New Article has default title "New Article" and type "Topic"
- [ ] New Article appears in tree diagram as a circle
- [ ] New Article is automatically selected
- [ ] Properties panel shows article type selector

**Error Handling:**
- [ ] If no Guide selected, button is disabled
- [ ] If Category or Article selected, button is disabled

---

#### Story 5: Edit Node Properties

**As a** content manager
**I want to** edit a node's title, description, and type
**So that** I can define the hierarchy structure accurately

**Acceptance Criteria:**
- [ ] Selecting a node displays its properties in the panel
- [ ] Title field shows current title (max 100 chars)
- [ ] Description textarea shows current description (max 500 chars)
- [ ] Article type radio buttons show only for Article nodes
- [ ] Changing any field updates the node immediately (debounced 500ms)
- [ ] Changes persist to localStorage automatically
- [ ] Node in tree updates to reflect new title

**Validation:**
- [ ] Empty title shows error message
- [ ] Title exceeding 100 chars shows character count warning
- [ ] Description exceeding 500 chars shows character count warning

---

#### Story 6: Delete Node

**As a** content manager
**I want to** delete a node from the hierarchy
**So that** I can remove incorrect or unwanted structure

**Acceptance Criteria:**
- [ ] Click "Delete" button in properties panel (or toolbar)
- [ ] Shows confirmation dialog: "Delete [node title]? This will also delete X children."
- [ ] Click "Confirm" deletes node and all descendants
- [ ] Tree updates to remove deleted nodes
- [ ] Selection clears after deletion
- [ ] Changes persist to localStorage

**Edge Cases:**
- [ ] Deleting root node shows special warning (will delete entire diagram)
- [ ] Deleting node with no children doesn't mention children in dialog
- [ ] Click "Cancel" aborts deletion

---

#### Story 7: Switch Between Diagrams

**As a** content manager
**I want to** switch between multiple saved diagrams
**So that** I can work on different hierarchy designs

**Acceptance Criteria:**
- [ ] Diagram selector dropdown shows all saved diagrams
- [ ] Each diagram shows name and last modified date
- [ ] Selecting a diagram loads it and renders the tree
- [ ] Active diagram is highlighted in dropdown
- [ ] Changes to current diagram are auto-saved before switching

---

#### Story 8: Export Diagram as JSON

**As a** content manager
**I want to** export my hierarchy as a JSON file
**So that** I can use it programmatically or share it with others

**Acceptance Criteria:**
- [ ] Click "Export JSON" button opens export modal
- [ ] Modal shows diagram name and node count
- [ ] Click "Download" downloads a .json file
- [ ] Filename is `[diagram-name].json`
- [ ] JSON contains nodes array with all properties
- [ ] JSON is pretty-printed (indented) for readability
- [ ] Success toast appears after download

---

#### Story 9: Validation Feedback

**As a** content manager
**I want to** see validation errors in real-time
**So that** I can fix structural issues before exporting

**Acceptance Criteria:**
- [ ] Validation runs automatically after any change
- [ ] Properties panel shows validation status (✅ or ⚠️)
- [ ] Invalid states show error message and description
- [ ] Export button is disabled if validation fails
- [ ] Tooltip on disabled Export button explains why

**Validation Rules:**
- [ ] No cycles in hierarchy (A → B → A is invalid)
- [ ] Sibling nodes must have unique titles
- [ ] Title is required (non-empty)
- [ ] Categories can only contain Categories or Guides
- [ ] Guides can only contain Articles
- [ ] Articles cannot have children

---

## 3. Feature Specifications

### 3.1 Visual Canvas

**Component:** SVG-based tree diagram rendered with D3.js

**Features:**
- **Tree Layout:** Vertical orientation, parents above children
- **Node Spacing:** Adequate padding to avoid overlap
- **Zoom:** Mouse wheel to zoom in/out (0.1x to 3x)
- **Pan:** Click and drag canvas to pan
- **Selection:** Click node to select (yellow highlight border)

**Visual Design:**

```
Node Shapes:
┌─────────────────┐
│   Category      │  (Rectangle, rounded corners, purple)
└─────────────────┘

┌───────────────┐
│     Guide     │    (Rounded rectangle, green)
└───────────────┘

     ⭕
   Article          (Circle, orange, with type badge: T/R/H)
```

**Colors:**
- Category: `#667eea` (purple)
- Guide: `#48bb78` (green)
- Article: `#ed8936` (orange)
- Selected: `#f6e05e` (yellow highlight)
- Edges: `#cbd5e0` (light gray)

---

### 3.2 Toolbar

**Location:** Top of app container

**Buttons:**

| Button | Icon/Label | Enabled When | Action |
|--------|-----------|--------------|--------|
| **Diagram Selector** | Dropdown | Always | Switch active diagram |
| **New Diagram** | + or "New" | Always | Open new diagram modal |
| **Add Category** | + Category | Category or no selection | Add Category node |
| **Add Guide** | + Guide | Category selected | Add Guide node |
| **Add Article** | + Article | Guide selected | Add Article node |
| **Delete** | 🗑️ or "Delete" | Node selected | Delete selected node |
| **Save** | 💾 or "Save" | Always (auto-saves) | Manual save trigger (optional) |
| **Export JSON** | 📥 or "Export" | Always | Export diagram |

---

### 3.3 Properties Panel

**Location:** Right side of canvas (desktop) or bottom (mobile)

**Fields:**

```
┌──────────────────────────────────┐
│ Selected Node                     │
├──────────────────────────────────┤
│ Type: Category                    │
│                                   │
│ Title:                            │
│ [Getting Started_____________]    │
│                                   │
│ Description:                      │
│ [_____________________________]   │
│ [_____________________________]   │
│ [_____________________________]   │
│                                   │
│ Article Type: (Articles only)     │
│ ○ Topic                           │
│ ○ Reference                       │
│ ○ How-To                          │
│                                   │
│ [Delete Node]                     │
│                                   │
│ Validation:                       │
│ ✅ No errors                      │
└──────────────────────────────────┘
```

**Behavior:**
- Auto-save on blur with 500ms debounce
- Character count for title (x/100)
- Character count for description (x/500)
- Article type radio buttons only visible for Article nodes
- Delete button shows confirmation dialog

---

### 3.4 New Diagram Modal

**Trigger:** Click "New Diagram" button

**UI:**

```
┌───────────────────────────────────┐
│ Create New Diagram            [X] │
├───────────────────────────────────┤
│                                   │
│ Diagram Name:                     │
│ [Product Knowledge Base_______]   │
│                                   │
│ ✓ This will create a new diagram │
│   with a default root Category.  │
│                                   │
│            [Cancel]  [Create]     │
└───────────────────────────────────┘
```

**Validation:**
- Name required (non-empty)
- Max 100 characters
- "Create" button disabled until valid

---

### 3.5 Delete Confirmation Dialog

**Trigger:** Click "Delete" button with node selected

**UI:**

```
┌───────────────────────────────────┐
│ Confirm Deletion              [X] │
├───────────────────────────────────┤
│                                   │
│ Delete "Getting Started"?         │
│                                   │
│ ⚠️ This will also delete:         │
│   • 2 Guides                      │
│   • 5 Articles                    │
│                                   │
│ This action cannot be undone.     │
│                                   │
│            [Cancel]  [Delete]     │
└───────────────────────────────────┘
```

---

### 3.6 Export Modal

**Trigger:** Click "Export JSON" button

**UI:**

```
┌───────────────────────────────────┐
│ Export Diagram                [X] │
├───────────────────────────────────┤
│                                   │
│ Diagram: Product Knowledge Base   │
│ Nodes: 15                         │
│ Created: 2025-10-30               │
│ Modified: 2025-10-31              │
│                                   │
│ ✅ Validation passed              │
│                                   │
│ This will download a JSON file    │
│ containing the hierarchy structure│
│                                   │
│         [Cancel]  [Download]      │
└───────────────────────────────────┘
```

---

## 4. Acceptance Criteria

### 4.1 Functional Requirements

**Must Work:**
- ✅ Create new diagram
- ✅ Add Category, Guide, Article nodes
- ✅ Edit node title, description, article type
- ✅ Delete node (with cascade)
- ✅ Select node (visual highlight)
- ✅ Switch between diagrams
- ✅ Auto-save to localStorage
- ✅ Export as JSON
- ✅ Validate hierarchy structure
- ✅ Zoom and pan canvas

**Must Prevent:**
- ❌ Creating cycles
- ❌ Creating duplicate sibling titles
- ❌ Leaving title blank
- ❌ Adding Guide under Guide
- ❌ Adding Article under Category
- ❌ Adding children under Article

---

### 4.2 Non-Functional Requirements

**Performance:**
- [ ] Render 50 nodes in < 1 second
- [ ] Render 100 nodes in < 2 seconds
- [ ] Auto-save debounced to avoid excessive localStorage writes
- [ ] Smooth zoom/pan interactions (60fps)

**Usability:**
- [ ] Intuitive node shapes/colors for each type
- [ ] Clear visual feedback for selection
- [ ] Helpful error messages
- [ ] Responsive layout (desktop & mobile)
- [ ] Keyboard shortcuts (Delete key, Escape)

**Compatibility:**
- [ ] Works in Chrome 90+
- [ ] Works in Firefox 88+
- [ ] Works in Safari 14+
- [ ] Works in Edge 90+

**Accessibility:**
- [ ] Keyboard navigable (future enhancement)
- [ ] Screen reader friendly (future enhancement)
- [ ] Sufficient color contrast
- [ ] Clear focus indicators

---

## 5. Test Scenarios

### 5.1 Happy Path: Create Simple Hierarchy

**Steps:**
1. Open Visual Hierarchy Creator app
2. App shows default "My Hierarchy" diagram with root Category
3. Click root Category to select it
4. Click "Add Guide" button
5. New Guide appears as child of Category
6. Edit Guide title to "Installation"
7. Select "Installation" Guide
8. Click "Add Article" button
9. New Article appears as child of Guide
10. Edit Article title to "System Requirements"
11. Change article type to "Reference"
12. Click "Export JSON" button
13. Download starts with `my-hierarchy.json`
14. Open file - contains 3 nodes (Category, Guide, Article)

**Expected Result:** ✅ Hierarchy created and exported successfully

---

### 5.2 Validation: Prevent Invalid Parent-Child

**Steps:**
1. Create Category node
2. Add Guide under Category
3. Add Article under Guide
4. Select Article
5. Observe "Add Category" button is disabled
6. Observe "Add Guide" button is disabled
7. Observe "Add Article" button is disabled
8. Properties panel shows: "Articles cannot have children"

**Expected Result:** ✅ Cannot add children to Article node

---

### 5.3 Validation: Duplicate Sibling Titles

**Steps:**
1. Create Category "Products"
2. Add Guide "Getting Started" under Products
3. Add another Guide "Features" under Products
4. Edit "Features" title to "Getting Started" (same as sibling)
5. Properties panel shows: ⚠️ "Duplicate title: sibling node has same title"
6. Export button is disabled
7. Tooltip on Export button explains error

**Expected Result:** ✅ Validation prevents duplicate sibling titles

---

### 5.4 Cascade Delete

**Steps:**
1. Create Category "Products"
2. Add Guide "Getting Started" under Products
3. Add 3 Articles under "Getting Started"
4. Select "Getting Started" Guide
5. Click "Delete" button
6. Dialog shows: "Delete 'Getting Started'? This will also delete 3 Articles."
7. Click "Delete"
8. Guide and all 3 Articles are removed
9. Tree updates to show only Category

**Expected Result:** ✅ Cascade delete removes node and all descendants

---

### 5.5 Multiple Diagrams

**Steps:**
1. Create diagram "Website KB"
2. Add some nodes
3. Click "New Diagram" button
4. Create diagram "API Documentation"
5. Add different nodes
6. Open diagram selector dropdown
7. See both diagrams listed
8. Select "Website KB"
9. Tree updates to show Website KB nodes
10. Select "API Documentation"
11. Tree updates to show API Documentation nodes

**Expected Result:** ✅ Can switch between diagrams without losing data

---

### 5.6 Persistence Across Page Reload

**Steps:**
1. Create diagram with 5 nodes
2. Refresh page (F5)
3. App loads
4. Diagram is still present in selector
5. Tree renders with all 5 nodes
6. Selection is cleared (not persisted)

**Expected Result:** ✅ Diagram persists across page reloads

---

### 5.7 Edge Case: Empty Diagram

**Steps:**
1. Create new diagram
2. Delete the default root Category
3. Diagram has 0 nodes
4. Canvas shows empty state: "Click 'Add Category' to start"
5. Only "Add Category" button is enabled
6. Click "Add Category"
7. New root Category appears

**Expected Result:** ✅ Gracefully handles empty diagram

---

### 5.8 Edge Case: Very Long Title

**Steps:**
1. Create Category node
2. Edit title to 150 character string
3. Character counter shows "150/100" in red
4. Validation shows: ⚠️ "Title exceeds 100 characters"
5. Node in tree shows truncated title with "..."

**Expected Result:** ✅ Handles long titles gracefully

---

### 5.9 Performance: Large Hierarchy

**Steps:**
1. Create diagram with 100 nodes:
   - 1 root Category
   - 10 child Categories
   - 5 Guides per Category (50 total)
   - 1 Article per Guide (50 total)
2. Measure render time
3. Zoom in/out
4. Pan around
5. Select various nodes

**Expected Result:** ✅ Renders in < 2s, smooth interactions

---

## 6. Out of Scope (Post-MVP)

### 6.1 Phase 2 Features

**Import from Expert API:**
- Fetch existing Expert hierarchy
- Convert to diagram format
- Visualize in tree

**Commit to Expert API:**
- POST requests to create pages
- Batch operations with progress
- Dry-run mode
- Error handling & rollback

### 6.2 Phase 3 Features

**Undo/Redo:**
- History stack (50 states)
- Undo button (Ctrl+Z)
- Redo button (Ctrl+Shift+Z)

**Templates:**
- Pre-built hierarchy patterns
- "Product Docs Template"
- "Customer Support Template"
- "API Reference Template"

**Additional Export Formats:**
- PNG image export
- Markdown outline export
- CSV node list export

**Collaboration:**
- Share diagram via URL
- Real-time co-editing (very long-term)

---

## 7. Success Metrics

### 7.1 MVP Launch Goals

| Metric | Target | Measure |
|--------|--------|---------|
| **Adoption** | 5 users within 2 weeks | User accounts using the feature |
| **Engagement** | Average 3 diagrams per user | Diagrams created |
| **Export** | 50% of diagrams exported | Export button clicks |
| **Satisfaction** | 4/5 average rating | User feedback survey |

### 7.2 User Feedback Questions

Post-launch survey (send after 1 week of use):

1. **Usefulness:** How useful is the Visual Hierarchy Creator for planning content? (1-5)
2. **Ease of Use:** How easy was it to learn and use? (1-5)
3. **Performance:** Were there any performance issues? (Yes/No/Comments)
4. **Missing Features:** What features do you wish it had?
5. **API Integration:** Would you use a feature to commit hierarchies directly to Expert? (Yes/No)
6. **Recommend:** Would you recommend this tool to colleagues? (Yes/No)

---

## 8. Launch Checklist

### 8.1 Pre-Launch

- [ ] All MVP features implemented and tested
- [ ] Documentation updated (README, inline help)
- [ ] Code reviewed by team
- [ ] Cross-browser testing complete
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed (basic)

### 8.2 Launch

- [ ] Merge to `develop` branch
- [ ] Deploy to staging for UAT
- [ ] Announce in team Slack/email
- [ ] Create user guide or video walkthrough
- [ ] Monitor for errors/crashes

### 8.3 Post-Launch

- [ ] Collect user feedback
- [ ] Monitor usage analytics
- [ ] Address critical bugs within 48h
- [ ] Plan Phase 2 (API integration) based on feedback

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **D3.js learning curve** | Medium | Medium | Allocate extra time for Step 2-3, reference examples |
| **Performance with large trees** | Low | High | Implement virtualization if needed (post-MVP) |
| **Browser compatibility** | Low | Medium | Test early and often across browsers |
| **User finds UI confusing** | Medium | High | Get early user feedback on mockups |
| **localStorage quota exceeded** | Low | Medium | Add quota check, warn user, implement cleanup |

---

## 10. Appendix

### 10.1 Example Export JSON

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Product Knowledge Base",
  "created": 1698765432000,
  "modified": 1698765432000,
  "nodes": [
    {
      "id": "node-1",
      "type": "category",
      "title": "Getting Started",
      "description": "Introduction to our product",
      "parentId": null
    },
    {
      "id": "node-2",
      "type": "guide",
      "title": "Installation",
      "description": "How to install the product",
      "parentId": "node-1"
    },
    {
      "id": "node-3",
      "type": "article",
      "title": "System Requirements",
      "description": "Minimum requirements for installation",
      "parentId": "node-2",
      "articleType": "reference"
    }
  ],
  "validation": {
    "valid": true,
    "errors": []
  }
}
```

### 10.2 Validation Error Examples

```json
{
  "validation": {
    "valid": false,
    "errors": [
      {
        "nodeId": "node-5",
        "type": "duplicate-title",
        "message": "Node 'Installation' has same title as sibling node-2"
      },
      {
        "nodeId": "node-7",
        "type": "invalid-parent",
        "message": "Articles cannot contain children"
      }
    ]
  }
}
```

---

**Document Status:** ✅ Complete
**Ready for Implementation:** Yes
**Estimated MVP Effort:** 20-30 hours
**Target Completion:** TBD
