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
    let dragStartX = 0;
    let dragStartY = 0;
    let overlayStartX = 0;
    let overlayStartY = 0;
    let resizeStartWidth = 0;
    let resizeStartHeight = 0;
    let resizeStartX = 0;
    let resizeStartY = 0;

    // DOM Elements (created on load)
    let toggleButton = null;
    let overlay = null;
    let overlayHeader = null;
    let overlayContent = null;
    let resizeHandle = null;

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
        headerButtons.style.cssText = 'display: flex; gap: 8px;';

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

        // Resize handle (bottom-right corner)
        resizeHandle = document.createElement('div');
        resizeHandle.id = 'css-editor-resize-handle';
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            cursor: nwse-resize;
            background: linear-gradient(135deg, transparent 0%, transparent 50%, rgba(102, 126, 234, 0.5) 50%, rgba(102, 126, 234, 0.8) 100%);
            border-radius: 0 0 12px 0;
        `;

        // Assemble overlay
        overlay.appendChild(overlayHeader);
        overlay.appendChild(overlayContent);
        overlay.appendChild(resizeHandle);
        document.body.appendChild(overlay);

        // Attach drag listeners
        overlayHeader.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);

        // Attach resize listeners
        resizeHandle.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);

        console.log('[CSS Editor Embed] Overlay created');
    }

    /**
     * Load the CSS editor content into the overlay
     */
    function loadEditorContent() {
        // Read the cxone-embed.html structure and inject it
        overlayContent.innerHTML = `
            <div id="css-editor-app" class="container" style="padding: 1rem; max-width: none; margin: 0;">
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
     * Toggle editor visibility
     */
    function toggleEditor() {
        isEditorOpen = !isEditorOpen;

        if (isEditorOpen) {
            overlay.style.display = 'flex';
            toggleButton.style.opacity = '0.7';
            console.log('[CSS Editor Embed] Editor opened');
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
    function startResize(e) {
        isResizing = true;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartWidth = overlay.offsetWidth;
        resizeStartHeight = overlay.offsetHeight;
        e.preventDefault();
        e.stopPropagation();
    }

    function handleResize(e) {
        if (!isResizing) return;

        const deltaX = e.clientX - resizeStartX;
        const deltaY = e.clientY - resizeStartY;

        const newWidth = Math.max(800, resizeStartWidth + deltaX); // Min width 800px
        const newHeight = Math.max(600, resizeStartHeight + deltaY); // Min height 600px

        overlay.style.width = newWidth + 'px';
        overlay.style.height = newHeight + 'px';

        // Trigger Monaco resize if editors are active
        if (window.ResizeObserver && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new Event('resize'));
        }
    }

    function stopResize() {
        if (!isResizing) return;
        isResizing = false;
    }

    /**
     * Initialize everything when DOM is ready
     */
    async function init() {
        try {
            console.log('[CSS Editor Embed] Loading resources...');

            // Load CSS first
            await loadCSS(CSS_URL);

            // Create UI elements
            createToggleButton();
            createOverlay();
            loadEditorContent();

            // Load main editor JS last (it auto-initializes on DOMContentLoaded)
            await loadJS(JS_URL);

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
