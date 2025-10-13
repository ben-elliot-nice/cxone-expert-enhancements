/**
 * CSS Editor Embeddable Loader
 *
 * Usage: Add this script to the <head> of your CX1 site:
 * <script src="https://releases.benelliot-nice.com/cxone-expert-enhancements/latest/css-editor-embed.js"></script>
 *
 * This will create a floating toggle button in the top-right corner that opens/closes
 * a resizable, draggable CSS editor overlay.
 *
 * The script automatically detects its own location and loads companion files (CSS/JS)
 * from the same directory, so it works with any deployment path.
 */

(function() {
    'use strict';

    // Configuration - Auto-detect base URL from script location
    const scriptUrl = document.currentScript ? document.currentScript.src : '';
    const CDN_BASE = scriptUrl ? scriptUrl.substring(0, scriptUrl.lastIndexOf('/')) : '';
    const CSS_URL = `${CDN_BASE}/css-editor.css`;
    const JS_URL = `${CDN_BASE}/css-editor.js`;

    console.log('[CSS Editor Embed] Auto-detected CDN base:', CDN_BASE);

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
            top: 15px;
            right: -45px;
            width: 100px;
            height: 50px;
            border-radius: 25px;
            background: #667eea;
            border: 3px solid white;
            color: white;
            font-size: 20px;
            font-weight: bold;
            font-family: monospace;
            cursor: pointer;
            z-index: 999998;
            box-shadow: -4px 4px 20px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: left;
            padding-left: 12px;
            line-height: 1;
        `;

        toggleButton.addEventListener('mouseenter', () => {
            toggleButton.style.transform = 'scale(1.1)';
            toggleButton.style.boxShadow = '-6px 6px 30px rgba(102, 126, 234, 0.5)';
        });

        toggleButton.addEventListener('mouseleave', () => {
            toggleButton.style.transform = 'scale(1)';
            toggleButton.style.boxShadow = '-4px 4px 20px rgba(0, 0, 0, 0.3)';
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
            background: #667eea;
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

        // Role selector dropdown for preview
        const roleSelector = document.createElement('select');
        roleSelector.id = 'live-preview-role-selector';
        roleSelector.style.cssText = `
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.5);
            color: #333;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
        `;
        roleSelector.innerHTML = `
            <option value="anonymous">Anonymous</option>
            <option value="viewer">Community</option>
            <option value="seated">Pro</option>
            <option value="admin">Admin</option>
            <option value="grape">Legacy</option>
        `;
        // Load saved role preference
        try {
            const savedRole = localStorage.getItem('cssEditorPreviewRole') || 'anonymous';
            roleSelector.value = savedRole;
            console.log('[CSS Editor Embed] Loaded preview role from localStorage:', savedRole);
        } catch (error) {
            console.warn('[CSS Editor Embed] Failed to load preview role preference:', error);
        }
        roleSelector.addEventListener('change', (e) => {
            e.stopPropagation();
            console.log('[CSS Editor Embed] Role selector changed, calling handleRoleChange with:', e.target.value);
            handleRoleChange(e.target.value);
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
            position: relative;
            z-index: 20;
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
        headerButtons.appendChild(roleSelector);
        headerButtons.appendChild(minimizeBtn);
        overlayHeader.appendChild(headerButtons);

        // Content area (contains the actual editor)
        overlayContent = document.createElement('div');
        overlayContent.id = 'css-editor-overlay-content';
        overlayContent.style.cssText = `
            flex: 1;
            overflow: hidden;
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

        // Attach window resize listener to constrain overlay
        window.addEventListener('resize', constrainOverlayToViewport);

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
     * Save overlay dimensions to localStorage
     */
    function saveOverlayDimensions() {
        try {
            const dimensions = {
                width: overlay.style.width,
                height: overlay.style.height,
                left: overlay.style.left,
                top: overlay.style.top
            };
            localStorage.setItem('cssEditorOverlayDimensions', JSON.stringify(dimensions));
            console.log('[CSS Editor Embed] Saved overlay dimensions:', dimensions);
        } catch (error) {
            console.warn('[CSS Editor Embed] Failed to save overlay dimensions:', error);
        }
    }

    /**
     * Get viewport dimensions accounting for scrollbars
     */
    function getViewportDimensions() {
        return {
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight
        };
    }

    /**
     * Show toast notification
     */
    function showToast(message, duration = 4000) {
        // Remove existing toast if any
        const existing = document.getElementById('css-editor-toast');
        if (existing) {
            existing.remove();
        }

        const toast = document.createElement('div');
        toast.id = 'css-editor-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(102, 126, 234, 0.95);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000000;
            animation: slideUp 0.3s ease-out;
        `;

        // Add keyframe animation
        if (!document.getElementById('css-editor-toast-style')) {
            const style = document.createElement('style');
            style.id = 'css-editor-toast-style';
            style.textContent = `
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Restore overlay dimensions from localStorage
     */
    function restoreOverlayDimensions() {
        try {
            const saved = localStorage.getItem('cssEditorOverlayDimensions');
            if (saved) {
                const dimensions = JSON.parse(saved);
                console.log('[CSS Editor Embed] Restoring overlay dimensions:', dimensions);

                // Parse saved dimensions
                const savedWidth = parseInt(dimensions.width) || 1200;
                const savedHeight = parseInt(dimensions.height) || 800;
                const savedLeft = parseInt(dimensions.left) || 40;
                const savedTop = parseInt(dimensions.top) || 80;

                // Constrain to current viewport size (accounting for scrollbars)
                const viewport = getViewportDimensions();
                const maxWidth = viewport.width;
                const maxHeight = viewport.height;
                const minWidth = 420;
                const minHeight = 300;

                // Ensure width and height fit in viewport
                const constrainedWidth = Math.min(Math.max(savedWidth, minWidth), maxWidth);
                const constrainedHeight = Math.min(Math.max(savedHeight, minHeight), maxHeight);

                // Ensure position keeps overlay on screen
                const constrainedLeft = Math.max(0, Math.min(savedLeft, maxWidth - constrainedWidth));
                const constrainedTop = Math.max(0, Math.min(savedTop, maxHeight - constrainedHeight));

                overlay.style.width = constrainedWidth + 'px';
                overlay.style.height = constrainedHeight + 'px';
                overlay.style.left = constrainedLeft + 'px';
                overlay.style.top = constrainedTop + 'px';

                // Clear right positioning when restoring left
                overlay.style.right = 'auto';

                console.log('[CSS Editor Embed] Constrained overlay to viewport:', {
                    width: constrainedWidth,
                    height: constrainedHeight,
                    left: constrainedLeft,
                    top: constrainedTop
                });

                return true;
            }
        } catch (error) {
            console.warn('[CSS Editor Embed] Failed to restore overlay dimensions:', error);
        }
        return false;
    }

    /**
     * Constrain overlay to current viewport size (called on window resize)
     */
    function constrainOverlayToViewport() {
        if (!overlay || overlay.style.display === 'none') return;

        const viewport = getViewportDimensions();
        const minWidth = 420;
        const minHeight = 300;

        // Check if viewport is too small for minimum usable size
        if (viewport.width < minWidth || viewport.height < minHeight) {
            console.log('[CSS Editor Embed] Viewport too small, auto-minimizing overlay');

            // Close the overlay
            if (isEditorOpen) {
                toggleEditor();
            }

            // Show toast notification
            showToast('CSS Editor minimized - window is too small');
            return;
        }

        const rect = overlay.getBoundingClientRect();

        const currentWidth = rect.width;
        const currentHeight = rect.height;
        const currentLeft = rect.left;
        const currentTop = rect.top;

        let needsResize = false;
        let newWidth = currentWidth;
        let newHeight = currentHeight;
        let newLeft = currentLeft;
        let newTop = currentTop;

        // Check if overlay is too large for viewport
        if (currentWidth > viewport.width || currentHeight > viewport.height) {
            needsResize = true;
            // Set to 90% of viewport
            newWidth = Math.max(viewport.width * 0.9, minWidth);
            newHeight = Math.max(viewport.height * 0.9, minHeight);

            // Center the overlay
            newLeft = (viewport.width - newWidth) / 2;
            newTop = (viewport.height - newHeight) / 2;
        } else {
            // Check if overlay is off-screen
            if (currentLeft + currentWidth > viewport.width ||
                currentTop + currentHeight > viewport.height ||
                currentLeft < 0 || currentTop < 0) {
                needsResize = true;

                // Keep current size but adjust position
                newWidth = Math.min(currentWidth, viewport.width);
                newHeight = Math.min(currentHeight, viewport.height);
                newLeft = Math.max(0, Math.min(currentLeft, viewport.width - newWidth));
                newTop = Math.max(0, Math.min(currentTop, viewport.height - newHeight));
            }
        }

        if (needsResize) {
            overlay.style.width = newWidth + 'px';
            overlay.style.height = newHeight + 'px';
            overlay.style.left = newLeft + 'px';
            overlay.style.top = newTop + 'px';
            overlay.style.right = 'auto';
            overlay.style.bottom = 'auto';

            console.log('[CSS Editor Embed] Constrained overlay on window resize:', {
                viewport,
                oldDimensions: { width: currentWidth, height: currentHeight, left: currentLeft, top: currentTop },
                newDimensions: { width: newWidth, height: newHeight, left: newLeft, top: newTop }
            });

            // Update editor heights
            updateEditorHeights();

            // Save new dimensions
            saveOverlayDimensions();
        }
    }

    /**
     * Handle role selection change for preview
     */
    function handleRoleChange(selectedRole) {
        console.log('[CSS Editor Embed] Role changed to:', selectedRole);

        // Save preference
        try {
            localStorage.setItem('cssEditorPreviewRole', selectedRole);
        } catch (error) {
            console.warn('[CSS Editor Embed] Failed to save preview role preference:', error);
        }

        // Set the preview role on window for the main JS to use
        window.cssEditorPreviewRole = selectedRole;

        // If live preview is enabled, update immediately
        if (window.cssEditorEnableLivePreview && typeof window.updateLivePreview === 'function') {
            window.updateLivePreview();
        }
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
            // Check if viewport is large enough before opening
            const viewport = getViewportDimensions();
            const minWidth = 420;
            const minHeight = 300;

            if (viewport.width < minWidth || viewport.height < minHeight) {
                console.log('[CSS Editor Embed] Viewport too small to open editor');
                isEditorOpen = false; // Revert state
                showToast('CSS Editor requires a larger window to open');
                return;
            }

            overlay.style.display = 'flex';
            toggleButton.style.opacity = '0.7';
            console.log('[CSS Editor Embed] Editor opened');

            // Save open state to localStorage
            try {
                localStorage.setItem('cssEditorOverlayOpen', 'true');
            } catch (error) {
                console.warn('[CSS Editor Embed] Failed to save overlay state:', error);
            }

            // Update editor heights now that overlay is visible
            // Use setTimeout to let the browser render first
            setTimeout(() => {
                updateEditorHeights();
            }, 100);
        } else {
            overlay.style.display = 'none';
            toggleButton.style.opacity = '1';
            console.log('[CSS Editor Embed] Editor closed');

            // Save closed state to localStorage
            try {
                localStorage.setItem('cssEditorOverlayOpen', 'false');
            } catch (error) {
                console.warn('[CSS Editor Embed] Failed to save overlay state:', error);
            }
        }
    }

    /**
     * Dragging functionality
     */
    function startDrag(e) {
        if (e.target !== overlayHeader && !overlayHeader.contains(e.target)) return;
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return; // Don't drag when clicking buttons or selects

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

        // Constrain to viewport (accounting for scrollbars)
        const viewport = getViewportDimensions();
        const maxX = viewport.width - overlay.offsetWidth;
        const maxY = viewport.height - overlay.offsetHeight;

        overlay.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
        overlay.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
        overlay.style.right = 'auto';
    }

    function stopDrag() {
        if (!isDragging) return;
        isDragging = false;
        overlayHeader.style.cursor = 'move';

        // Save position and size to localStorage after drag
        saveOverlayDimensions();
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

        const minWidth = 420;
        const minHeight = 300;

        // Use viewport dimensions (accounting for scrollbars)
        const viewport = getViewportDimensions();
        const maxWidth = viewport.width;
        const maxHeight = viewport.height;

        let newWidth = overlayStartWidth;
        let newHeight = overlayStartHeight;
        let newX = overlayStartX;
        let newY = overlayStartY;

        // Calculate new dimensions based on resize direction
        if (resizeDirection.includes('e')) {
            // East - increase width (constrain to viewport)
            newWidth = Math.max(minWidth, Math.min(overlayStartWidth + deltaX, maxWidth - newX));
        }
        if (resizeDirection.includes('w')) {
            // West - decrease width and move left
            const targetWidth = overlayStartWidth - deltaX;
            if (targetWidth >= minWidth) {
                // Can resize - adjust both width and position
                newWidth = Math.min(targetWidth, maxWidth); // Constrain to viewport width
                newX = Math.max(0, overlayStartX + deltaX); // Constrain position to viewport
            } else {
                // Hit minimum - keep at min width but don't move position
                newWidth = minWidth;
                newX = overlayStartX + (overlayStartWidth - minWidth);
            }
        }
        if (resizeDirection.includes('s')) {
            // South - increase height (constrain to viewport)
            newHeight = Math.max(minHeight, Math.min(overlayStartHeight + deltaY, maxHeight - newY));
        }
        if (resizeDirection.includes('n')) {
            // North - decrease height and move up
            const targetHeight = overlayStartHeight - deltaY;
            if (targetHeight >= minHeight) {
                // Can resize - adjust both height and position
                newHeight = Math.min(targetHeight, maxHeight); // Constrain to viewport height
                newY = Math.max(0, overlayStartY + deltaY); // Constrain position to viewport
            } else {
                // Hit minimum - keep at min height but don't move position
                newHeight = minHeight;
                newY = overlayStartY + (overlayStartHeight - minHeight);
            }
        }

        // Final constraint: ensure overlay doesn't exceed viewport bounds
        newWidth = Math.min(newWidth, maxWidth);
        newHeight = Math.min(newHeight, maxHeight);

        // Constrain position to keep overlay fully visible
        const maxX = maxWidth - newWidth;
        const maxY = maxHeight - newHeight;
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
                        // Floor dimensions to avoid sub-pixel issues
                        const width = Math.floor(rect.width);
                        const height = Math.floor(rect.height);
                        state.editor.layout({ width, height });
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

        // Save position and size to localStorage after resize
        saveOverlayDimensions();
    }

    /**
     * Check if user has admin permissions
     */
    function hasAdminPermission() {
        try {
            if (typeof window.Deki !== 'undefined' &&
                Array.isArray(window.Deki.UserPermissions)) {
                const hasAdmin = window.Deki.UserPermissions.includes('ADMIN');
                console.log('[CSS Editor Embed] Admin permission check:', hasAdmin);
                return hasAdmin;
            }
            console.warn('[CSS Editor Embed] Deki.UserPermissions not available, defaulting to false');
            return false;
        } catch (error) {
            console.error('[CSS Editor Embed] Error checking admin permissions:', error);
            return false;
        }
    }

    /**
     * Initialize everything when DOM is ready
     */
    async function init() {
        // Check admin permission first
        if (!hasAdminPermission()) {
            console.log('[CSS Editor Embed] User does not have admin permission, aborting initialization');
            return;
        }

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

            // Load preview role preference
            try {
                const savedRole = localStorage.getItem('cssEditorPreviewRole') || 'anonymous';
                window.cssEditorPreviewRole = savedRole;
                console.log('[CSS Editor Embed] Preview role set to:', savedRole);
            } catch (error) {
                console.warn('[CSS Editor Embed] Failed to load preview role preference:', error);
                window.cssEditorPreviewRole = 'anonymous';
            }

            // Load CSS first
            await loadCSS(CSS_URL);

            // Create UI elements
            createToggleButton();
            createOverlay();

            // Restore saved dimensions if available
            restoreOverlayDimensions();

            loadEditorContent();

            // Load main editor JS last (it auto-initializes on DOMContentLoaded)
            await loadJS(JS_URL);

            // Wait a bit for the main JS to initialize, then manually trigger if needed
            setTimeout(() => {
                // Since we injected HTML after DOMContentLoaded fired, manually attach event listeners
                if (typeof window.attachEventListeners === 'function') {
                    console.log('[CSS Editor Embed] Manually attaching event listeners');
                    window.attachEventListeners();
                } else {
                    console.warn('[CSS Editor Embed] attachEventListeners not found on window');
                }

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

            // Restore overlay visibility state from localStorage
            try {
                const savedState = localStorage.getItem('cssEditorOverlayOpen');
                if (savedState === 'true') {
                    console.log('[CSS Editor Embed] Restoring overlay open state from localStorage');
                    // Open the overlay after a short delay to ensure everything is initialized
                    setTimeout(() => {
                        toggleEditor();
                    }, 600);
                }
            } catch (error) {
                console.warn('[CSS Editor Embed] Failed to restore overlay state:', error);
            }
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
