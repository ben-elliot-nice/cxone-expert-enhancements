/**
 * CXone Expert Enhancements - Main Entry Point
 *
 * This is the Vite entry point that loads all enhancement modules.
 * In development: Served by Vite dev server with HMR
 * In production: Bundled into dist/expert-enhancements-embed.js
 */

console.log('[Expert Enhancements] Main entry point loading...');

// ============================================================================
// Import CSS (Vite will bundle these, we also load them dynamically)
// ============================================================================

import './core.css';
import './css-editor.css';
import './hierarchy-creator.css';

// ============================================================================
// Import Core & Initialize (must be first - provides foundation)
// ============================================================================

import {
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
    version
} from './core.js';

console.log(`[Expert Enhancements] Core loaded (v${version})`);

// ============================================================================
// Import Apps (these auto-register with AppManager on load)
// Note: Static imports are bundled by Vite. Error handling is in each app's
// registration code and in AppManager.register() for graceful degradation.
// IMPORTANT: Import apps in dependency order - base apps first!
// ============================================================================

import './settings.js';         // Base app (no dependencies) - must load first
import './css-editor.js';       // Depends on: settings
import './html-editor.js';      // Depends on: settings
import './hierarchy-creator.js'; // Depends on: settings

// ============================================================================
// Initialization Complete - Now Initialize UI
// ============================================================================

console.log('[Expert Enhancements] All modules loaded successfully');

if (import.meta.env.DEV) {
    console.log('%c[Expert Enhancements] Development Mode', 'color: #4CAF50; font-weight: bold');
    console.log('✅ Vite dev server running');
    console.log('✅ HMR enabled - changes will reload automatically');
    console.log('✅ Source maps enabled - debug original source in DevTools');
}

// ============================================================================
// UI Initialization
// ============================================================================

// Load Monaco's loader script (must happen before Monaco.init())
function loadMonacoLoader() {
    return new Promise((resolve, reject) => {
        // Save original AMD if exists
        const originalDefine = window.define;
        const originalRequire = window.require;

        console.log('[Expert Enhancements] Temporarily hiding AMD for Monaco loader');
        delete window.define;
        delete window.require;

        // Load Monaco loader script
        const loaderScript = document.createElement('script');
        loaderScript.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js';

        loaderScript.onload = () => {
            console.log('[Expert Enhancements] Monaco loader loaded, restoring page AMD');

            // Restore the page's AMD
            if (originalDefine) window.define = originalDefine;
            if (originalRequire) window.require = originalRequire;

            // Store Monaco's require separately
            window.monacoRequire = require;

            console.log('[Expert Enhancements] Page AMD restored, Monaco require stored');
            resolve();
        };

        loaderScript.onerror = () => {
            console.error('[Expert Enhancements] Failed to load Monaco loader');

            // Restore AMD even on error
            if (originalDefine) window.define = originalDefine;
            if (originalRequire) window.require = originalRequire;

            reject(new Error('Failed to load Monaco loader'));
        };

        document.head.appendChild(loaderScript);
    });
}

// Load CSS file
function loadCSS() {
    return new Promise((resolve) => {
        // Auto-detect CDN base from this script's URL
        const scripts = document.getElementsByTagName('script');
        const thisScript = Array.from(scripts).find(s => s.src && s.src.includes('embed'));

        let cssUrl;
        if (thisScript && thisScript.src) {
            const scriptPath = thisScript.src;
            const basePath = scriptPath.substring(0, scriptPath.lastIndexOf('/'));
            cssUrl = `${basePath}/core.css`;
        } else {
            // Fallback to relative path
            cssUrl = 'core.css';
        }

        console.log('[Expert Enhancements] Loading CSS:', cssUrl);

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssUrl;
        link.onload = () => {
            console.log('[Expert Enhancements] CSS loaded');
            resolve();
        };
        link.onerror = () => {
            console.warn('[Expert Enhancements] CSS failed to load, continuing anyway');
            resolve();
        };
        document.head.appendChild(link);
    });
}

