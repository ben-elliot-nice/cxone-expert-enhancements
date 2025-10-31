/**
 * CXone Expert Enhancements - Main Entry Point
 *
 * This is the Vite entry point that loads all enhancement modules.
 * In development: Served by Vite dev server with HMR
 * In production: Bundled into dist/expert-enhancements-embed.js
 */

console.log('[Expert Enhancements] Main entry point loading...');

// ============================================================================
// Import CSS (Vite will bundle these)
// ============================================================================

import './core.css';
import './css-editor.css';

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
// ============================================================================

import './css-editor.js';
import './html-editor.js';
import './settings.js';

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

async function initializeUI() {
    try {
        console.log('[Expert Enhancements] Initializing UI...');

        // 1. Load Monaco loader first (before Monaco.init())
        await loadMonacoLoader();

        // 2. Initialize Monaco
        console.log('[Expert Enhancements] Pre-loading Monaco...');
        await Monaco.init();
        console.log('[Expert Enhancements] Monaco ready');

        // 3. Create toggle button
        createToggleButton();

        // 4. Create overlay
        Overlay.create();

        // 5. Update app switcher
        Overlay.updateAppSwitcher();

        // 6. Restore and load last active app
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

        await AppManager.switchTo(lastActiveApp);

        // 7. Restore overlay state
        if (commonState.overlayOpen) {
            console.log('[Expert Enhancements] Restoring overlay open state');
            setTimeout(() => {
                Overlay.toggle();
                // Hide loading overlay after app is mounted
                if (loadingShown) {
                    setTimeout(() => {
                        LoadingOverlay.hide();
                    }, 500);
                }
            }, 300);
        }

        console.log('[Expert Enhancements] Initialization complete!');

    } catch (error) {
        console.error('[Expert Enhancements] Initialization failed:', error);
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
