/**
 * CSS Editor Embeddable Loader
 *
 * Usage: Add this script to the <head> of your CX1 site:
 * <script src="https://benelliot-nice.sgp1.digitaloceanspaces.com/media/misc/expert-css/css-editor-embed.js"></script>
 *
 * This will create a floating toggle button in the top-right corner that opens/closes
 * a resizable, draggable CSS editor overlay.
 */

(function() {
    'use strict';

    // Configuration
    const CDN_BASE = 'https://benelliot-nice.sgp1.digitaloceanspaces.com/media/misc/expert-css';
    const CSS_URL = `${CDN_BASE}/css-editor.css`;
    const JS_URL = `${CDN_BASE}/css-editor.js`;

    // State
    let isEditorOpen = false;
    let isDragging = false;
    let isResizing = false;
    let resizeDirection = null; // 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
    let dragStartX = 0;
    let dragStartY = 0;
    let overlayStartX = 0;
    let overlayStartY = 0;
    let overlayStartWidth = 0;
    let overlayStartHeight = 0;
    let resizeStartX = 0;
    let resizeStartY = 0;

    // DOM Elements (created on load)
    let toggleButton = null;
    let overlay = null;
    let overlayHeader = null;
    let overlayContent = null;
    let resizeHandles = {}; // Store all resize handles

    console.log('[CSS Editor Embed] Initializing...');

    /**
     * Load external CSS file
     */
    function loadCSS(url) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = () => {
                console.log('[CSS Editor Embed] CSS loaded:', url);
                resolve();
            };
            link.onerror = () => {
                console.error('[CSS Editor Embed] Failed to load CSS:', url);
                reject(new Error(`Failed to load CSS: ${url}`));
            };
            document.head.appendChild(link);
        });
    }

    /**
     * Load external JS file
     */
    function loadJS(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                console.log('[CSS Editor Embed] JS loaded:', url);
                resolve();
            };
            script.onerror = () => {
                console.error('[CSS Editor Embed] Failed to load JS:', url);
                reject(new Error(`Failed to load JS: ${url}`));
            };
            document.body.appendChild(script);
        });
    }

    /**
     * Create the floating toggle button
     */
    function createToggleButton() {
        toggleButton = document.createElement('button');
        toggleButton.id = 'css-editor-toggle';
        toggleButton.innerHTML = '&lt;/&gt;';
        toggleButton.title = 'Toggle CSS Editor';
        toggleButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: 3px solid white;
            color: white;
            font-size: 20px;
            font-weight: bold;
            font-family: monospace;
            cursor: pointer;
            z-index: 999998;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
        `;

        toggleButton.addEventListener('mouseenter', () => {
            toggleButton.style.transform = 'scale(1.1) rotate(5deg)';
            toggleButton.style.boxShadow = '0 6px 30px rgba(102, 126, 234, 0.5)';
        });

        toggleButton.addEventListener('mouseleave', () => {
            toggleButton.style.transform = 'scale(1) rotate(0deg)';
            toggleButton.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        });

        toggleButton.addEventListener('click', toggleEditor);

        document.body.appendChild(toggleButton);
        console.log('[CSS Editor Embed] Toggle button created');
    }

    /**
     * Create the floating overlay container
     */
    function createOverlay() {
        // Main overlay container
        overlay = document.createElement('div');
        overlay.id = 'css-editor-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 80px;
            right: 40px;
            width: 1200px;
            height: 800px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 60px rgba(0, 0, 0, 0.4);
            z-index: 999999;
            display: none;
            flex-direction: column;
            overflow: hidden;
            resize: none;
        `;

        // Header bar (draggable)
        overlayHeader = document.createElement('div');
        overlayHeader.id = 'css-editor-overlay-header';
        overlayHeader.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-weight: 600;
            font-size: 14px;
            cursor: move;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid rgba(255, 255, 255, 0.2);
        `;

        const headerTitle = document.createElement('span');
        headerTitle.textContent = 'CXone Expert CSS Editor';
        overlayHeader.appendChild(headerTitle);

        const headerButtons = document.createElement('div');
        headerButtons.style.cssText = 'display: flex; gap: 8px; align-items: center;';

        // Live Preview toggle button
        const livePreviewBtn = document.createElement('button');
        livePreviewBtn.id = 'live-preview-toggle';
        livePreviewBtn.innerHTML = '👁️';

        // Initialize button appearance based on current state (will be set after preferences load)
        const initialState = window.cssEditorEnableLivePreview || false;
        livePreviewBtn.title = `Toggle Live Preview (currently ${initialState ? 'ON' : 'OFF'})`;
        livePreviewBtn.style.cssText = `
            background: ${initialState ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'};
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        `;
        livePreviewBtn.addEventListener('mouseenter', () => {
            const isEnabled = window.cssEditorEnableLivePreview;
            livePreviewBtn.style.background = isEnabled ? 'rgba(76, 175, 80, 0.4)' : 'rgba(244, 67, 54, 0.4)';
        });
        livePreviewBtn.addEventListener('mouseleave', () => {
            const isEnabled = window.cssEditorEnableLivePreview;
            livePreviewBtn.style.background = isEnabled ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)';
        });
        livePreviewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLivePreview();
        });

        const minimizeBtn = document.createElement('button');
        minimizeBtn.innerHTML = '−';
        minimizeBtn.title = 'Minimize';
        minimizeBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 20px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        `;
        minimizeBtn.addEventListener('mouseenter', () => {
            minimizeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        });
        minimizeBtn.addEventListener('mouseleave', () => {
            minimizeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        });
        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleEditor();
        });

        headerButtons.appendChild(livePreviewBtn);
        headerButtons.appendChild(minimizeBtn);
        overlayHeader.appendChild(headerButtons);

        // Content area (contains the actual editor)
        overlayContent = document.createElement('div');
        overlayContent.id = 'css-editor-overlay-content';
        overlayContent.style.cssText = `
            flex: 1;
            overflow: auto;
            background: #f5f5f5;
        `;

        // Create resize handles for all edges and corners
        createResizeHandles();

        // Assemble overlay
        overlay.appendChild(overlayHeader);
        overlay.appendChild(overlayContent);
        document.body.appendChild(overlay);

        // Attach drag listeners
        overlayHeader.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);

        // Attach resize listeners
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);

        console.log('[CSS Editor Embed] Overlay created');
    }

    /**
     * Create resize handles for all edges and corners
     */
    function createResizeHandles() {
        const handleSize = 8; // Size of edge handles
        const cornerSize = 40; // Size of corner handles (increased for easier grabbing)

        const handles = [
            // Corners (larger grab area)
            { dir: 'nw', cursor: 'nw-resize', top: '0', left: '0', width: cornerSize, height: cornerSize },
            { dir: 'ne', cursor: 'ne-resize', top: '0', right: '0', width: cornerSize, height: cornerSize },
            { dir: 'sw', cursor: 'sw-resize', bottom: '0', left: '0', width: cornerSize, height: cornerSize },
            { dir: 'se', cursor: 'se-resize', bottom: '0', right: '0', width: cornerSize, height: cornerSize },
            // Edges
            { dir: 'n', cursor: 'n-resize', top: '0', left: cornerSize, right: cornerSize, height: handleSize },
            { dir: 's', cursor: 's-resize', bottom: '0', left: cornerSize, right: cornerSize, height: handleSize },
            { dir: 'e', cursor: 'e-resize', top: cornerSize, bottom: cornerSize, right: '0', width: handleSize },
            { dir: 'w', cursor: 'w-resize', top: cornerSize, bottom: cornerSize, left: '0', width: handleSize },
        ];

        handles.forEach(config => {
            const handle = document.createElement('div');
            handle.className = 'css-editor-resize-handle';
            handle.dataset.direction = config.dir;

            let styles = `
                position: absolute;
                cursor: ${config.cursor};
                z-index: 10;
            `;

            // Position
            if (config.top !== undefined) styles += `top: ${config.top}px;`;
            if (config.bottom !== undefined) styles += `bottom: ${config.bottom}px;`;
            if (config.left !== undefined) styles += `left: ${config.left}px;`;
            if (config.right !== undefined) styles += `right: ${config.right}px;`;

            // Size
            if (config.width) styles += `width: ${config.width}px;`;
            if (config.height) styles += `height: ${config.height}px;`;

            // Corner handles are transparent (no visual indicator)
            if (config.dir.length === 2) {
                styles += `background: transparent;`;
            }

            handle.style.cssText = styles;

            handle.addEventListener('mousedown', (e) => startResize(e, config.dir));
            overlay.appendChild(handle);
            resizeHandles[config.dir] = handle;
        });

        console.log('[CSS Editor Embed] Created resize handles:', Object.keys(resizeHandles));
    }

    /**
     * Load the CSS editor content into the overlay
     */
    function loadEditorContent() {
        // Read the cxone-embed.html structure and inject it
        overlayContent.innerHTML = `
            <div id="css-editor-app" class="container" style="padding: 0; max-width: none; margin: 0;">
                <div id="message-area"></div>
                <div id="loading" class="loading" style="display: none;">Loading CSS from legacy system...</div>
                <div id="editor-container" style="display: none;">
                    <div class="toggle-bar">
                        <button class="toggle-btn" data-role="all">All Roles</button>
                        <button class="toggle-btn" data-role="anonymous">Anonymous</button>
                        <button class="toggle-btn" data-role="viewer">Community Member</button>
                        <button class="toggle-btn" data-role="seated">Pro Member</button>
                        <button class="toggle-btn" data-role="admin">Admin</button>
                        <button class="toggle-btn" data-role="grape">Legacy Browser</button>
                        <div class="save-dropdown">
                            <button class="btn btn-primary" id="save-btn">Save All</button>
                            <button class="btn btn-dropdown-toggle" id="save-dropdown-toggle">▼</button>
                            <div class="dropdown-menu" id="save-dropdown-menu">
                                <button class="dropdown-item" id="discard-btn">Revert All</button>
                            </div>
                        </div>
                    </div>
                    <div id="editors-grid" class="editors-grid"></div>
                </div>
            </div>
        `;

        console.log('[CSS Editor Embed] Editor content loaded');
    }

    /**
     * Toggle live preview on/off
     */
    function toggleLivePreview() {
        window.cssEditorEnableLivePreview = !window.cssEditorEnableLivePreview;
        const isEnabled = window.cssEditorEnableLivePreview;

        console.log(`[CSS Editor Embed] Live preview ${isEnabled ? 'enabled' : 'disabled'}`);

        // Save preference to localStorage
        try {
            localStorage.setItem('cssEditorLivePreviewEnabled', isEnabled ? 'true' : 'false');
            console.log(`[CSS Editor Embed] Saved live preview preference: ${isEnabled}`);
        } catch (error) {
            console.warn('[CSS Editor Embed] Failed to save live preview preference:', error);
        }

        // Update button appearance
        const btn = document.getElementById('live-preview-toggle');
        if (btn) {
            btn.style.background = isEnabled ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)';
            btn.title = `Toggle Live Preview (currently ${isEnabled ? 'ON' : 'OFF'})`;
        }

        // If enabling, trigger an immediate update
        if (isEnabled && typeof window.updateLivePreview === 'function') {
            window.updateLivePreview();
        }

        // If disabling, clear the live preview
        if (!isEnabled && typeof window.clearLivePreview === 'function') {
            window.clearLivePreview();
        }
    }

    /**
     * Toggle editor visibility
     */
    function toggleEditor() {
        isEditorOpen = !isEditorOpen;

        if (isEditorOpen) {
            overlay.style.display = 'flex';
            toggleButton.style.opacity = '0.7';
            console.log('[CSS Editor Embed] Editor opened');

            // Update editor heights now that overlay is visible
            // Use setTimeout to let the browser render first
            setTimeout(() => {
                updateEditorHeights();
            }, 100);
        } else {
            overlay.style.display = 'none';
            toggleButton.style.opacity = '1';
            console.log('[CSS Editor Embed] Editor closed');
        }
    }

    /**
     * Dragging functionality
     */
    function startDrag(e) {
        if (e.target !== overlayHeader && !overlayHeader.contains(e.target)) return;
        if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking buttons

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        const rect = overlay.getBoundingClientRect();
        overlayStartX = rect.left;
        overlayStartY = rect.top;

        overlayHeader.style.cursor = 'grabbing';
        e.preventDefault();
    }

    function handleDrag(e) {
        if (!isDragging) return;

        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;

        const newX = overlayStartX + deltaX;
        const newY = overlayStartY + deltaY;

        // Constrain to viewport
        const maxX = window.innerWidth - overlay.offsetWidth;
        const maxY = window.innerHeight - overlay.offsetHeight;

        overlay.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
        overlay.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
        overlay.style.right = 'auto';
    }

    function stopDrag() {
        if (!isDragging) return;
        isDragging = false;
        overlayHeader.style.cursor = 'move';
    }

    /**
     * Resizing functionality
     */
    function startResize(e, direction) {
        isResizing = true;
        resizeDirection = direction;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;

        const rect = overlay.getBoundingClientRect();
        overlayStartX = rect.left;
        overlayStartY = rect.top;
        overlayStartWidth = rect.width;
        overlayStartHeight = rect.height;

        e.preventDefault();
        e.stopPropagation();
    }

    function handleResize(e) {
        if (!isResizing) return;

        const deltaX = e.clientX - resizeStartX;
        const deltaY = e.clientY - resizeStartY;

        const minWidth = 800;
        const minHeight = 600;

        let newWidth = overlayStartWidth;
        let newHeight = overlayStartHeight;
        let newX = overlayStartX;
        let newY = overlayStartY;

        // Calculate new dimensions based on resize direction
        if (resizeDirection.includes('e')) {
            // East - increase width
            newWidth = Math.max(minWidth, overlayStartWidth + deltaX);
        }
        if (resizeDirection.includes('w')) {
            // West - decrease width and move left
            const targetWidth = overlayStartWidth - deltaX;
            if (targetWidth >= minWidth) {
                // Can resize - adjust both width and position
                newWidth = targetWidth;
                newX = overlayStartX + deltaX;
            } else {
                // Hit minimum - keep at min width but don't move position
                newWidth = minWidth;
                newX = overlayStartX + (overlayStartWidth - minWidth);
            }
        }
        if (resizeDirection.includes('s')) {
            // South - increase height
            newHeight = Math.max(minHeight, overlayStartHeight + deltaY);
        }
        if (resizeDirection.includes('n')) {
            // North - decrease height and move up
            const targetHeight = overlayStartHeight - deltaY;
            if (targetHeight >= minHeight) {
                // Can resize - adjust both height and position
                newHeight = targetHeight;
                newY = overlayStartY + deltaY;
            } else {
                // Hit minimum - keep at min height but don't move position
                newHeight = minHeight;
                newY = overlayStartY + (overlayStartHeight - minHeight);
            }
        }

        // Constrain to viewport
        const maxX = window.innerWidth - newWidth;
        const maxY = window.innerHeight - newHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        // Apply new dimensions and position
        overlay.style.width = newWidth + 'px';
        overlay.style.height = newHeight + 'px';
        overlay.style.left = newX + 'px';
        overlay.style.top = newY + 'px';
        overlay.style.right = 'auto';
        overlay.style.bottom = 'auto';

        // Trigger mobile/desktop detection in main JS
        if (typeof window.checkViewportWidth === 'function') {
            window.checkViewportWidth();
        }

        // Update editor heights to match overlay
        updateEditorHeights();
    }

    /**
     * Calculate and set proper heights for editors based on overlay size
     */
    function updateEditorHeights() {
        // Don't run if overlay is not visible
        if (!overlay || overlay.style.display === 'none') {
            console.log('[CSS Editor Embed] Skipping height update - overlay not visible');
            return;
        }

        const editorContainer = document.getElementById('editor-container');
        if (!editorContainer || editorContainer.style.display === 'none') {
            console.log('[CSS Editor Embed] Skipping height update - editor container not visible');
            return;
        }

        const toggleBar = editorContainer.querySelector('.toggle-bar');
        const editorsGrid = document.getElementById('editors-grid');

        if (!toggleBar || !editorsGrid) {
            console.log('[CSS Editor Embed] Skipping height update - required elements not found');
            return;
        }

        // Calculate available height
        const overlayHeight = overlay.offsetHeight;
        const headerHeight = overlayHeader.offsetHeight;
        const toggleBarHeight = toggleBar.offsetHeight;

        // Available height = overlay height - header - toggle bar
        const availableHeight = overlayHeight - headerHeight - toggleBarHeight;

        // Set grid height
        editorsGrid.style.height = availableHeight + 'px';

        // Set each pane height
        const panes = editorsGrid.querySelectorAll('.editor-pane');
        panes.forEach(pane => {
            pane.style.height = availableHeight + 'px';

            // Find editor instance and calculate its height
            const paneHeader = pane.querySelector('.editor-pane-header');
            const editorInstance = pane.querySelector('.editor-instance');

            if (paneHeader && editorInstance) {
                const paneHeaderHeight = paneHeader.offsetHeight;
                const editorHeight = availableHeight - paneHeaderHeight;
                editorInstance.style.height = editorHeight + 'px';
            }
        });

        // Trigger Monaco layout update
        if (typeof window.editorState !== 'undefined') {
            Object.keys(window.editorState).forEach(role => {
                const state = window.editorState[role];
                if (state && state.editor) {
                    const container = document.getElementById(`editor-${role}`);
                    if (container) {
                        const rect = container.getBoundingClientRect();
                        state.editor.layout({ width: rect.width, height: rect.height });
                    }
                }
            });
        }

        console.log('[CSS Editor Embed] Updated editor heights:', {
            overlayHeight,
            headerHeight,
            toggleBarHeight,
            availableHeight
        });
    }

    function stopResize() {
        if (!isResizing) return;
        isResizing = false;
        resizeDirection = null;
    }

    /**
     * Initialize everything when DOM is ready
     */
    async function init() {
        // Expose updateEditorHeights to window scope so main JS can call it
        window.cssEditorUpdateHeights = updateEditorHeights;
        try {
            console.log('[CSS Editor Embed] Loading resources...');

            // IMPORTANT: Load live preview preference from localStorage BEFORE loading any resources
            // This must happen before the main JS loads so DOMContentLoaded can see it
            // Default to OFF (false) if no preference is saved
            try {
                const savedPreference = localStorage.getItem('cssEditorLivePreviewEnabled');
                if (savedPreference === 'true') {
                    window.cssEditorEnableLivePreview = true;
                    console.log('[CSS Editor Embed] Live preview enabled from saved preference');
                } else if (savedPreference === 'false') {
                    window.cssEditorEnableLivePreview = false;
                    console.log('[CSS Editor Embed] Live preview disabled from saved preference');
                } else {
                    // No saved preference - default to OFF
                    window.cssEditorEnableLivePreview = false;
                    console.log('[CSS Editor Embed] Live preview defaulting to OFF (no saved preference)');
                }
            } catch (error) {
                // localStorage might not be available
                console.warn('[CSS Editor Embed] Failed to load live preview preference, defaulting to OFF:', error);
                window.cssEditorEnableLivePreview = false;
            }

            // Load CSS first
            await loadCSS(CSS_URL);

            // Create UI elements
            createToggleButton();
            createOverlay();
            loadEditorContent();

            // Load main editor JS last (it auto-initializes on DOMContentLoaded)
            await loadJS(JS_URL);

            // Wait a bit for the main JS to initialize, then manually trigger if needed
            setTimeout(() => {
                // Check if editor hasn't auto-initialized
                if (typeof window.loadCSS === 'function') {
                    const loading = document.getElementById('loading');
                    const editorContainer = document.getElementById('editor-container');

                    // If editor hasn't loaded yet, trigger it manually
                    if (!loading || loading.style.display === 'none') {
                        if (!editorContainer || editorContainer.style.display === 'none') {
                            console.log('[CSS Editor Embed] Manually triggering CSS load');
                            window.loadCSS();
                        }
                    }
                }
            }, 500);

            console.log('[CSS Editor Embed] Initialization complete!');
        } catch (error) {
            console.error('[CSS Editor Embed] Initialization failed:', error);
        }
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded
        init();
    }
})();