async function initializeUI() {
    try {
        console.log('[Expert Enhancements] Initializing UI...');

        // 1. Check registered apps (static imports have already run)
        const registeredApps = AppManager.getApps();
        console.log(`[Expert Enhancements] ${registeredApps.length} app(s) registered:`,
            registeredApps.map(app => app.name).join(', ') || 'none');

        // Report any failed registrations
        const failedRegistrations = AppManager.getFailedApps();
        if (failedRegistrations.length > 0) {
            console.warn('[Expert Enhancements] Failed app registrations:', failedRegistrations);
        }

        // Check if any apps were registered
        if (registeredApps.length === 0) {
            console.error('[Expert Enhancements] No apps registered! Widget cannot function.');
            // Still create UI to show error message
        }

        // 2. Load CSS
        await loadCSS();

        // 3. Load Monaco loader (before Monaco.init())
        await loadMonacoLoader();

        // 4. Initialize Monaco
        console.log('[Expert Enhancements] Pre-loading Monaco...');
        await Monaco.init();
        console.log('[Expert Enhancements] Monaco ready');

        // 5. Create toggle button
        createToggleButton();

        // 6. Create overlay
        Overlay.create();

        // 7. Update app switcher
        Overlay.updateAppSwitcher();

        // 8. Restore and load last active app with fallback
        const commonState = Storage.getCommonState();
        const lastActiveApp = commonState.lastActiveApp || 'css-editor';

        console.log('[Expert Enhancements] Loading last active app:', lastActiveApp);

        // Show loading overlay when switching to app if overlay is open
        let loadingShown = false;
        if (commonState.overlayOpen) {
            LoadingOverlay.show('Initializing editor...', {
                timeout: 30000,
                showProgress: true
            });
            loadingShown = true;
        }

        // Try to load last active app, with fallback to first available
        let appLoaded = false;
        if (registeredApps.length > 0) {
            appLoaded = await AppManager.switchTo(lastActiveApp);

            if (!appLoaded) {
                console.warn(`[Expert Enhancements] Failed to load last active app "${lastActiveApp}", trying first available app...`);
                const firstApp = AppManager.getFirstAvailableApp();

                if (firstApp) {
                    console.log('[Expert Enhancements] Loading first available app:', firstApp);
                    appLoaded = await AppManager.switchTo(firstApp);
                }
            }
        }

        // If still no app loaded, show error
        if (!appLoaded) {
            console.error('[Expert Enhancements] Failed to load any app!');
            if (loadingShown) {
                LoadingOverlay.showError('No apps available. Please refresh the page or contact support.');
            } else {
                UI.showToast('Failed to load any apps. Widget may not function correctly.', 'error', 10000);
            }
        }

        // 9. Restore overlay state
        if (commonState.overlayOpen) {
            console.log('[Expert Enhancements] Restoring overlay open state');
            setTimeout(() => {
                Overlay.toggle();
                // Hide loading overlay after app is mounted (only if app loaded successfully)
                // If no app loaded, keep error message visible
                if (loadingShown && appLoaded) {
                    setTimeout(() => {
                        LoadingOverlay.hide();
                    }, 500);
                }
            }, 300);
        }

        console.log('[Expert Enhancements] Initialization complete!');

    } catch (error) {
        console.error('[Expert Enhancements] Initialization failed:', error);
        // Try to show error to user
        try {
            if (LoadingOverlay.isShown()) {
                LoadingOverlay.showError(`Initialization failed: ${error.message}`);
            }
        } catch (e) {
            console.error('[Expert Enhancements] Failed to show error overlay:', e);
        }
    }
}

// Create toggle button
function createToggleButton() {
    const toggleButton = document.createElement('button');
    toggleButton.id = 'expert-enhancements-toggle';
    toggleButton.innerHTML = '&lt;/&gt;';
    toggleButton.title = 'CXone Expert Enhancements';
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

    toggleButton.addEventListener('click', () => {
        Overlay.toggle();
    });

    document.body.appendChild(toggleButton);
    console.log('[Expert Enhancements] Toggle button created');
}

// Wait for DOM to be ready, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUI);
} else {
    initializeUI();
}
