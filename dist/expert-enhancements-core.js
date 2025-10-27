/**
 * CXone Expert Enhancements - Core System
 *
 * Provides common utilities and app management for all enhancement apps.
 * Apps register themselves and receive a context object with shared utilities.
 *
 * @version 1.0.0
 */

(function() {
    'use strict';

    console.log('[Enhancements Core] Initializing...');

    // ============================================================================
    // App Registry & Manager
    // ============================================================================

    const apps = new Map();
    let currentApp = null;
    let appContainer = null;

    const initializedApps = new Set();

    const AppManager = {
        /**
         * Register an app
         */
        register(app) {
            if (!app.id || !app.name || !app.init || !app.mount || !app.unmount) {
                throw new Error('Invalid app interface. Required: id, name, init, mount, unmount');
            }
            apps.set(app.id, app);
            console.log(`[App Manager] Registered app: ${app.name} (${app.id})`);
        },

        /**
         * Get all registered apps
         */
        getApps() {
            return Array.from(apps.values());
        },

        /**
         * Switch to a different app
         */
        async switchTo(appId) {
            const app = apps.get(appId);
            if (!app) {
                console.error(`[App Manager] App not found: ${appId}`);
                return false;
            }

            try {
                // Initialize app if not already initialized
                if (!initializedApps.has(appId)) {
                    console.log(`[App Manager] Initializing: ${app.name}`);
                    const context = {
                        Monaco,
                        API,
                        Storage,
                        UI,
                        DOM,
                        Overlay,
                        LoadingOverlay,
                        FileImport,
                        Formatter
                    };
                    await app.init(context);
                    initializedApps.add(appId);
                }

                // Unmount current app
                if (currentApp) {
                    console.log(`[App Manager] Unmounting: ${currentApp.name}`);
                    Overlay.clearAppControls();
                    await currentApp.unmount();

                    // Save state
                    if (currentApp.getState) {
                        const state = currentApp.getState();
                        Storage.setAppState(currentApp.id, state);
                    }
                }

                // Clear container
                if (appContainer) {
                    appContainer.innerHTML = '';
                }

                // Mount new app
                console.log(`[App Manager] Mounting: ${app.name}`);
                await app.mount(appContainer);
                currentApp = app;

                // Save as last active app
                Storage.setCommonState({ lastActiveApp: appId });

                // Update app switcher to reflect current app
                Overlay.updateAppSwitcher();

                console.log(`[App Manager] Switched to: ${app.name}`);
                return true;

            } catch (error) {
                console.error(`[App Manager] Failed to switch to ${appId}:`, error);
                UI.showToast(`Failed to load ${app.name}: ${error.message}`, 'error');
                return false;
            }
        },

        /**
         * Get current app
         */
        getCurrentApp() {
            return currentApp;
        },

        /**
         * Notify current app of resize
         */
        notifyResize() {
            if (currentApp && typeof currentApp.onResize === 'function') {
                currentApp.onResize();
            }
        },

        /**
         * Set app container
         */
        setContainer(container) {
            appContainer = container;
        }
    };

    // ============================================================================
    // Monaco Editor Utilities
    // ============================================================================

    let monacoReady = false;
    let monacoInitCallbacks = [];

    const Monaco = {
        /**
         * Initialize Monaco Editor (once)
         */
        async init() {
            if (monacoReady) {
                return true;
            }

            return new Promise((resolve, reject) => {
                console.log('[Monaco] Initializing...');

                if (typeof window.monacoRequire === 'undefined') {
                    reject(new Error('Monaco require not found'));
                    return;
                }

                window.monacoRequire.config({
                    paths: {
                        'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs'
                    }
                });

                window.monacoRequire(['vs/editor/editor.main'], function() {
                    console.log('[Monaco] Initialized successfully');
                    monacoReady = true;

                    // Call any waiting callbacks
                    monacoInitCallbacks.forEach(cb => cb());
                    monacoInitCallbacks = [];

                    resolve(true);
                }, function(error) {
                    console.error('[Monaco] Failed to initialize:', error);
                    reject(error);
                });
            });
        },

        /**
         * Check if Monaco is ready
         */
        isReady() {
            return monacoReady;
        },

        /**
         * Execute callback when Monaco is ready
         */
        onReady(callback) {
            if (monacoReady) {
                callback();
            } else {
                monacoInitCallbacks.push(callback);
            }
        },

        /**
         * Get monaco global
         */
        get() {
            return window.monaco;
        }
    };

    // ============================================================================
    // API Utilities
    // ============================================================================

    const API = {
        /**
         * Parse HTML response to extract CSRF token and form data
         */
        parseFormHTML(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const data = { csrf_token: '', fields: {} };

            // Extract CSRF token
            const csrfInput = doc.querySelector('input[name="csrf_token"]');
            if (csrfInput) {
                data.csrf_token = csrfInput.value;
            }

            return { doc, data };
        },

        /**
         * Build multipart form body
         */
        buildMultipartBody(data) {
            const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
            let body = '';

            Object.entries(data).forEach(([name, value]) => {
                body += `--${boundary}\r\n`;
                body += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
                body += `${value}\r\n`;
            });

            // Add submit button - critical for server to process as form submission
            body += `--${boundary}\r\n`;
            body += `Content-Disposition: form-data; name="deki_buttons[submit][submit]"\r\n\r\n`;
            body += `submit\r\n`;
            body += `--${boundary}--\r\n`;

            return { body, boundary };
        },

        /**
         * Fetch with credentials
         */
        async fetch(url, options = {}) {
            return fetch(url, {
                credentials: 'include',
                ...options
            });
        }
    };

    // ============================================================================
    // Storage Utilities
    // ============================================================================

    const STORAGE_PREFIX = 'expertEnhancements';

    const Storage = {
        /**
         * Get common state (shared across all apps)
         */
        getCommonState() {
            try {
                const saved = localStorage.getItem(`${STORAGE_PREFIX}:common`);
                return saved ? JSON.parse(saved) : {};
            } catch (error) {
                console.warn('[Storage] Failed to get common state:', error);
                return {};
            }
        },

        /**
         * Set common state
         */
        setCommonState(state) {
            try {
                const current = this.getCommonState();
                const updated = { ...current, ...state };
                localStorage.setItem(`${STORAGE_PREFIX}:common`, JSON.stringify(updated));
            } catch (error) {
                console.warn('[Storage] Failed to set common state:', error);
            }
        },

        /**
         * Get app-specific state
         */
        getAppState(appId) {
            try {
                const saved = localStorage.getItem(`${STORAGE_PREFIX}:app:${appId}`);
                return saved ? JSON.parse(saved) : null;
            } catch (error) {
                console.warn(`[Storage] Failed to get state for ${appId}:`, error);
                return null;
            }
        },

        /**
         * Set app-specific state
         */
        setAppState(appId, state) {
            try {
                localStorage.setItem(`${STORAGE_PREFIX}:app:${appId}`, JSON.stringify(state));
            } catch (error) {
                console.warn(`[Storage] Failed to set state for ${appId}:`, error);
            }
        },

        /**
         * Clear app-specific state
         */
        clearAppState(appId) {
            try {
                localStorage.removeItem(`${STORAGE_PREFIX}:app:${appId}`);
            } catch (error) {
                console.warn(`[Storage] Failed to clear state for ${appId}:`, error);
            }
        },

        /**
         * Get formatter settings
         */
        getFormatterSettings() {
            try {
                const saved = localStorage.getItem(`${STORAGE_PREFIX}:formatter`);
                const defaults = {
                    formatOnSave: true,
                    indentStyle: 'spaces',
                    indentSize: 2,
                    quoteStyle: 'single',
                    cssSettings: {
                        parser: 'css'
                    },
                    htmlSettings: {
                        parser: 'html'
                    }
                };
                return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
            } catch (error) {
                console.warn('[Storage] Failed to get formatter settings:', error);
                return {
                    formatOnSave: true,
                    indentStyle: 'spaces',
                    indentSize: 2,
                    quoteStyle: 'single',
                    cssSettings: { parser: 'css' },
                    htmlSettings: { parser: 'html' }
                };
            }
        },

        /**
         * Set formatter settings
         */
        setFormatterSettings(settings) {
            try {
                localStorage.setItem(`${STORAGE_PREFIX}:formatter`, JSON.stringify(settings));
            } catch (error) {
                console.warn('[Storage] Failed to set formatter settings:', error);
            }
        }
    };

    // ============================================================================
    // UI Utilities
    // ============================================================================

    const UI = {
        /**
         * Toast notification system with centralized lifecycle management
         */
        _toastState: {
            activeToasts: [],       // Currently displayed toasts: { id, element, timeoutId, state: 'rendering'|'active'|'dismissing' }
            toastQueue: [],         // Queued toasts waiting: { id, text, type, duration }
            maxToasts: 3,           // Maximum number of toasts to show at once
            toastIdCounter: 0,      // Unique ID for each toast
            lifecycleTimeout: null, // Single debounce timer for lifecycle management
            isProcessing: false     // Flag to prevent recursive processing
        },

        /**
         * Show toast notification (floating)
         * Public API - only entry point for creating toasts
         * @param {string} text - The message to display
         * @param {string} type - The type of toast: 'success', 'warning', 'error', or 'info'
         * @param {number} duration - How long to show the toast (ms)
         */
        showToast(text, type = 'info', duration = 4000) {
            // Find the overlay container
            const overlay = document.getElementById('expert-enhancements-overlay');
            if (!overlay) {
                console.warn('[UI] Overlay not found, cannot show toast');
                return;
            }

            // Create toast data and add to queue
            const toastData = {
                id: ++this._toastState.toastIdCounter,
                text,
                type,
                duration
            };

            // Always add to queue - lifecycle manager will process it
            this._toastState.toastQueue.push(toastData);

            // Trigger lifecycle management
            this._processToastLifecycle();
        },

        /**
         * Central toast lifecycle manager
         * This is the ONLY function that coordinates all toast state transitions
         * Enforces all business rules: max toasts, queueing, rendering, dismissal
         */
        _processToastLifecycle() {
            // Debounce to handle concurrent operations (dismissals, new toasts, etc.)
            if (this._toastState.lifecycleTimeout) {
                clearTimeout(this._toastState.lifecycleTimeout);
            }

            this._toastState.lifecycleTimeout = setTimeout(() => {
                // Double RAF ensures DOM is stable before calculations
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Prevent recursive processing
                        if (this._toastState.isProcessing) return;
                        this._toastState.isProcessing = true;

                        try {
                            // Step 1: Clean up dismissed toasts (state = 'dismissing' + animation complete)
                            this._cleanupDismissedToasts();

                            // Step 2: Process queue - move items from queue to active if space available
                            // Rule: max 3 toasts, excluding those currently dismissing
                            this._processToastQueue();

                            // Step 3: Update UI - reposition toasts and update dismiss all button
                            this._updateToastUI();
                        } finally {
                            this._toastState.isProcessing = false;
                        }
                    });
                });
            }, 50); // 50ms debounce window for concurrent operations
        },

        /**
         * Step 1: Clean up dismissed toasts
         * Removes toast elements and data for toasts marked as 'dismissing'
         */
        _cleanupDismissedToasts() {
            const toRemove = this._toastState.activeToasts.filter(t => t.state === 'dismissed');

            toRemove.forEach(toastObj => {
                // Remove from DOM
                if (toastObj.element && toastObj.element.parentElement) {
                    toastObj.element.remove();
                }

                // Remove from active array
                const index = this._toastState.activeToasts.indexOf(toastObj);
                if (index !== -1) {
                    this._toastState.activeToasts.splice(index, 1);
                }
            });
        },

        /**
         * Step 2: Process toast queue
         * Moves toasts from queue to active if space is available
         * Enforces max toast limit (excluding dismissing toasts)
         */
        _processToastQueue() {
            // Count non-dismissing toasts
            const activeCount = this._toastState.activeToasts.filter(
                t => t.state !== 'dismissing'
            ).length;

            // Process queue while we have space
            while (
                this._toastState.toastQueue.length > 0 &&
                activeCount + (this._toastState.activeToasts.filter(t => t.state === 'rendering').length) < this._toastState.maxToasts
            ) {
                const toastData = this._toastState.toastQueue.shift();
                this._renderToastElement(toastData);
            }
        },

        /**
         * Step 3: Update toast UI
         * Repositions all toasts and updates dismiss all button
         */
        _updateToastUI() {
            this._repositionToasts();
            this._updateDismissAllButton();
        },

        /**
         * Render a toast element to the screen
         * Called only by _processToastQueue - not directly
         */
        _renderToastElement(toastData) {
            const overlay = document.getElementById('expert-enhancements-overlay');
            if (!overlay) return;

            // Color scheme based on type
            const colors = {
                success: 'rgba(34, 197, 94, 0.8)',   // Green
                warning: 'rgba(251, 146, 60, 0.8)',  // Orange
                error: 'rgba(239, 68, 68, 0.8)',     // Red
                info: 'rgba(59, 130, 246, 0.8)'      // Blue
            };

            const backgroundColor = colors[toastData.type] || colors.info;

            // Create toast container
            const toast = document.createElement('div');
            toast.className = 'enhancements-toast';
            toast.dataset.toastId = toastData.id;

            // Create text span
            const textSpan = document.createElement('span');
            textSpan.textContent = toastData.text;
            textSpan.style.cssText = `
                flex: 1;
                margin-right: 8px;
            `;

            // Create close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                font-weight: bold;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.8;
                transition: opacity 0.2s;
            `;
            closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
            closeBtn.onmouseout = () => closeBtn.style.opacity = '0.8';
            closeBtn.onclick = () => this._requestDismissToast(toastData.id);

            toast.appendChild(textSpan);
            toast.appendChild(closeBtn);

            // Calculate z-index based on position in stack (bottom toast = lowest z-index)
            const zIndex = 10000 + this._toastState.activeToasts.length;

            toast.style.cssText = `
                position: absolute;
                right: 20px;
                background: ${backgroundColor};
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: ${zIndex};
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                max-width: 400px;
                pointer-events: auto;
                animation: slideDown 0.5s ease-out;
                transition: bottom 0.5s ease-out;
            `;

            // Add keyframe animations if not exists
            if (!document.getElementById('enhancements-toast-style')) {
                const style = document.createElement('style');
                style.id = 'enhancements-toast-style';
                style.textContent = `
                    @keyframes slideDown {
                        from {
                            opacity: 0;
                            transform: translateY(-120%);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    @keyframes slideOutBottom {
                        from {
                            opacity: 1;
                            transform: translateY(0);
                        }
                        to {
                            opacity: 0;
                            transform: translateY(150%);
                        }
                    }
                `;
                document.head.appendChild(style);
            }

            overlay.appendChild(toast);

            // Add to active toasts with 'rendering' state
            const toastObj = {
                id: toastData.id,
                element: toast,
                timeoutId: null,
                state: 'rendering'
            };
            this._toastState.activeToasts.push(toastObj);

            // After animation completes, transition to 'active' state and start auto-dismiss timer
            setTimeout(() => {
                const currentToastObj = this._toastState.activeToasts.find(t => t.id === toastData.id);
                if (currentToastObj && currentToastObj.state === 'rendering') {
                    currentToastObj.state = 'active';

                    // Start auto-dismiss timer
                    currentToastObj.timeoutId = setTimeout(() => {
                        this._requestDismissToast(toastData.id);
                    }, toastData.duration);
                }
            }, 500); // Wait for slideDown animation (0.5s) to complete
        },

        /**
         * Request dismissal of a specific toast
         * This is the public API for dismissing toasts (called by X button, auto-dismiss timer, etc.)
         */
        _requestDismissToast(toastId) {
            const toastObj = this._toastState.activeToasts.find(t => t.id === toastId);
            if (!toastObj) return;

            // Ignore if already dismissing or dismissed
            if (toastObj.state === 'dismissing' || toastObj.state === 'dismissed') return;

            // Clear auto-dismiss timeout if exists
            if (toastObj.timeoutId) {
                clearTimeout(toastObj.timeoutId);
                toastObj.timeoutId = null;
            }

            // Mark as dismissing and start animation
            toastObj.state = 'dismissing';
            toastObj.element.style.animation = 'slideOutBottom 0.5s ease-in forwards';

            // After animation completes, mark as dismissed
            setTimeout(() => {
                const currentToastObj = this._toastState.activeToasts.find(t => t.id === toastId);
                if (currentToastObj && currentToastObj.state === 'dismissing') {
                    currentToastObj.state = 'dismissed';

                    // Trigger lifecycle to clean up and process queue
                    this._processToastLifecycle();
                }
            }, 500); // Match slideOutBottom animation duration
        },

        /**
         * Request dismissal of all active toasts
         * Public API for "Dismiss All" button
         */
        _requestDismissAllToasts() {
            // Get all toast IDs that aren't already dismissing/dismissed
            const toastIds = this._toastState.activeToasts
                .filter(t => t.state !== 'dismissing' && t.state !== 'dismissed')
                .map(t => t.id);

            // Request dismissal for each
            toastIds.forEach(id => this._requestDismissToast(id));

            // Clear the queue
            this._toastState.toastQueue = [];
        },

        /**
         * Reposition all toasts in a stack
         */
        _repositionToasts() {
            let bottomOffset = 20;

            // Position toasts from bottom to top
            this._toastState.activeToasts.forEach((toastObj, index) => {
                toastObj.element.style.bottom = `${bottomOffset}px`;

                // Update z-index to match stack order (bottom = lowest)
                toastObj.element.style.zIndex = 10000 + index;

                const height = toastObj.element.offsetHeight;
                bottomOffset += height + 10; // 10px gap between toasts
            });
        },

        /**
         * Show/hide dismiss all button based on toast count
         * Only counts non-dismissing toasts
         */
        _updateDismissAllButton() {
            const overlay = document.getElementById('expert-enhancements-overlay');
            if (!overlay) return;

            let dismissAllBtn = document.getElementById('enhancements-dismiss-all');

            // Count visible toasts (not dismissing/dismissed)
            const visibleToasts = this._toastState.activeToasts.filter(
                t => t.state !== 'dismissing' && t.state !== 'dismissed'
            );

            // Show button if 2+ visible toasts
            if (visibleToasts.length >= 2) {
                if (!dismissAllBtn) {
                    dismissAllBtn = document.createElement('button');
                    dismissAllBtn.id = 'enhancements-dismiss-all';
                    dismissAllBtn.textContent = 'Dismiss All';
                    dismissAllBtn.style.cssText = `
                        position: absolute;
                        right: 20px;
                        background: rgba(30, 30, 30, 0.9);
                        color: white;
                        padding: 8px 16px;
                        border-radius: 6px;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                        z-index: 10100;
                        font-size: 12px;
                        cursor: pointer;
                        pointer-events: auto;
                        transition: background 0.2s, bottom 0.5s ease-out;
                    `;
                    dismissAllBtn.onmouseover = () => {
                        dismissAllBtn.style.background = 'rgba(50, 50, 50, 0.9)';
                    };
                    dismissAllBtn.onmouseout = () => {
                        dismissAllBtn.style.background = 'rgba(30, 30, 30, 0.9)';
                    };
                    dismissAllBtn.onclick = () => this._requestDismissAllToasts();

                    overlay.appendChild(dismissAllBtn);
                }

                // Position above the topmost visible toast
                if (visibleToasts.length > 0) {
                    const topmostToast = visibleToasts[visibleToasts.length - 1];
                    const topmostBottom = parseInt(topmostToast.element.style.bottom);
                    const topmostHeight = topmostToast.element.offsetHeight;
                    dismissAllBtn.style.bottom = `${topmostBottom + topmostHeight + 10}px`;
                }
            } else {
                // Remove button if less than 2 visible toasts
                if (dismissAllBtn) {
                    dismissAllBtn.remove();
                }
            }
        },

        /**
         * Show custom confirmation dialog
         * @param {string} message - The confirmation message
         * @param {object} options - Options { confirmText, cancelText, type }
         * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
         */
        async confirm(message, options = {}) {
            const {
                confirmText = 'Confirm',
                cancelText = 'Cancel',
                type = 'danger' // 'danger' for red confirm button, 'primary' for blue
            } = options;

            return new Promise((resolve) => {
                // Create modal overlay
                const overlay = document.createElement('div');
                overlay.className = 'enhancements-confirm-overlay';
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 1000000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.2s ease-out;
                `;

                // Create dialog
                const dialog = document.createElement('div');
                dialog.className = 'enhancements-confirm-dialog';
                dialog.style.cssText = `
                    background: #2d2d30;
                    border: 1px solid #444;
                    border-radius: 8px;
                    padding: 24px;
                    min-width: 400px;
                    max-width: 500px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                    animation: slideDown 0.2s ease-out;
                `;

                // Message
                const messageEl = document.createElement('div');
                messageEl.textContent = message;
                messageEl.style.cssText = `
                    color: #e9ecef;
                    font-size: 16px;
                    margin-bottom: 24px;
                    line-height: 1.5;
                `;

                // Buttons container
                const buttons = document.createElement('div');
                buttons.style.cssText = `
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                `;

                // Cancel button
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = cancelText;
                cancelBtn.style.cssText = `
                    background: transparent;
                    border: 1px solid #555;
                    color: #e9ecef;
                    padding: 8px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                `;
                cancelBtn.onmouseover = () => {
                    cancelBtn.style.background = '#3a3a3a';
                };
                cancelBtn.onmouseout = () => {
                    cancelBtn.style.background = 'transparent';
                };

                // Confirm button
                const confirmBtn = document.createElement('button');
                confirmBtn.textContent = confirmText;
                const bgColor = type === 'danger' ? '#dc3545' : '#0d6efd';
                const hoverColor = type === 'danger' ? '#bb2d3b' : '#0b5ed7';
                confirmBtn.style.cssText = `
                    background: ${bgColor};
                    border: 1px solid ${bgColor};
                    color: white;
                    padding: 8px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                `;
                confirmBtn.onmouseover = () => {
                    confirmBtn.style.background = hoverColor;
                    confirmBtn.style.borderColor = hoverColor;
                };
                confirmBtn.onmouseout = () => {
                    confirmBtn.style.background = bgColor;
                    confirmBtn.style.borderColor = bgColor;
                };

                // Add animations if not exists
                if (!document.getElementById('enhancements-confirm-style')) {
                    const style = document.createElement('style');
                    style.id = 'enhancements-confirm-style';
                    style.textContent = `
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes slideDown {
                            from { opacity: 0; transform: translateY(-20px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes fadeOut {
                            from { opacity: 1; }
                            to { opacity: 0; }
                        }
                    `;
                    document.head.appendChild(style);
                }

                // Close function with animation
                const close = (result) => {
                    overlay.style.animation = 'fadeOut 0.15s ease-out';
                    setTimeout(() => {
                        overlay.remove();
                        resolve(result);
                    }, 150);
                };

                // Event listeners
                cancelBtn.addEventListener('click', () => close(false));
                confirmBtn.addEventListener('click', () => close(true));
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) close(false);
                });

                // ESC key to cancel
                const escHandler = (e) => {
                    if (e.key === 'Escape') {
                        document.removeEventListener('keydown', escHandler);
                        close(false);
                    }
                };
                document.addEventListener('keydown', escHandler);

                // Assemble dialog
                buttons.appendChild(cancelBtn);
                buttons.appendChild(confirmBtn);
                dialog.appendChild(messageEl);
                dialog.appendChild(buttons);
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);

                // Focus confirm button
                confirmBtn.focus();
            });
        },

        /**
         * Scan DOM for classes, IDs, data attributes
         */
        scanDOM(excludeSelector = '#expert-enhancements-overlay *') {
            const data = {
                classes: new Map(),
                ids: new Set(),
                dataAttributes: new Set()
            };

            const selector = `*:not(${excludeSelector})`;
            const elements = document.querySelectorAll(selector);

            elements.forEach(el => {
                // Classes
                if (el.classList && el.classList.length > 0) {
                    el.classList.forEach(className => {
                        const count = data.classes.get(className) || 0;
                        data.classes.set(className, count + 1);
                    });
                }

                // IDs
                if (el.id && el.id.length > 0) {
                    data.ids.add(el.id);
                }

                // Data attributes
                if (el.attributes) {
                    Array.from(el.attributes).forEach(attr => {
                        if (attr.name.startsWith('data-')) {
                            data.dataAttributes.add(attr.name);
                        }
                    });
                }
            });

            return data;
        },

        /**
         * Show inline confirmation in a button (Confirm? ✓ ×)
         * @param {HTMLElement} button - The button element to transform
         * @param {Function} onConfirm - Callback to execute on confirmation
         */
        showInlineConfirmation(button, onConfirm) {
            // Mark button as confirming
            button.classList.add('confirming');

            // Store original button content and dimensions
            const originalText = button.textContent;
            const originalColor = button.style.color;
            const originalHeight = button.offsetHeight + 'px';
            const originalMinHeight = button.style.minHeight;

            // Replace button content with confirm UI
            button.innerHTML = '';
            button.style.display = 'flex';
            button.style.alignItems = 'stretch';
            button.style.gap = '0';
            button.style.justifyContent = 'space-between';
            button.style.padding = '0';
            button.style.height = originalHeight;
            button.style.minHeight = originalHeight;

            const confirmText = document.createElement('span');
            confirmText.textContent = 'Confirm?';
            confirmText.style.fontSize = '0.7rem';
            confirmText.style.display = 'flex';
            confirmText.style.alignItems = 'center';
            confirmText.style.paddingLeft = '1rem';
            confirmText.style.paddingRight = '0.5rem';
            confirmText.style.flex = '1';

            const buttonGroup = document.createElement('span');
            buttonGroup.style.display = 'flex';
            buttonGroup.style.alignItems = 'stretch';
            buttonGroup.style.marginLeft = 'auto';

            const tickBtn = document.createElement('span');
            tickBtn.textContent = '✓';
            tickBtn.className = 'confirm-tick';
            tickBtn.style.cursor = 'pointer';
            tickBtn.style.padding = '0 0.75rem';
            tickBtn.style.borderRadius = '0';
            tickBtn.style.background = 'rgba(76, 175, 80, 0.2)';
            tickBtn.style.color = '#4caf50';
            tickBtn.style.fontWeight = 'bold';
            tickBtn.style.display = 'flex';
            tickBtn.style.alignItems = 'center';
            tickBtn.style.justifyContent = 'center';
            tickBtn.style.minWidth = '2.5rem';
            tickBtn.style.transition = 'all 0.15s';

            const crossBtn = document.createElement('span');
            crossBtn.textContent = '×';
            crossBtn.className = 'confirm-cross';
            crossBtn.style.cursor = 'pointer';
            crossBtn.style.padding = '0 0.75rem';
            crossBtn.style.borderRadius = '0';
            crossBtn.style.background = 'rgba(244, 67, 54, 0.2)';
            crossBtn.style.color = '#f44336';
            crossBtn.style.fontWeight = 'bold';
            crossBtn.style.fontSize = '1.2rem';
            crossBtn.style.lineHeight = '1';
            crossBtn.style.display = 'flex';
            crossBtn.style.alignItems = 'center';
            crossBtn.style.justifyContent = 'center';
            crossBtn.style.minWidth = '2.5rem';
            crossBtn.style.transition = 'all 0.15s';

            // Add hover effects
            tickBtn.addEventListener('mouseenter', () => {
                tickBtn.style.background = 'rgba(76, 175, 80, 0.35)';
            });
            tickBtn.addEventListener('mouseleave', () => {
                tickBtn.style.background = 'rgba(76, 175, 80, 0.2)';
            });

            crossBtn.addEventListener('mouseenter', () => {
                crossBtn.style.background = 'rgba(244, 67, 54, 0.35)';
            });
            crossBtn.addEventListener('mouseleave', () => {
                crossBtn.style.background = 'rgba(244, 67, 54, 0.2)';
            });

            buttonGroup.appendChild(tickBtn);
            buttonGroup.appendChild(crossBtn);

            button.appendChild(confirmText);
            button.appendChild(buttonGroup);

            // Reset function
            const resetButton = () => {
                button.classList.remove('confirming');
                button.textContent = originalText;
                button.style.color = originalColor;
                button.style.display = '';
                button.style.alignItems = '';
                button.style.gap = '';
                button.style.justifyContent = '';
                button.style.padding = '';
                button.style.height = '';
                button.style.minHeight = originalMinHeight;
            };

            // Tick click handler
            tickBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                resetButton();
                onConfirm();
            });

            // Cross click handler
            crossBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                resetButton();
            });

            // Click outside handler
            const clickOutsideHandler = (e) => {
                if (!button.contains(e.target)) {
                    resetButton();
                    document.removeEventListener('click', clickOutsideHandler);
                }
            };

            // Add click outside listener after a brief delay to avoid immediate trigger
            setTimeout(() => {
                document.addEventListener('click', clickOutsideHandler);
            }, 100);
        },

        /**
         * Show "No changes" message in a button temporarily
         * @param {HTMLElement} button - The button element to transform
         */
        showNoChangesMessage(button) {
            // Mark button as showing no changes message
            button.classList.add('showing-no-changes');

            // Store original button content and dimensions
            const originalText = button.textContent;
            const originalColor = button.style.color;
            const originalHeight = button.offsetHeight + 'px';
            const originalMinHeight = button.style.minHeight;
            const originalFontSize = button.style.fontSize;
            const originalBackground = button.style.background;

            // Replace button content with "no changes" message
            button.innerHTML = '';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'flex-start';
            button.style.padding = '0.5rem 0.75rem';
            button.style.height = originalHeight;
            button.style.minHeight = originalHeight;
            button.style.color = '#ff9800';
            button.style.cursor = 'default';
            button.textContent = 'No changes';

            // Flash animation
            button.style.background = 'rgba(255, 152, 0, 0.15)';
            button.style.transition = 'background 0.3s ease';
            setTimeout(() => {
                button.style.background = originalBackground;
            }, 300);

            // Reset function
            const resetButton = () => {
                button.classList.remove('showing-no-changes');
                button.textContent = originalText;
                button.style.color = originalColor;
                button.style.display = '';
                button.style.alignItems = '';
                button.style.justifyContent = '';
                button.style.padding = '';
                button.style.height = '';
                button.style.minHeight = originalMinHeight;
                button.style.fontSize = originalFontSize;
                button.style.cursor = '';
                button.style.background = originalBackground;
                button.style.transition = '';
            };

            // Auto-reset after 2 seconds
            setTimeout(() => {
                resetButton();
            }, 2000);

            // Click outside handler
            const clickOutsideHandler = (e) => {
                if (!button.contains(e.target)) {
                    resetButton();
                    document.removeEventListener('click', clickOutsideHandler);
                }
            };

            // Add click outside listener after a brief delay
            setTimeout(() => {
                document.addEventListener('click', clickOutsideHandler);
            }, 100);
        }
    };

    // ============================================================================
    // Loading Overlay Utility
    // ============================================================================

    let loadingOverlay = null;
    let loadingTimeout = null;
    let loadingProgressInterval = null;
    let loadingStartTime = null;

    const LoadingOverlay = {
        /**
         * Show loading overlay with optional message
         */
        show(message = 'Loading...', options = {}) {
            const {
                timeout = 30000, // 30 seconds default timeout
                showProgress = true, // Show progress after 2 seconds
                onTimeout = null
            } = options;

            // Remove existing overlay if any
            this.hide();

            // Create overlay
            loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'enhancements-loading-overlay';
            loadingOverlay.setAttribute('role', 'status');
            loadingOverlay.setAttribute('aria-live', 'polite');
            loadingOverlay.setAttribute('aria-label', message);

            loadingOverlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-message">${message}</div>
                    <div class="loading-progress" style="display: none;">
                        <div class="loading-progress-bar">
                            <div class="loading-progress-fill"></div>
                        </div>
                        <div class="loading-elapsed">0s</div>
                    </div>
                </div>
            `;

            // Find the overlay content or container to append to
            const overlayContent = document.getElementById('expert-enhancements-overlay-content');
            const targetContainer = overlayContent || document.body;
            targetContainer.appendChild(loadingOverlay);

            // Track start time
            loadingStartTime = Date.now();

            // Show progress indicator after 2 seconds if enabled
            if (showProgress) {
                loadingProgressInterval = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - loadingStartTime) / 1000);
                    const progressEl = loadingOverlay.querySelector('.loading-progress');
                    const elapsedEl = loadingOverlay.querySelector('.loading-elapsed');

                    if (elapsed >= 2 && progressEl) {
                        progressEl.style.display = 'block';
                    }

                    if (elapsedEl) {
                        elapsedEl.textContent = `${elapsed}s`;
                    }

                    // Animate progress bar (fake progress)
                    const progressFill = loadingOverlay.querySelector('.loading-progress-fill');
                    if (progressFill && elapsed >= 2) {
                        // Asymptotic progress: approaches 90% but never reaches 100%
                        const progress = Math.min(90, 30 + (elapsed - 2) * 8);
                        progressFill.style.width = `${progress}%`;
                    }
                }, 500);
            }

            // Set timeout if specified
            if (timeout > 0) {
                loadingTimeout = setTimeout(() => {
                    console.error('[LoadingOverlay] Timeout reached');
                    this.showError('Loading is taking longer than expected. Please refresh the page or try again later.');
                    if (onTimeout) onTimeout();
                }, timeout);
            }

            console.log('[LoadingOverlay] Shown:', message);
        },

        /**
         * Update loading message
         */
        setMessage(message) {
            if (!loadingOverlay) return;

            const messageEl = loadingOverlay.querySelector('.loading-message');
            if (messageEl) {
                messageEl.textContent = message;
                loadingOverlay.setAttribute('aria-label', message);
            }

            console.log('[LoadingOverlay] Message updated:', message);
        },

        /**
         * Update progress (0-100)
         */
        setProgress(percent) {
            if (!loadingOverlay) return;

            const progressFill = loadingOverlay.querySelector('.loading-progress-fill');
            const progressEl = loadingOverlay.querySelector('.loading-progress');

            if (progressFill && progressEl) {
                progressEl.style.display = 'block';
                progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
            }
        },

        /**
         * Hide loading overlay
         */
        hide() {
            // Clear timers
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }

            if (loadingProgressInterval) {
                clearInterval(loadingProgressInterval);
                loadingProgressInterval = null;
            }

            // Remove overlay with fade out
            if (loadingOverlay) {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    if (loadingOverlay && loadingOverlay.parentNode) {
                        loadingOverlay.remove();
                    }
                    loadingOverlay = null;
                    loadingStartTime = null;
                }, 300);

                console.log('[LoadingOverlay] Hidden');
            }
        },

        /**
         * Show error message in loading overlay
         */
        showError(message) {
            if (!loadingOverlay) return;

            const content = loadingOverlay.querySelector('.loading-content');
            if (content) {
                content.innerHTML = `
                    <div class="loading-error-icon">⚠</div>
                    <div class="loading-message error">${message}</div>
                    <button class="loading-retry-btn" onclick="window.location.reload()">Reload Page</button>
                `;
                loadingOverlay.classList.add('error');
            }

            // Clear intervals
            if (loadingProgressInterval) {
                clearInterval(loadingProgressInterval);
                loadingProgressInterval = null;
            }

            console.error('[LoadingOverlay] Error shown:', message);
        },

        /**
         * Check if loading overlay is currently shown
         */
        isShown() {
            return loadingOverlay !== null;
        }
    };

    // ============================================================================
    // DOM Utilities
    // ============================================================================

    const DOM = {
        /**
         * Create element with attributes
         */
        create(tag, attributes = {}, children = []) {
            const el = document.createElement(tag);

            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'style' && typeof value === 'object') {
                    Object.assign(el.style, value);
                } else if (key === 'className') {
                    el.className = value;
                } else {
                    el.setAttribute(key, value);
                }
            });

            children.forEach(child => {
                if (typeof child === 'string') {
                    el.appendChild(document.createTextNode(child));
                } else if (child instanceof HTMLElement) {
                    el.appendChild(child);
                }
            });

            return el;
        }
    };

    // ============================================================================
    // Code Formatter Utilities (Prettier)
    // ============================================================================

    let prettierLoaded = false;
    let prettierLoadCallbacks = [];
    let prettierLoadError = null;

    const Formatter = {
        /**
         * Initialize Prettier (load from CDN)
         */
        async init() {
            if (prettierLoaded) {
                return true;
            }

            if (prettierLoadError) {
                throw prettierLoadError;
            }

            return new Promise((resolve, reject) => {
                console.log('[Formatter] Loading Prettier from CDN...');

                // Save original AMD (Monaco's define/require) and hide it temporarily
                // Prettier's UMD will detect AMD and try to use it, conflicting with Monaco
                const originalDefine = window.define;
                const originalRequire = window.require;

                console.log('[Formatter] Temporarily hiding AMD to avoid Monaco conflict');
                window.define = undefined;
                window.require = undefined;

                // Helper to wait for a global variable with exponential backoff
                // Max timeout: 60 seconds
                const waitForGlobal = (checkFn, name, maxTimeout = 60000) => {
                    return new Promise((resolve, reject) => {
                        const startTime = Date.now();
                        let currentInterval = 50; // Start with 50ms
                        const maxInterval = 2000; // Cap at 2 seconds
                        let attempts = 0;

                        const check = () => {
                            attempts++;
                            const elapsed = Date.now() - startTime;

                            if (checkFn()) {
                                console.log(`[Formatter] ${name} is ready (${attempts} attempts, ${elapsed}ms elapsed)`);
                                resolve();
                            } else if (elapsed >= maxTimeout) {
                                reject(new Error(`${name} not found after ${elapsed}ms (${attempts} attempts)`));
                            } else {
                                // Exponential backoff with cap
                                setTimeout(check, currentInterval);
                                currentInterval = Math.min(currentInterval * 2, maxInterval);
                            }
                        };
                        check();
                    });
                };

                // Load Prettier standalone first
                const prettierScript = document.createElement('script');
                prettierScript.src = 'https://unpkg.com/prettier@3.6.2/standalone.js';

                prettierScript.onload = async () => {
                    console.log('[Formatter] Prettier standalone script loaded');

                    // Restore AMD immediately after standalone loads
                    if (originalDefine) window.define = originalDefine;
                    if (originalRequire) window.require = originalRequire;
                    console.log('[Formatter] AMD restored after standalone load');

                    try {
                        // Load all plugin scripts
                        console.log('[Formatter] Loading plugin scripts...');

                        // Hide AMD before loading CSS plugin
                        window.define = undefined;
                        window.require = undefined;

                        // Load CSS parser (postcss)
                        const cssParserScript = document.createElement('script');
                        cssParserScript.src = 'https://unpkg.com/prettier@3.6.2/plugins/postcss.js';

                        const cssLoaded = new Promise((resolveCSS, rejectCSS) => {
                            cssParserScript.onload = () => {
                                console.log('[Formatter] PostCSS plugin script loaded');
                                // Restore AMD immediately after CSS plugin loads
                                if (originalDefine) window.define = originalDefine;
                                if (originalRequire) window.require = originalRequire;
                                resolveCSS();
                            };
                            cssParserScript.onerror = () => {
                                // Restore AMD even on error
                                if (originalDefine) window.define = originalDefine;
                                if (originalRequire) window.require = originalRequire;
                                rejectCSS(new Error('Failed to load PostCSS plugin'));
                            };
                        });
                        document.head.appendChild(cssParserScript);

                        // Wait for CSS plugin to finish
                        await cssLoaded;

                        // Hide AMD before loading HTML plugin
                        window.define = undefined;
                        window.require = undefined;

                        // Load HTML parser
                        const htmlParserScript = document.createElement('script');
                        htmlParserScript.src = 'https://unpkg.com/prettier@3.6.2/plugins/html.js';

                        const htmlLoaded = new Promise((resolveHTML, rejectHTML) => {
                            htmlParserScript.onload = () => {
                                console.log('[Formatter] HTML plugin script loaded');
                                // Restore AMD immediately after HTML plugin loads
                                if (originalDefine) window.define = originalDefine;
                                if (originalRequire) window.require = originalRequire;
                                resolveHTML();
                            };
                            htmlParserScript.onerror = () => {
                                // Restore AMD even on error
                                if (originalDefine) window.define = originalDefine;
                                if (originalRequire) window.require = originalRequire;
                                rejectHTML(new Error('Failed to load HTML plugin'));
                            };
                        });
                        document.head.appendChild(htmlParserScript);

                        // Wait for HTML plugin to finish
                        await htmlLoaded;

                        console.log('[Formatter] All plugin scripts loaded, waiting for globals...');

                        // Now wait for all globals to be available (AMD already restored)
                        await waitForGlobal(() => window.prettier, 'window.prettier');
                        await waitForGlobal(
                            () => window.prettierPlugins && window.prettierPlugins.postcss,
                            'prettierPlugins.postcss'
                        );
                        await waitForGlobal(
                            () => window.prettierPlugins && window.prettierPlugins.html,
                            'prettierPlugins.html'
                        );

                        console.log('[Formatter] All Prettier components loaded successfully');
                        console.log('[Formatter] Prettier version:', window.prettier.version);
                        console.log('[Formatter] Available plugins:', Object.keys(window.prettierPlugins || {}));

                        prettierLoaded = true;

                        // Call any waiting callbacks
                        prettierLoadCallbacks.forEach(cb => cb());
                        prettierLoadCallbacks = [];

                        resolve(true);

                    } catch (error) {
                        console.error('[Formatter] Error during initialization:', error);

                        // Restore AMD even on error
                        if (originalDefine) window.define = originalDefine;
                        if (originalRequire) window.require = originalRequire;

                        prettierLoadError = error;
                        reject(error);
                    }
                };

                prettierScript.onerror = () => {
                    const error = new Error('Failed to load Prettier standalone script');
                    console.error('[Formatter]', error);

                    // Restore AMD even on error
                    if (originalDefine) window.define = originalDefine;
                    if (originalRequire) window.require = originalRequire;

                    prettierLoadError = error;
                    reject(error);
                };

                document.head.appendChild(prettierScript);
            });
        },

        /**
         * Check if Prettier is loaded
         */
        isReady() {
            return prettierLoaded;
        },

        /**
         * Execute callback when Prettier is ready
         */
        onReady(callback) {
            if (prettierLoaded) {
                callback();
            } else {
                prettierLoadCallbacks.push(callback);
            }
        },

        /**
         * Format CSS code
         * @param {string} code - CSS code to format
         * @returns {Promise<string>} - Formatted CSS code
         */
        async formatCSS(code) {
            if (!prettierLoaded) {
                throw new Error('Prettier not loaded. Call Formatter.init() first.');
            }

            if (!window.prettier) {
                throw new Error('Prettier global not found');
            }

            if (!window.prettierPlugins) {
                throw new Error('Prettier plugins not found');
            }

            try {
                const settings = Storage.getFormatterSettings();

                const options = {
                    parser: 'css',
                    plugins: prettierPlugins,
                    useTabs: settings.indentStyle === 'tabs',
                    tabWidth: settings.indentSize,
                    singleQuote: settings.quoteStyle === 'single',
                    ...settings.cssSettings
                };

                const formatted = await prettier.format(code, options);
                console.log('[Formatter] CSS formatted successfully');

                // Strip trailing newline (Prettier always adds one, but server strips it)
                return formatted.endsWith('\n') ? formatted.slice(0, -1) : formatted;
            } catch (error) {
                console.error('[Formatter] CSS formatting failed:', error);
                throw new Error(`CSS formatting failed: ${error.message}`);
            }
        },

        /**
         * Format HTML code
         * @param {string} code - HTML code to format
         * @returns {Promise<string>} - Formatted HTML code
         */
        async formatHTML(code) {
            if (!prettierLoaded) {
                throw new Error('Prettier not loaded. Call Formatter.init() first.');
            }

            if (!window.prettier) {
                throw new Error('Prettier global not found');
            }

            if (!window.prettierPlugins) {
                throw new Error('Prettier plugins not found');
            }

            try {
                const settings = Storage.getFormatterSettings();

                const options = {
                    parser: 'html',
                    plugins: prettierPlugins,
                    useTabs: settings.indentStyle === 'tabs',
                    tabWidth: settings.indentSize,
                    singleQuote: settings.quoteStyle === 'single',
                    ...settings.htmlSettings
                };

                const formatted = await prettier.format(code, options);
                console.log('[Formatter] HTML formatted successfully');

                // Strip trailing newline (Prettier always adds one, but server strips it)
                return formatted.endsWith('\n') ? formatted.slice(0, -1) : formatted;
            } catch (error) {
                console.error('[Formatter] HTML formatting failed:', error);
                throw new Error(`HTML formatting failed: ${error.message}`);
            }
        },

        /**
         * Get current formatter settings
         */
        getSettings() {
            return Storage.getFormatterSettings();
        },

        /**
         * Update formatter settings
         */
        setSettings(settings) {
            Storage.setFormatterSettings(settings);
            console.log('[Formatter] Settings updated:', settings);
        }
    };

    // ============================================================================
    // Overlay Management
    // ============================================================================

    let overlay = null;
    let overlayHeader = null;
    let overlayContent = null;
    let isDragging = false;
    let isResizing = false;
    let dragStartX = 0, dragStartY = 0;
    let overlayStartX = 0, overlayStartY = 0;
    let resizeStartWidth = 0, resizeStartHeight = 0;
    let resizeStartX = 0, resizeStartY = 0;
    let currentResizeHandle = null;
    let isFullscreen = false;
    let preFullscreenDimensions = null;
    let fullscreenBtn = null;

    const Overlay = {
        /**
         * Create overlay structure
         */
        create() {
            // Main overlay
            overlay = DOM.create('div', { id: 'expert-enhancements-overlay' });

            // Header
            overlayHeader = DOM.create('div', { id: 'expert-enhancements-overlay-header' });

            const headerLeft = DOM.create('div', { className: 'header-left' });
            const headerTitle = DOM.create('span', { className: 'header-title' }, ['CXone Expert Enhancements']);

            // App switcher dropdown
            const appSwitcher = DOM.create('select', { className: 'app-switcher', id: 'app-switcher' });
            appSwitcher.addEventListener('change', (e) => {
                AppManager.switchTo(e.target.value);
            });

            headerLeft.appendChild(headerTitle);
            headerLeft.appendChild(appSwitcher);

            // App-specific controls container (for CSS Editor live preview, etc.)
            const appControls = DOM.create('div', {
                className: 'app-controls-container',
                id: 'app-controls-container'
            });
            headerLeft.appendChild(appControls);

            const headerButtons = DOM.create('div', { className: 'header-buttons' });

            // Preset size buttons
            const presetContainer = DOM.create('div', { className: 'preset-buttons' });

            const smallBtn = DOM.create('button', {
                className: 'header-btn preset-btn',
                title: 'Small (50%)'
            });
            smallBtn.textContent = '▢';
            smallBtn.addEventListener('click', () => this.applyPresetSize('small'));

            fullscreenBtn = DOM.create('button', {
                className: 'header-btn preset-btn',
                title: 'Fullscreen (95%)'
            });
            fullscreenBtn.textContent = '⛶';
            fullscreenBtn.addEventListener('click', () => this.applyPresetSize('fullscreen'));

            // Combined split button (left half = split left, right half = split right)
            const splitBtn = DOM.create('button', {
                className: 'header-btn preset-btn split-btn'
            });

            const splitLeftHalf = DOM.create('span', {
                className: 'split-half split-left',
                title: 'Split Left (30%)'
            });
            const leftIndicator = DOM.create('span', { className: 'split-indicator' });
            splitLeftHalf.appendChild(leftIndicator);
            splitLeftHalf.addEventListener('click', (e) => {
                e.stopPropagation();
                this.applyPresetSize('split-left');
            });

            const splitRightHalf = DOM.create('span', {
                className: 'split-half split-right',
                title: 'Split Right (30%)'
            });
            const rightIndicator = DOM.create('span', { className: 'split-indicator' });
            splitRightHalf.appendChild(rightIndicator);
            splitRightHalf.addEventListener('click', (e) => {
                e.stopPropagation();
                this.applyPresetSize('split-right');
            });

            splitBtn.appendChild(splitLeftHalf);
            splitBtn.appendChild(splitRightHalf);

            presetContainer.appendChild(smallBtn);
            presetContainer.appendChild(fullscreenBtn);
            presetContainer.appendChild(splitBtn);

            const minimizeBtn = DOM.create('button', {
                className: 'header-btn',
                title: 'Minimize'
            });
            minimizeBtn.textContent = '−';
            minimizeBtn.addEventListener('click', () => this.toggle());

            headerButtons.appendChild(presetContainer);
            headerButtons.appendChild(minimizeBtn);
            overlayHeader.appendChild(headerLeft);
            overlayHeader.appendChild(headerButtons);

            // Content area
            overlayContent = DOM.create('div', { id: 'expert-enhancements-overlay-content' });

            // Resize handles
            const leftHandle = DOM.create('div', { className: 'enhancements-resize-handle left' });
            const rightHandle = DOM.create('div', { className: 'enhancements-resize-handle right' });
            const bottomHandle = DOM.create('div', { className: 'enhancements-resize-handle bottom' });
            const cornerRightHandle = DOM.create('div', { className: 'enhancements-resize-handle corner-right' });
            const cornerLeftHandle = DOM.create('div', { className: 'enhancements-resize-handle corner-left' });

            overlay.appendChild(overlayHeader);
            overlay.appendChild(overlayContent);
            overlay.appendChild(leftHandle);
            overlay.appendChild(rightHandle);
            overlay.appendChild(bottomHandle);
            overlay.appendChild(cornerRightHandle);
            overlay.appendChild(cornerLeftHandle);

            document.body.appendChild(overlay);

            // Prevent scroll events from reaching the underlying page
            overlay.addEventListener('wheel', (e) => {
                e.stopPropagation();
            }, { passive: true });

            // Set app container
            AppManager.setContainer(overlayContent);

            // Attach event listeners
            this.attachDragListeners();
            this.attachResizeListeners(leftHandle, rightHandle, bottomHandle, cornerRightHandle, cornerLeftHandle);
            this.attachWindowResizeListener();
            this.setupDropZone();

            // Restore dimensions
            this.restoreDimensions();

            // Initial check for preset buttons visibility (after render)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.checkPresetButtonsVisibility();
                });
            });

            console.log('[Overlay] Created');
        },

        /**
         * Attach drag listeners
         */
        attachDragListeners() {
            overlayHeader.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;

                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;

                const rect = overlay.getBoundingClientRect();
                overlayStartX = rect.left;
                overlayStartY = rect.top;

                overlayHeader.style.cursor = 'grabbing';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const deltaX = e.clientX - dragStartX;
                const deltaY = e.clientY - dragStartY;

                overlay.style.left = (overlayStartX + deltaX) + 'px';
                overlay.style.top = (overlayStartY + deltaY) + 'px';
                overlay.style.transform = 'none';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    overlayHeader.style.cursor = 'move';
                    this.saveDimensions();
                }
            });

            // Double-click to toggle fullscreen
            overlayHeader.addEventListener('dblclick', (e) => {
                // Skip if clicking on interactive elements
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;

                this.toggleFullscreen();
            });
        },

        /**
         * Attach resize listeners
         */
        attachResizeListeners(leftHandle, rightHandle, bottomHandle, cornerRightHandle, cornerLeftHandle) {
            let resizeStartLeft = 0;
            let resizeStartTop = 0;

            // Helper to get current app's constraints
            const getConstraints = () => {
                const app = AppManager.getCurrentApp();
                const defaults = { minWidth: 420, minHeight: 300 };
                return app?.constraints ? { ...defaults, ...app.constraints } : defaults;
            };

            const startResize = (e, handle) => {
                // If in fullscreen mode, exit it before starting resize
                if (isFullscreen) {
                    console.log('[Overlay] Exiting fullscreen mode due to manual resize');
                    isFullscreen = false;
                    preFullscreenDimensions = null;
                    Storage.setCommonState({
                        isFullscreen: false,
                        preFullscreenDimensions: null
                    });
                }

                isResizing = true;
                currentResizeHandle = handle;
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;

                const rect = overlay.getBoundingClientRect();
                resizeStartWidth = rect.width;
                resizeStartHeight = rect.height;
                resizeStartLeft = rect.left;
                resizeStartTop = rect.top;

                // Add visual feedback class
                e.target.classList.add('resizing');

                e.preventDefault();
            };

            leftHandle.addEventListener('mousedown', (e) => startResize(e, 'left'));
            rightHandle.addEventListener('mousedown', (e) => startResize(e, 'right'));
            bottomHandle.addEventListener('mousedown', (e) => startResize(e, 'bottom'));
            cornerRightHandle.addEventListener('mousedown', (e) => startResize(e, 'corner-right'));
            cornerLeftHandle.addEventListener('mousedown', (e) => startResize(e, 'corner-left'));

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;

                const deltaX = e.clientX - resizeStartX;
                const deltaY = e.clientY - resizeStartY;

                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const constraints = getConstraints();

                // Right side resize
                if (currentResizeHandle === 'right' || currentResizeHandle === 'corner-right') {
                    const maxWidth = viewportWidth - resizeStartLeft;
                    const newWidth = Math.max(constraints.minWidth, Math.min(resizeStartWidth + deltaX, maxWidth));
                    overlay.style.width = newWidth + 'px';
                }

                // Left side resize (adjust both position and width)
                if (currentResizeHandle === 'left' || currentResizeHandle === 'corner-left') {
                    // Calculate desired new dimensions
                    let newWidth = resizeStartWidth - deltaX;
                    let newLeft = resizeStartLeft + deltaX;

                    // Right edge position (should stay constant)
                    const rightEdge = resizeStartLeft + resizeStartWidth;

                    // Clamp left edge to viewport
                    newLeft = Math.max(0, Math.min(newLeft, rightEdge - constraints.minWidth));

                    // Recalculate width based on clamped left position
                    newWidth = rightEdge - newLeft;

                    // Ensure minimum width
                    if (newWidth < constraints.minWidth) {
                        newWidth = constraints.minWidth;
                        newLeft = rightEdge - constraints.minWidth;
                    }

                    overlay.style.width = newWidth + 'px';
                    overlay.style.left = newLeft + 'px';
                    overlay.style.transform = 'none';
                }

                // Bottom resize
                if (currentResizeHandle === 'bottom' || currentResizeHandle === 'corner-right' || currentResizeHandle === 'corner-left') {
                    const maxHeight = viewportHeight - resizeStartTop;
                    const newHeight = Math.max(constraints.minHeight, Math.min(resizeStartHeight + deltaY, maxHeight));
                    overlay.style.height = newHeight + 'px';
                }

                // Notify app of resize during drag (for immediate mobile view switching)
                AppManager.notifyResize();

                // Check preset buttons visibility in real-time during resize
                this.checkPresetButtonsVisibility();
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    // Remove visual feedback from all handles
                    document.querySelectorAll('.enhancements-resize-handle').forEach(handle => {
                        handle.classList.remove('resizing');
                    });

                    isResizing = false;
                    currentResizeHandle = null;
                    this.saveDimensions();
                    // Notify app of resize
                    AppManager.notifyResize();
                    // Check preset buttons visibility
                    this.checkPresetButtonsVisibility();
                }
            });
        },

        /**
         * Attach window resize listener for fullscreen mode
         */
        attachWindowResizeListener() {
            window.addEventListener('resize', () => {
                if (isFullscreen) {
                    // Re-calculate 95vw x 95vh when window is resized
                    this.applyFullscreen();
                }
            });
        },

        /**
         * Setup drag and drop file import zone
         */
        setupDropZone() {
            if (!overlayContent) return;

            // Create drop zone overlay (initially hidden)
            const dropZone = DOM.create('div', {
                id: 'file-drop-zone',
                style: 'display: none; pointer-events: none;'
            });

            const dropZoneContent = DOM.create('div', {
                className: 'drop-zone-content'
            });

            const dropIcon = DOM.create('div', {
                className: 'drop-icon'
            }, ['📁']);

            const dropText = DOM.create('div', {
                className: 'drop-text'
            }, ['Drop your file here']);

            const dropSubtext = DOM.create('div', {
                className: 'drop-subtext'
            }, ['Supports .css and .html files']);

            dropZoneContent.appendChild(dropIcon);
            dropZoneContent.appendChild(dropText);
            dropZoneContent.appendChild(dropSubtext);
            dropZone.appendChild(dropZoneContent);
            overlayContent.appendChild(dropZone);

            let dragCounter = 0; // Track enter/leave to prevent flickering

            // Prevent default drag behavior
            overlayContent.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragCounter++;
                if (dragCounter === 1) {
                    dropZone.style.display = 'flex';
                    dropZone.style.pointerEvents = 'auto';
                }
            });

            overlayContent.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });

            overlayContent.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragCounter--;
                if (dragCounter === 0) {
                    dropZone.style.display = 'none';
                    dropZone.style.pointerEvents = 'none';
                }
            });

            overlayContent.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragCounter = 0;
                dropZone.style.display = 'none';
                dropZone.style.pointerEvents = 'none';

                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                    FileImport.handleDrop(files);
                }
            });

            // ESC key to cancel drag operation
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && dropZone.style.display === 'flex') {
                    dragCounter = 0;
                    dropZone.style.display = 'none';
                    dropZone.style.pointerEvents = 'none';
                }
            });

            console.log('[Overlay] Drop zone initialized');
        },

        /**
         * Toggle overlay visibility
         */
        toggle() {
            if (!overlay) return;

            const isVisible = overlay.style.display === 'flex';
            overlay.style.display = isVisible ? 'none' : 'flex';

            // Save state
            Storage.setCommonState({ overlayOpen: !isVisible });

            // If showing, notify app to re-layout (editors created while hidden have 0 height)
            if (!isVisible) {
                setTimeout(() => {
                    AppManager.notifyResize();
                    // Check preset buttons visibility when showing overlay
                    this.checkPresetButtonsVisibility();
                }, 50);
            }
        },

        /**
         * Save overlay dimensions
         */
        saveDimensions() {
            if (!overlay) return;

            const dimensions = {
                width: overlay.style.width,
                height: overlay.style.height,
                left: overlay.style.left,
                top: overlay.style.top
            };

            Storage.setCommonState({ overlayDimensions: dimensions });
        },

        /**
         * Restore overlay dimensions
         */
        restoreDimensions() {
            if (!overlay) return;

            const state = Storage.getCommonState();

            // Check if overlay was in fullscreen mode
            if (state.isFullscreen) {
                isFullscreen = true;
                preFullscreenDimensions = state.preFullscreenDimensions || null;
                this.applyFullscreen();
                this.updateFullscreenButtonState();
                // Check preset buttons visibility after a short delay to ensure DOM is ready
                setTimeout(() => this.checkPresetButtonsVisibility(), 100);
                return;
            }

            // Otherwise restore normal dimensions
            const dims = state.overlayDimensions;
            if (dims) {
                if (dims.width) overlay.style.width = dims.width;
                if (dims.height) overlay.style.height = dims.height;
                if (dims.left) {
                    overlay.style.left = dims.left;
                    overlay.style.transform = 'none';
                }
                if (dims.top) {
                    overlay.style.top = dims.top;
                    overlay.style.transform = 'none';
                }
            }

            // Check preset buttons visibility after a short delay to ensure DOM is ready
            setTimeout(() => this.checkPresetButtonsVisibility(), 100);
        },

        /**
         * Toggle fullscreen mode
         */
        toggleFullscreen() {
            if (!overlay) return;

            if (isFullscreen) {
                // Exit fullscreen - restore previous dimensions
                this.exitFullscreen();
            } else {
                // Enter fullscreen - save current dimensions and expand
                this.enterFullscreen();
            }
        },

        /**
         * Enter fullscreen mode
         */
        enterFullscreen() {
            if (!overlay) return;

            console.log('[Overlay] Entering fullscreen mode');

            // Save current dimensions
            preFullscreenDimensions = {
                width: overlay.style.width,
                height: overlay.style.height,
                left: overlay.style.left,
                top: overlay.style.top,
                transform: overlay.style.transform
            };

            // Apply fullscreen dimensions
            this.applyFullscreen();

            // Update state
            isFullscreen = true;

            // Update button visual state
            this.updateFullscreenButtonState();

            // Save to localStorage
            Storage.setCommonState({
                isFullscreen: true,
                preFullscreenDimensions: preFullscreenDimensions
            });

            // Notify app of resize (for mobile view switching)
            setTimeout(() => {
                AppManager.notifyResize();
                // Check preset buttons visibility
                this.checkPresetButtonsVisibility();
            }, 50);
        },

        /**
         * Exit fullscreen mode
         */
        exitFullscreen() {
            if (!overlay || !preFullscreenDimensions) return;

            console.log('[Overlay] Exiting fullscreen mode');

            // Restore previous dimensions
            overlay.style.width = preFullscreenDimensions.width;
            overlay.style.height = preFullscreenDimensions.height;
            overlay.style.left = preFullscreenDimensions.left;
            overlay.style.top = preFullscreenDimensions.top;
            overlay.style.transform = preFullscreenDimensions.transform;

            // Update state
            isFullscreen = false;
            preFullscreenDimensions = null;

            // Update button visual state
            this.updateFullscreenButtonState();

            // Save to localStorage
            Storage.setCommonState({
                isFullscreen: false,
                preFullscreenDimensions: null
            });

            // Notify app of resize
            setTimeout(() => {
                AppManager.notifyResize();
                // Check preset buttons visibility
                this.checkPresetButtonsVisibility();
            }, 50);
        },

        /**
         * Apply fullscreen dimensions
         */
        applyFullscreen() {
            if (!overlay) return;

            overlay.style.width = '95vw';
            overlay.style.height = '95vh';
            overlay.style.left = '2.5vw';
            overlay.style.top = '2.5vh';
            overlay.style.transform = 'none';
        },

        /**
         * Update fullscreen button visual state
         */
        updateFullscreenButtonState() {
            if (!fullscreenBtn) return;

            if (isFullscreen) {
                fullscreenBtn.classList.add('fullscreen-active');
            } else {
                fullscreenBtn.classList.remove('fullscreen-active');
            }
        },

        /**
         * Apply preset size
         * @param {string} preset - Preset type: 'small', 'fullscreen', 'split-left', 'split-right'
         */
        applyPresetSize(preset) {
            if (!overlay) return;

            console.log(`[Overlay] Applying preset size: ${preset}`);

            // Exit fullscreen mode if active (except for fullscreen preset)
            if (isFullscreen && preset !== 'fullscreen') {
                isFullscreen = false;
                preFullscreenDimensions = null;
                this.updateFullscreenButtonState();
                Storage.setCommonState({
                    isFullscreen: false,
                    preFullscreenDimensions: null
                });
            }

            // Get constraints
            const app = AppManager.getCurrentApp();
            const defaults = { minWidth: 420, minHeight: 300 };
            const constraints = app?.constraints ? { ...defaults, ...app.constraints } : defaults;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Apply preset dimensions
            switch (preset) {
                case 'small':
                    // 50vw × 50vh centered, respecting constraints
                    const smallWidth = Math.max(viewportWidth * 0.5, constraints.minWidth);
                    const smallHeight = Math.max(viewportHeight * 0.5, constraints.minHeight);
                    overlay.style.width = smallWidth + 'px';
                    overlay.style.height = smallHeight + 'px';
                    overlay.style.left = ((viewportWidth - smallWidth) / 2) + 'px';
                    overlay.style.top = ((viewportHeight - smallHeight) / 2) + 'px';
                    overlay.style.transform = 'none';
                    break;

                case 'fullscreen':
                    // Use existing fullscreen logic
                    if (isFullscreen) {
                        this.exitFullscreen();
                        return;
                    } else {
                        this.enterFullscreen();
                        return;
                    }

                case 'split-left':
                    // 30vw × 95vh positioned at left edge, respecting constraints
                    const splitLeftWidth = Math.max(viewportWidth * 0.3, constraints.minWidth);
                    const splitLeftHeight = Math.max(viewportHeight * 0.95, constraints.minHeight);
                    overlay.style.width = splitLeftWidth + 'px';
                    overlay.style.height = splitLeftHeight + 'px';
                    overlay.style.left = (viewportWidth * 0.025) + 'px';
                    overlay.style.top = ((viewportHeight - splitLeftHeight) / 2) + 'px';
                    overlay.style.transform = 'none';
                    break;

                case 'split-right':
                    // 30vw × 95vh positioned at right edge, respecting constraints
                    const splitRightWidth = Math.max(viewportWidth * 0.3, constraints.minWidth);
                    const splitRightHeight = Math.max(viewportHeight * 0.95, constraints.minHeight);
                    overlay.style.width = splitRightWidth + 'px';
                    overlay.style.height = splitRightHeight + 'px';
                    overlay.style.left = (viewportWidth - splitRightWidth - viewportWidth * 0.025) + 'px';
                    overlay.style.top = ((viewportHeight - splitRightHeight) / 2) + 'px';
                    overlay.style.transform = 'none';
                    break;

                default:
                    console.warn(`[Overlay] Unknown preset: ${preset}`);
                    return;
            }

            // Save dimensions to localStorage
            this.saveDimensions();

            // Notify app of resize
            setTimeout(() => {
                AppManager.notifyResize();
            }, 50);

            // Check if preset buttons should be hidden
            this.checkPresetButtonsVisibility();
        },

        /**
         * Check overlay width and hide/show preset buttons accordingly
         */
        checkPresetButtonsVisibility() {
            if (!overlay) {
                console.log('[Overlay] checkPresetButtonsVisibility: overlay not found');
                return;
            }

            const presetButtons = document.querySelector('.preset-buttons');
            if (!presetButtons) {
                console.log('[Overlay] checkPresetButtonsVisibility: preset buttons not found');
                return;
            }

            const width = overlay.offsetWidth;
            const currentDisplay = presetButtons.style.display;
            console.log(`[Overlay] checkPresetButtonsVisibility: width=${width}px, currentDisplay="${currentDisplay}"`);

            if (width < 620) {
                // Hide preset buttons
                if (presetButtons.style.display !== 'none') {
                    presetButtons.style.display = 'none';
                    console.log('[Overlay] Preset buttons hidden (width < 620px)');
                }
            } else {
                // Show preset buttons
                if (presetButtons.style.display !== 'flex') {
                    presetButtons.style.display = 'flex';
                    console.log('[Overlay] Preset buttons shown (width >= 620px)');
                }
            }
        },

        /**
         * Update app switcher options
         */
        updateAppSwitcher() {
            const switcher = document.getElementById('app-switcher');
            if (!switcher) return;

            switcher.innerHTML = '';
            AppManager.getApps().forEach(app => {
                const option = DOM.create('option', { value: app.id }, [app.name]);
                switcher.appendChild(option);
            });

            const currentApp = AppManager.getCurrentApp();
            if (currentApp) {
                switcher.value = currentApp.id;
            }
        },

        /**
         * Set app-specific header controls (mounted/unmounted with app)
         */
        setAppControls(elements) {
            const container = document.getElementById('app-controls-container');
            if (!container) return;

            // Clear existing
            container.innerHTML = '';

            // Add new controls
            if (Array.isArray(elements)) {
                elements.forEach(el => container.appendChild(el));
            }

            console.log('[Overlay] App controls set:', elements.length, 'elements');
        },

        /**
         * Clear app-specific controls
         */
        clearAppControls() {
            const container = document.getElementById('app-controls-container');
            if (container) {
                container.innerHTML = '';
                console.log('[Overlay] App controls cleared');
            }
        }
    };

    // ============================================================================
    // File Import Module
    // ============================================================================

    const FileImport = {
        /**
         * Handle dropped files
         */
        async handleDrop(files) {
            // Validate: only one file at a time
            if (files.length > 1) {
                UI.showToast('Please drop only one file at a time', 'error');
                return;
            }

            const file = files[0];

            // Validate file type
            const fileExt = file.name.toLowerCase().split('.').pop();
            if (fileExt !== 'css' && fileExt !== 'html') {
                UI.showToast('Please drop a .css or .html file', 'error');
                return;
            }

            // Validate file size (max 5MB)
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            if (file.size > maxSize) {
                UI.showToast(`File too large. Maximum size is 5MB (file is ${(file.size / 1024 / 1024).toFixed(2)}MB)`, 'error');
                return;
            }

            // Check for empty files
            if (file.size === 0) {
                UI.showToast('Cannot import empty file', 'error');
                return;
            }

            // Determine target app
            const targetAppId = fileExt === 'css' ? 'css-editor' : 'html-editor';
            const currentApp = AppManager.getCurrentApp();

            // Switch to target app if needed
            if (!currentApp || currentApp.id !== targetAppId) {
                UI.showToast(`Switching to ${fileExt.toUpperCase()} Editor...`, 'info', 2000);
                try {
                    await AppManager.switchTo(targetAppId);
                    // Give the app time to fully mount and layout editors
                    await new Promise(resolve => setTimeout(resolve, 100));
                    // Notify app to re-layout editors
                    AppManager.notifyResize();
                } catch (error) {
                    UI.showToast(`Failed to switch to ${fileExt.toUpperCase()} Editor: ${error.message}`, 'error');
                    return;
                }
            }

            // Read file content
            LoadingOverlay.show(`Reading ${file.name}...`);

            try {
                const content = await this.readFileAsText(file);

                // Get target app and call its importFile method
                const app = AppManager.getCurrentApp();
                if (app && typeof app.importFile === 'function') {
                    await app.importFile(content, file.name);
                } else {
                    LoadingOverlay.hide();
                    UI.showToast('Current app does not support file import', 'error');
                }
            } catch (error) {
                LoadingOverlay.hide();
                UI.showToast(`Failed to read file: ${error.message}`, 'error');
            }
        },

        /**
         * Read file as text (returns Promise)
         */
        readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsText(file);
            });
        },

        /**
         * Show role/field selector dialog
         */
        showRoleSelector(roles, fileType) {
            return new Promise((resolve) => {
                // Create modal backdrop
                const backdrop = DOM.create('div', {
                    className: 'role-selector-backdrop',
                    style: 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999999; display: flex; align-items: center; justify-content: center;'
                });

                // Create dialog
                const dialog = DOM.create('div', {
                    className: 'role-selector-dialog',
                    style: 'background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 400px; width: 90%;'
                });

                const title = DOM.create('h3', {
                    style: 'margin: 0 0 16px 0; font-size: 18px; color: #333;'
                }, [`Import ${fileType.toUpperCase()} File`]);

                const description = DOM.create('p', {
                    style: 'margin: 0 0 16px 0; font-size: 14px; color: #666;'
                }, ['Select which editor to import into:']);

                const form = DOM.create('form');

                // Create radio buttons for each role
                roles.forEach((role, index) => {
                    const label = DOM.create('label', {
                        style: 'display: flex; align-items: center; margin-bottom: 12px; cursor: pointer; font-size: 14px; color: #333;'
                    });

                    const radio = DOM.create('input', {
                        type: 'radio',
                        name: 'role',
                        value: role.id,
                        style: 'margin-right: 8px;'
                    });

                    if (index === 0) {
                        radio.checked = true;
                    }

                    const labelText = document.createTextNode(role.label);

                    label.appendChild(radio);
                    label.appendChild(labelText);
                    form.appendChild(label);
                });

                const buttonContainer = DOM.create('div', {
                    style: 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;'
                });

                const cancelBtn = DOM.create('button', {
                    type: 'button',
                    style: 'padding: 8px 16px; border: 1px solid #ccc; background: white; color: #333; border-radius: 4px; cursor: pointer; font-size: 14px;'
                }, ['Cancel']);

                const importBtn = DOM.create('button', {
                    type: 'submit',
                    style: 'padding: 8px 16px; border: none; background: #2196F3; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;'
                }, ['Import']);

                cancelBtn.addEventListener('click', () => {
                    document.body.removeChild(backdrop);
                    resolve(null);
                });

                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const selectedRole = form.querySelector('input[name="role"]:checked').value;
                    document.body.removeChild(backdrop);
                    resolve(selectedRole);
                });

                buttonContainer.appendChild(cancelBtn);
                buttonContainer.appendChild(importBtn);
                form.appendChild(buttonContainer);

                dialog.appendChild(title);
                dialog.appendChild(description);
                dialog.appendChild(form);
                backdrop.appendChild(dialog);
                document.body.appendChild(backdrop);

                // Focus first radio button
                form.querySelector('input[type="radio"]').focus();
            });
        }
    };

    // ============================================================================
    // Export Global Context
    // ============================================================================

    window.ExpertEnhancements = {
        AppManager,
        Monaco,
        API,
        Storage,
        UI,
        DOM,
        Overlay,
        LoadingOverlay,
        FileImport,
        Formatter,
        version: '1.0.0'
    };

    console.log('[Enhancements Core] Initialized successfully');
})();
