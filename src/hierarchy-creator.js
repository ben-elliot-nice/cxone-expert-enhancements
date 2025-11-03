/**
 * CXone Expert Enhancements - Visual Hierarchy Creator
 *
 * Interactive diagramming tool for planning knowledge base hierarchies.
 * Allows users to visually design Category → Guide → Article structures.
 *
 * @version 1.0.0
 * @see docs/HIERARCHY_CREATOR_ARCHITECTURE.md
 */

// ES Module - import dependencies
import { AppManager } from './core.js';
import * as d3 from 'd3';

console.log('[Hierarchy Creator] Loading...');

// ============================================================================
// State & Configuration
// ============================================================================

let context = null;
let state = {
    diagrams: [],
    activeDiagramId: null,
    selectedNodeId: null,
    canvasTransform: { x: 0, y: 0, scale: 1 }
};

// D3 references
let svg = null;
let g = null;
let treeLayout = null;
let zoom = null;

// Debounce timer for auto-save
let saveDebounceTimer = null;

// ============================================================================
// App Interface Implementation
// ============================================================================

const HierarchyCreatorApp = {
    id: 'hierarchy-creator',
    name: 'Hierarchy Creator',

    dependencies: ['settings'],

    constraints: {
        minWidth: 800,
        minHeight: 600
    },

    /**
     * Initialize the app with context
     */
    async init(ctx) {
        console.log('[Hierarchy Creator] Initializing...');
        context = ctx;
        console.log('[Hierarchy Creator] Initialized');
    },

    /**
     * Mount the app into the container
     */
    async mount(container) {
        console.log('[Hierarchy Creator] Mounting...');

        // Load saved state
        const savedState = context.Storage.getAppState(this.id);
        if (savedState) {
            this.setState(savedState);
        } else {
            // Create default diagram
            this.createDefaultDiagram();
        }

        // Build UI
        this.buildUI(container);

        // Initialize D3
        this.initD3();

        // Render tree
        this.renderTree();

        console.log('[Hierarchy Creator] Mounted');
    },

    /**
     * Unmount the app and cleanup
     */
    async unmount() {
        console.log('[Hierarchy Creator] Unmounting...');

        // Save state before unmounting
        this.saveState();

        // Clear timers
        if (saveDebounceTimer) {
            clearTimeout(saveDebounceTimer);
        }

        // Clear D3 references
        svg = null;
        g = null;
        treeLayout = null;
        zoom = null;

        console.log('[Hierarchy Creator] Unmounted');
    },

    /**
     * Get current state for persistence
     */
    getState() {
        return {
            diagrams: state.diagrams,
            activeDiagramId: state.activeDiagramId,
            selectedNodeId: state.selectedNodeId,
            canvasTransform: state.canvasTransform
        };
    },

    /**
     * Restore state from persistence
     */
    setState(savedState) {
        if (!savedState) return;

        state.diagrams = savedState.diagrams || [];
        state.activeDiagramId = savedState.activeDiagramId;
        state.selectedNodeId = savedState.selectedNodeId;
        state.canvasTransform = savedState.canvasTransform || { x: 0, y: 0, scale: 1 };

        console.log('[Hierarchy Creator] State restored:', state.diagrams.length, 'diagram(s)');
    },

    /**
     * Handle overlay resize
     */
    onResize() {
        if (svg) {
            // Update SVG dimensions on resize
            this.updateCanvasSize();
            this.renderTree();
        }
    },

    // ========================================================================
    // UI Building
    // ========================================================================

    buildUI(container) {
        container.innerHTML = `
            <div class="hierarchy-creator-container">
                <!-- Toolbar -->
                <div class="hierarchy-toolbar">
                    <div class="toolbar-left">
                        <select id="diagram-selector" class="diagram-selector">
                            ${this.renderDiagramOptions()}
                        </select>
                        <button id="new-diagram-btn" class="toolbar-btn" title="Create new diagram">
                            + New Diagram
                        </button>
                    </div>
                    <div class="toolbar-right">
                        <button id="add-category-btn" class="toolbar-btn toolbar-btn-category" title="Add Category">
                            + Category
                        </button>
                        <button id="add-guide-btn" class="toolbar-btn toolbar-btn-guide" title="Add Guide" disabled>
                            + Guide
                        </button>
                        <button id="add-article-btn" class="toolbar-btn toolbar-btn-article" title="Add Article" disabled>
                            + Article
                        </button>
                        <button id="delete-node-btn" class="toolbar-btn toolbar-btn-delete" title="Delete selected node" disabled>
                            Delete
                        </button>
                        <button id="export-json-btn" class="toolbar-btn toolbar-btn-export" title="Export as JSON">
                            Export JSON
                        </button>
                    </div>
                </div>

                <!-- Main Content Area -->
                <div class="hierarchy-content">
                    <!-- Canvas (D3.js tree diagram) -->
                    <div class="hierarchy-canvas" id="hierarchy-canvas">
                        <!-- SVG will be created here by D3 -->
                    </div>

                    <!-- Properties Panel -->
                    <div class="hierarchy-properties">
                        <div id="properties-content" class="properties-content">
                            <div class="properties-empty">
                                <p>Select a node to edit its properties</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners
        this.attachEventListeners();
    },

    renderDiagramOptions() {
        if (state.diagrams.length === 0) {
            return '<option value="">No diagrams</option>';
        }

        return state.diagrams.map(d =>
            `<option value="${d.id}" ${d.id === state.activeDiagramId ? 'selected' : ''}>
                ${d.name}
            </option>`
        ).join('');
    },

    attachEventListeners() {
        // Diagram selector
        document.getElementById('diagram-selector')?.addEventListener('change', (e) => {
            this.loadDiagram(e.target.value);
        });

        // New diagram button
        document.getElementById('new-diagram-btn')?.addEventListener('click', () => {
            this.showNewDiagramModal();
        });

        // Add node buttons
        document.getElementById('add-category-btn')?.addEventListener('click', () => {
            this.addNode('category');
        });

        document.getElementById('add-guide-btn')?.addEventListener('click', () => {
            this.addNode('guide');
        });

        document.getElementById('add-article-btn')?.addEventListener('click', () => {
            this.addNode('article');
        });

        // Delete button
        document.getElementById('delete-node-btn')?.addEventListener('click', () => {
            this.deleteSelectedNode();
        });

        // Export button
        document.getElementById('export-json-btn')?.addEventListener('click', () => {
            this.exportDiagram();
        });
    },

    // ========================================================================
    // D3.js Initialization and Rendering
    // ========================================================================

    initD3() {
        const canvasEl = document.getElementById('hierarchy-canvas');
        if (!canvasEl) return;

        // Clear existing SVG
        canvasEl.innerHTML = '';

        // Get dimensions
        const rect = canvasEl.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 600;

        // Create SVG
        svg = d3.select('#hierarchy-canvas')
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`);

        // Create zoom behavior
        zoom = d3.zoom()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                state.canvasTransform = {
                    x: event.transform.x,
                    y: event.transform.y,
                    scale: event.transform.k
                };
                this.saveStateDebounced();
            });

        svg.call(zoom);

        // Create main group for tree
        g = svg.append('g');

        // Restore zoom/pan state
        const transform = d3.zoomIdentity
            .translate(state.canvasTransform.x, state.canvasTransform.y)
            .scale(state.canvasTransform.scale);
        svg.call(zoom.transform, transform);

        // Create tree layout
        treeLayout = d3.tree()
            .size([width - 200, height - 200])
            .separation((a, b) => a.parent === b.parent ? 1 : 1.5);

        console.log('[Hierarchy Creator] D3 initialized');
    },

    updateCanvasSize() {
        const canvasEl = document.getElementById('hierarchy-canvas');
        if (!canvasEl || !svg) return;

        const rect = canvasEl.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 600;

        svg.attr('viewBox', `0 0 ${width} ${height}`);

        if (treeLayout) {
            treeLayout.size([width - 200, height - 200]);
        }
    },

    renderTree() {
        if (!g) return;

        const diagram = this.getActiveDiagram();
        if (!diagram || diagram.nodes.length === 0) {
            this.showEmptyState();
            return;
        }

        try {
            // Build hierarchy from flat nodes array
            const root = this.buildHierarchy(diagram.nodes);

            // Get canvas dimensions
            const canvasEl = document.getElementById('hierarchy-canvas');
            const rect = canvasEl.getBoundingClientRect();
            const width = rect.width || 800;
            const height = rect.height || 600;

            // Update tree layout size
            treeLayout.size([width - 200, height - 200]);

            // Compute tree layout
            const treeData = treeLayout(root);

            // Render nodes and edges
            this.renderNodes(treeData.descendants());
            this.renderEdges(treeData.links());

        } catch (error) {
            console.error('[Hierarchy Creator] Error rendering tree:', error);
            context.UI.showToast('Error rendering tree: ' + error.message, 'error');
        }
    },

    buildHierarchy(nodes) {
        // Find root node (parentId === null)
        const rootNode = nodes.find(n => n.parentId === null);
        if (!rootNode) {
            throw new Error('No root node found');
        }

        // Recursive function to build tree structure
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
    },

    renderNodes(nodes) {
        if (!g) return;

        // Data join
        const nodeGroups = g.selectAll('.node')
            .data(nodes, d => d.data.id);

        // Exit - remove old nodes
        nodeGroups.exit().remove();

        // Enter - create new nodes
        const nodeEnter = nodeGroups.enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .on('click', (event, d) => this.handleNodeClick(event, d));

        // Render node shapes based on type
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

                // Title text
                g.append('text')
                    .attr('class', 'node-title')
                    .attr('y', 5)
                    .attr('text-anchor', 'middle')
                    .text(node.title.substring(0, 15) + (node.title.length > 15 ? '...' : ''));

            } else if (node.type === 'guide') {
                // Rounded rectangle
                g.append('rect')
                    .attr('class', 'node-guide')
                    .attr('x', -50)
                    .attr('y', -20)
                    .attr('width', 100)
                    .attr('height', 40)
                    .attr('rx', 12);

                // Title text
                g.append('text')
                    .attr('class', 'node-title')
                    .attr('y', 5)
                    .attr('text-anchor', 'middle')
                    .text(node.title.substring(0, 12) + (node.title.length > 12 ? '...' : ''));

            } else if (node.type === 'article') {
                // Circle
                g.append('circle')
                    .attr('class', 'node-article')
                    .attr('r', 20);

                // Article type badge
                const badgeText = node.articleType ? node.articleType[0].toUpperCase() : 'T';
                g.append('text')
                    .attr('class', 'article-type-badge')
                    .attr('y', 4)
                    .text(badgeText);

                // Title text below circle
                g.append('text')
                    .attr('class', 'node-title')
                    .attr('y', 35)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#2d3748')
                    .text(node.title.substring(0, 10) + (node.title.length > 10 ? '...' : ''));
            }

            // Add title attribute for tooltip
            g.append('title')
                .text(node.title + (node.description ? '\n' + node.description : ''));
        });

        // Update - update existing nodes
        const nodeUpdate = nodeGroups.merge(nodeEnter)
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .classed('selected', d => d.data.id === state.selectedNodeId);
    },

    renderEdges(links) {
        if (!g) return;

        // Link generator (curved paths)
        const linkGenerator = d3.linkVertical()
            .x(d => d.x)
            .y(d => d.y);

        // Data join
        const paths = g.selectAll('.link')
            .data(links, d => `${d.source.data.id}-${d.target.data.id}`);

        // Exit
        paths.exit().remove();

        // Enter + Update
        paths.enter()
            .insert('path', '.node')  // Insert before nodes so nodes are on top
            .attr('class', 'link')
            .merge(paths)
            .attr('d', linkGenerator);
    },

    handleNodeClick(event, d) {
        event.stopPropagation();

        // Update selection
        state.selectedNodeId = d.data.id;

        // Re-render to update selection state
        this.renderTree();

        // Update properties panel
        this.updatePropertiesPanel();

        // Update toolbar button states
        this.updateToolbar();

        console.log('[Hierarchy Creator] Node selected:', d.data.title);
    },

    showEmptyState() {
        if (!g) return;

        g.selectAll('*').remove();

        // Show empty state message
        const canvasEl = document.getElementById('hierarchy-canvas');
        if (canvasEl) {
            canvasEl.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #718096; font-size: 16px;">
                    Click "+ Category" to start building your hierarchy
                </div>
            `;
        }
    },

    // ========================================================================
    // Diagram Management
    // ========================================================================

    createDefaultDiagram() {
        const diagram = {
            id: this.generateUUID(),
            name: 'My Hierarchy',
            created: Date.now(),
            modified: Date.now(),
            nodes: [
                {
                    id: this.generateUUID(),
                    type: 'category',
                    title: 'Homepage',
                    description: 'Root category',
                    parentId: null
                }
            ],
            validation: {
                valid: true,
                errors: []
            }
        };

        state.diagrams.push(diagram);
        state.activeDiagramId = diagram.id;

        console.log('[Hierarchy Creator] Created default diagram');
    },

    getActiveDiagram() {
        return state.diagrams.find(d => d.id === state.activeDiagramId);
    },

    loadDiagram(diagramId) {
        state.activeDiagramId = diagramId;
        state.selectedNodeId = null;
        this.renderTree();
        this.updatePropertiesPanel();
        this.updateToolbar();
        this.saveStateDebounced();
    },

    showNewDiagramModal() {
        // TODO: Implement modal dialog
        const name = prompt('Enter diagram name:');
        if (!name) return;

        const diagram = {
            id: this.generateUUID(),
            name: name.trim(),
            created: Date.now(),
            modified: Date.now(),
            nodes: [{
                id: this.generateUUID(),
                type: 'category',
                title: 'Homepage',
                description: 'Root category',
                parentId: null
            }],
            validation: { valid: true, errors: [] }
        };

        state.diagrams.push(diagram);
        state.activeDiagramId = diagram.id;

        // Update UI
        this.updateDiagramSelector();
        this.renderTree();
        this.saveStateDebounced();

        context.UI.showToast(`Created diagram: ${name}`, 'success');
    },

    updateDiagramSelector() {
        const selector = document.getElementById('diagram-selector');
        if (selector) {
            selector.innerHTML = this.renderDiagramOptions();
        }
    },

    // ========================================================================
    // Node Operations (Stubs for now)
    // ========================================================================

    addNode(type) {
        const diagram = this.getActiveDiagram();
        if (!diagram) return;

        // Determine parent based on type and selection
        let parentId = null;
        const selectedNode = diagram.nodes.find(n => n.id === state.selectedNodeId);

        if (type === 'category') {
            // Category can be added as root or under another category
            if (selectedNode && selectedNode.type === 'category') {
                parentId = selectedNode.id;
            } else {
                // Check if a root node already exists
                const existingRoot = diagram.nodes.find(n => n.parentId === null);
                if (existingRoot) {
                    // Add as child of existing root instead of creating second root
                    parentId = existingRoot.id;
                    context.UI.showToast('Added category under root node', 'info', 3000);
                }
                // Otherwise parentId remains null (first root node)
            }
        } else if (type === 'guide') {
            // Guide must be added under a category
            if (!selectedNode || selectedNode.type !== 'category') {
                context.UI.showToast('Please select a Category first', 'error');
                return;
            }
            parentId = selectedNode.id;
        } else if (type === 'article') {
            // Article must be added under a guide
            if (!selectedNode || selectedNode.type !== 'guide') {
                context.UI.showToast('Please select a Guide first', 'error');
                return;
            }
            parentId = selectedNode.id;
        }

        // Create new node
        const newNode = {
            id: this.generateUUID(),
            type: type,
            title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            description: '',
            parentId: parentId
        };

        // Add article type if it's an article
        if (type === 'article') {
            newNode.articleType = 'topic';
        }

        // Add to diagram
        diagram.nodes.push(newNode);
        diagram.modified = Date.now();

        // Select the new node
        state.selectedNodeId = newNode.id;

        // Re-render
        this.renderTree();
        this.updatePropertiesPanel();
        this.updateToolbar();

        // Save state
        this.saveStateDebounced();

        context.UI.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} added`, 'success');
    },

    deleteSelectedNode() {
        if (!state.selectedNodeId) return;

        const diagram = this.getActiveDiagram();
        const node = diagram?.nodes.find(n => n.id === state.selectedNodeId);
        if (!node) return;

        // Count descendants
        const descendants = this.getDescendants(node.id);
        const totalToDelete = descendants.length + 1;

        // Confirm deletion
        const message = totalToDelete > 1
            ? `Delete "${node.title}"?\n\nThis will also delete ${descendants.length} child node(s).`
            : `Delete "${node.title}"?`;

        if (!confirm(message)) {
            return;
        }

        // Remove node and all descendants
        const nodeIdsToDelete = [node.id, ...descendants.map(n => n.id)];
        diagram.nodes = diagram.nodes.filter(n => !nodeIdsToDelete.includes(n.id));
        diagram.modified = Date.now();

        // Clear selection
        state.selectedNodeId = null;

        // Re-render
        this.renderTree();
        this.updatePropertiesPanel();
        this.updateToolbar();

        // Save state
        this.saveStateDebounced();

        context.UI.showToast(`Deleted ${totalToDelete} node(s)`, 'success');
    },

    getDescendants(nodeId) {
        const diagram = this.getActiveDiagram();
        if (!diagram) return [];

        const descendants = [];
        const children = diagram.nodes.filter(n => n.parentId === nodeId);

        children.forEach(child => {
            descendants.push(child);
            descendants.push(...this.getDescendants(child.id));
        });

        return descendants;
    },

    updatePropertiesPanel() {
        const panel = document.getElementById('properties-content');
        if (!panel) return;

        if (!state.selectedNodeId) {
            panel.innerHTML = `
                <div class="properties-empty">
                    <p>Select a node to edit its properties</p>
                </div>
            `;
            return;
        }

        const diagram = this.getActiveDiagram();
        const node = diagram?.nodes.find(n => n.id === state.selectedNodeId);
        if (!node) return;

        // Build properties form
        panel.innerHTML = `
            <div class="properties-form">
                <h3 class="properties-heading">${node.type.charAt(0).toUpperCase() + node.type.slice(1)} Properties</h3>

                <div class="property-group">
                    <label class="property-label" for="node-title">Title</label>
                    <input
                        type="text"
                        id="node-title"
                        class="property-input"
                        value="${this.escapeHtml(node.title)}"
                        maxlength="100"
                    />
                    <div class="character-count" id="title-count">${node.title.length}/100</div>
                </div>

                <div class="property-group">
                    <label class="property-label" for="node-description">Description</label>
                    <textarea
                        id="node-description"
                        class="property-input property-textarea"
                        maxlength="500"
                    >${this.escapeHtml(node.description || '')}</textarea>
                    <div class="character-count" id="desc-count">${(node.description || '').length}/500</div>
                </div>

                ${node.type === 'article' ? `
                    <div class="property-group">
                        <label class="property-label">Article Type</label>
                        <div class="property-radio-group">
                            <label class="property-radio-label">
                                <input
                                    type="radio"
                                    name="article-type"
                                    value="topic"
                                    ${node.articleType === 'topic' ? 'checked' : ''}
                                />
                                <span>Topic</span>
                            </label>
                            <label class="property-radio-label">
                                <input
                                    type="radio"
                                    name="article-type"
                                    value="reference"
                                    ${node.articleType === 'reference' ? 'checked' : ''}
                                />
                                <span>Reference</span>
                            </label>
                            <label class="property-radio-label">
                                <input
                                    type="radio"
                                    name="article-type"
                                    value="how-to"
                                    ${node.articleType === 'how-to' ? 'checked' : ''}
                                />
                                <span>How-To</span>
                            </label>
                        </div>
                    </div>
                ` : ''}

                <div class="properties-actions">
                    <button id="delete-node-prop-btn" class="properties-btn properties-btn-delete">
                        Delete Node
                    </button>
                </div>

                ${this.renderValidationStatus(node.id)}
            </div>
        `;

        // Attach event listeners for property changes
        document.getElementById('node-title')?.addEventListener('input', (e) => {
            this.updateNodeProperty('title', e.target.value);
            const count = document.getElementById('title-count');
            if (count) {
                count.textContent = `${e.target.value.length}/100`;
                count.className = 'character-count' + (e.target.value.length > 100 ? ' error' : '');
            }
        });

        document.getElementById('node-description')?.addEventListener('input', (e) => {
            this.updateNodeProperty('description', e.target.value);
            const count = document.getElementById('desc-count');
            if (count) {
                count.textContent = `${e.target.value.length}/500`;
                count.className = 'character-count' + (e.target.value.length > 500 ? ' error' : '');
            }
        });

        // Article type radio buttons
        document.querySelectorAll('input[name="article-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateNodeProperty('articleType', e.target.value);
            });
        });

        // Delete button
        document.getElementById('delete-node-prop-btn')?.addEventListener('click', () => {
            this.deleteSelectedNode();
        });
    },

    updateToolbar() {
        const diagram = this.getActiveDiagram();
        const selectedNode = diagram?.nodes.find(n => n.id === state.selectedNodeId);

        // Add Guide button - enabled only when Category is selected
        const addGuideBtn = document.getElementById('add-guide-btn');
        if (addGuideBtn) {
            addGuideBtn.disabled = !selectedNode || selectedNode.type !== 'category';
        }

        // Add Article button - enabled only when Guide is selected
        const addArticleBtn = document.getElementById('add-article-btn');
        if (addArticleBtn) {
            addArticleBtn.disabled = !selectedNode || selectedNode.type !== 'guide';
        }

        // Delete button - enabled when any node is selected
        const deleteBtn = document.getElementById('delete-node-btn');
        if (deleteBtn) {
            deleteBtn.disabled = !selectedNode;
        }
    },

    updateNodeProperty(property, value) {
        const diagram = this.getActiveDiagram();
        const node = diagram?.nodes.find(n => n.id === state.selectedNodeId);
        if (!node) return;

        node[property] = value;
        diagram.modified = Date.now();

        // Re-render tree to show updated title
        this.renderTree();

        // Save state (debounced)
        this.saveStateDebounced();
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    renderValidationStatus(nodeId) {
        const diagram = this.getActiveDiagram();
        if (!diagram) return '';

        // Validate diagram
        this.validateDiagram(diagram);

        // Check for errors related to this node
        const nodeErrors = diagram.validation.errors.filter(e => e.nodeId === nodeId);

        if (nodeErrors.length === 0) {
            return `
                <div class="validation-status valid">
                    ✅ No validation errors
                </div>
            `;
        }

        return `
            <div class="validation-status invalid">
                ⚠️ Validation Errors:
                <ul class="validation-errors">
                    ${nodeErrors.map(e => `<li>${e.message}</li>`).join('')}
                </ul>
            </div>
        `;
    },

    // ========================================================================
    // Validation
    // ========================================================================

    validateDiagram(diagram) {
        if (!diagram) return;

        const errors = [];

        // Check for cycles (basic check - ensure no node is its own ancestor)
        diagram.nodes.forEach(node => {
            if (this.hasCircularReference(node.id, diagram.nodes)) {
                errors.push({
                    nodeId: node.id,
                    type: 'cycle',
                    message: `Circular reference detected in "${node.title}"`
                });
            }
        });

        // Check for duplicate titles among siblings
        diagram.nodes.forEach(node => {
            const siblings = diagram.nodes.filter(n =>
                n.id !== node.id && n.parentId === node.parentId
            );

            const duplicate = siblings.find(s => s.title === node.title);
            if (duplicate) {
                errors.push({
                    nodeId: node.id,
                    type: 'duplicate-title',
                    message: `"${node.title}" has duplicate title with sibling node`
                });
            }
        });

        // Check for required fields
        diagram.nodes.forEach(node => {
            if (!node.title || node.title.trim() === '') {
                errors.push({
                    nodeId: node.id,
                    type: 'missing-field',
                    message: `Node is missing a title`
                });
            }

            if (node.type === 'article' && !node.articleType) {
                errors.push({
                    nodeId: node.id,
                    type: 'missing-field',
                    message: `Article "${node.title}" is missing article type`
                });
            }
        });

        // Update validation state
        diagram.validation = {
            valid: errors.length === 0,
            errors: errors
        };

        return diagram.validation;
    },

    hasCircularReference(nodeId, nodes, visited = new Set()) {
        if (visited.has(nodeId)) {
            return true; // Circular reference detected
        }

        const node = nodes.find(n => n.id === nodeId);
        if (!node || !node.parentId) {
            return false;
        }

        visited.add(nodeId);
        return this.hasCircularReference(node.parentId, nodes, visited);
    },

    // ========================================================================
    // Export
    // ========================================================================

    exportDiagram() {
        const diagram = this.getActiveDiagram();
        if (!diagram) {
            context.UI.showToast('No diagram to export', 'error');
            return;
        }

        // Validate before export
        const validation = this.validateDiagram(diagram);
        if (!validation.valid) {
            const errorCount = validation.errors.length;
            context.UI.showToast(
                `Cannot export: ${errorCount} validation error(s) found. Check properties panel.`,
                'error',
                5000
            );
            this.updatePropertiesPanel(); // Update to show errors
            return;
        }

        const json = JSON.stringify(diagram, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${diagram.name.replace(/\s+/g, '-').toLowerCase()}.json`;
        a.click();

        URL.revokeObjectURL(url);

        context.UI.showToast('Diagram exported successfully', 'success');
    },

    // ========================================================================
    // State Persistence
    // ========================================================================

    saveState() {
        const stateToSave = this.getState();
        context.Storage.setAppState(this.id, stateToSave);
        console.log('[Hierarchy Creator] State saved');
    },

    saveStateDebounced() {
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
            this.saveState();
        }, 500);
    },

    // ========================================================================
    // Utilities
    // ========================================================================

    generateUUID() {
        // Use native crypto API if available
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }

        // Fallback UUID v4 implementation
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};

// ============================================================================
// Register App
// ============================================================================

try {
    AppManager.register(HierarchyCreatorApp);
    console.log('[Hierarchy Creator] Registered successfully');
} catch (error) {
    console.error('[Hierarchy Creator] Failed to register:', error);
}

export { HierarchyCreatorApp };
