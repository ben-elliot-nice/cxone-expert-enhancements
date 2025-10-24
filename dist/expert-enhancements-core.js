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
                        Overlay
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
        }
    };

    // ============================================================================
    // UI Utilities
    // ============================================================================

    const UI = {
        /**
         * Toast management system
         * Supports multiple toasts with max limit, queueing, and dismiss all
         */
        _toastState: {
            activeToasts: [],      // Currently displayed toasts
            toastQueue: [],        // Queued toasts waiting to be shown
            maxToasts: 3,          // Maximum number of toasts to show at once
            toastIdCounter: 0      // Unique ID for each toast
        },

        /**
         * Show toast notification (floating)
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

            // Create toast data
            const toastData = {
                id: ++this._toastState.toastIdCounter,
                text,
                type,
                duration
            };

            // If we're at max capacity, queue it
            if (this._toastState.activeToasts.length >= this._toastState.maxToasts) {
                this._toastState.toastQueue.push(toastData);
                return;
            }

            // Otherwise, show it immediately
            this._renderToast(toastData);
        },

        /**
         * Render a toast to the screen
         */
        _renderToast(toastData) {
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
            closeBtn.onclick = () => this._dismissToast(toastData.id);

            toast.appendChild(textSpan);
            toast.appendChild(closeBtn);

            toast.style.cssText = `
                position: absolute;
                right: 20px;
                background: ${backgroundColor};
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                max-width: 400px;
                pointer-events: auto;
                animation: slideUp 0.3s ease-out;
                transition: bottom 0.3s ease-out, opacity 0.3s;
            `;

            // Add keyframe animation if not exists
            if (!document.getElementById('enhancements-toast-style')) {
                const style = document.createElement('style');
                style.id = 'enhancements-toast-style';
                style.textContent = `
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `;
                document.head.appendChild(style);
            }

            overlay.appendChild(toast);

            // Add to active toasts
            this._toastState.activeToasts.push({
                id: toastData.id,
                element: toast,
                timeoutId: null
            });

            // Reposition all toasts
            this._repositionToasts();

            // Update dismiss all button
            this._updateDismissAllButton();

            // Start timer AFTER rendering (next tick to ensure it's in DOM)
            requestAnimationFrame(() => {
                const toastObj = this._toastState.activeToasts.find(t => t.id === toastData.id);
                if (toastObj) {
                    toastObj.timeoutId = setTimeout(() => {
                        this._dismissToast(toastData.id);
                    }, toastData.duration);
                }
            });
        },

        /**
         * Dismiss a specific toast by ID
         */
        _dismissToast(toastId) {
            const index = this._toastState.activeToasts.findIndex(t => t.id === toastId);
            if (index === -1) return;

            const toastObj = this._toastState.activeToasts[index];

            // Clear timeout
            if (toastObj.timeoutId) {
                clearTimeout(toastObj.timeoutId);
            }

            // Fade out and remove
            toastObj.element.style.transition = 'opacity 0.3s';
            toastObj.element.style.opacity = '0';

            setTimeout(() => {
                if (toastObj.element.parentElement) {
                    toastObj.element.remove();
                }

                // Remove from active list
                this._toastState.activeToasts.splice(index, 1);

                // Reposition remaining toasts
                this._repositionToasts();

                // Update dismiss all button
                this._updateDismissAllButton();

                // Show next queued toast if any
                if (this._toastState.toastQueue.length > 0) {
                    const nextToast = this._toastState.toastQueue.shift();
                    this._renderToast(nextToast);
                }
            }, 300);
        },

        /**
         * Dismiss all active toasts
         */
        _dismissAllToasts() {
            // Get all current toast IDs (make a copy since array will be modified)
            const toastIds = this._toastState.activeToasts.map(t => t.id);

            // Dismiss each toast
            toastIds.forEach(id => this._dismissToast(id));

            // Clear the queue too
            this._toastState.toastQueue = [];
        },

        /**
         * Reposition all toasts in a stack
         */
        _repositionToasts() {
            let bottomOffset = 20;

            // Position toasts from bottom to top
            this._toastState.activeToasts.forEach((toastObj) => {
                toastObj.element.style.bottom = `${bottomOffset}px`;
                const height = toastObj.element.offsetHeight;
                bottomOffset += height + 10; // 10px gap between toasts
            });
        },

        /**
         * Show/hide dismiss all button based on toast count
         */
        _updateDismissAllButton() {
            const overlay = document.getElementById('expert-enhancements-overlay');
            if (!overlay) return;

            let dismissAllBtn = document.getElementById('enhancements-dismiss-all');

            // Show button if 2+ toasts
            if (this._toastState.activeToasts.length >= 2) {
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
                        z-index: 10001;
                        font-size: 12px;
                        cursor: pointer;
                        pointer-events: auto;
                        transition: background 0.2s, bottom 0.3s ease-out;
                    `;
                    dismissAllBtn.onmouseover = () => {
                        dismissAllBtn.style.background = 'rgba(50, 50, 50, 0.9)';
                    };
                    dismissAllBtn.onmouseout = () => {
                        dismissAllBtn.style.background = 'rgba(30, 30, 30, 0.9)';
                    };
                    dismissAllBtn.onclick = () => this._dismissAllToasts();

                    overlay.appendChild(dismissAllBtn);
                }

                // Position above the topmost toast
                if (this._toastState.activeToasts.length > 0) {
                    const topmostToast = this._toastState.activeToasts[this._toastState.activeToasts.length - 1];
                    const topmostBottom = parseInt(topmostToast.element.style.bottom);
                    const topmostHeight = topmostToast.element.offsetHeight;
                    dismissAllBtn.style.bottom = `${topmostBottom + topmostHeight + 10}px`;
                }
            } else {
                // Remove button if less than 2 toasts
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
            const minimizeBtn = DOM.create('button', {
                className: 'header-btn',
                title: 'Minimize'
            });
            minimizeBtn.textContent = '−';
            minimizeBtn.addEventListener('click', () => this.toggle());

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

            // Set app container
            AppManager.setContainer(overlayContent);

            // Attach event listeners
            this.attachDragListeners();
            this.attachResizeListeners(leftHandle, rightHandle, bottomHandle, cornerRightHandle, cornerLeftHandle);
            this.attachWindowResizeListener();

            // Restore dimensions
            this.restoreDimensions();

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

            // Save to localStorage
            Storage.setCommonState({
                isFullscreen: true,
                preFullscreenDimensions: preFullscreenDimensions
            });

            // Notify app of resize (for mobile view switching)
            setTimeout(() => {
                AppManager.notifyResize();
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

            // Save to localStorage
            Storage.setCommonState({
                isFullscreen: false,
                preFullscreenDimensions: null
            });

            // Notify app of resize
            setTimeout(() => {
                AppManager.notifyResize();
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
        version: '1.0.0'
    };

    console.log('[Enhancements Core] Initialized successfully');
})();
