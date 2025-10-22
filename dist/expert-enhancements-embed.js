/**
 * CXone Expert Enhancements - Unified Embed Loader
 *
 * Single embed script that loads all enhancements (CSS Editor, HTML Editor, etc.)
 *
 * Usage:
 * <script src="https://[cdn]/expert-enhancements/[version]/expert-enhancements-embed.js"></script>
 *
 * @version 1.0.0
 */

(function() {
    'use strict';

    console.log('[Expert Enhancements Embed] Loading...');

    // ============================================================================
    // Configuration
    // ============================================================================

    // Auto-detect CDN base from this script's URL
    const scripts = document.getElementsByTagName('script');
    const thisScript = scripts[scripts.length - 1];
    let CDN_BASE = '';

    if (thisScript && thisScript.src) {
        const scriptPath = thisScript.src;
        CDN_BASE = scriptPath.substring(0, scriptPath.lastIndexOf('/'));
        console.log('[Expert Enhancements Embed] Auto-detected CDN base:', CDN_BASE);
    } else {
        console.warn('[Expert Enhancements Embed] Could not auto-detect CDN, using relative paths');
        CDN_BASE = '/dist';
    }

    // Resource URLs
    const RESOURCES = {
        coreCss: `${CDN_BASE}/expert-enhancements-core.css`,
        coreJs: `${CDN_BASE}/expert-enhancements-core.js`,
        cssEditorCss: `${CDN_BASE}/expert-enhancements-css.css`,
        cssEditorJs: `${CDN_BASE}/expert-enhancements-css.js`,
        htmlEditorJs: `${CDN_BASE}/expert-enhancements-html.js`
    };

    // ============================================================================
    // Resource Loading Helpers
    // ============================================================================

    /**
     * Load CSS file
     */
    function loadCSS(url) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = () => {
                console.log(`[Expert Enhancements Embed] Loaded CSS: ${url}`);
                resolve();
            };
            link.onerror = () => {
                console.error(`[Expert Enhancements Embed] Failed to load CSS: ${url}`);
                reject(new Error(`Failed to load CSS: ${url}`));
            };
            document.head.appendChild(link);
        });
    }

    /**
     * Load JavaScript file
     */
    function loadJS(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                console.log(`[Expert Enhancements Embed] Loaded JS: ${url}`);
                resolve();
            };
            script.onerror = () => {
                console.error(`[Expert Enhancements Embed] Failed to load JS: ${url}`);
                reject(new Error(`Failed to load JS: ${url}`));
            };
            document.head.appendChild(script);
        });
    }

    // ============================================================================
    // Toggle Button
    // ============================================================================

    let toggleButton = null;

    function createToggleButton() {
        toggleButton = document.createElement('button');
        toggleButton.id = 'expert-enhancements-toggle';
        toggleButton.innerHTML = '⚡';
        toggleButton.title = 'CXone Expert Enhancements';

        toggleButton.addEventListener('click', () => {
            if (window.ExpertEnhancements && window.ExpertEnhancements.Overlay) {
                window.ExpertEnhancements.Overlay.toggle();
            }
        });

        document.body.appendChild(toggleButton);
        console.log('[Expert Enhancements Embed] Toggle button created');
    }

    // ============================================================================
    // Monaco Loader Script
    // ============================================================================

    function loadMonacoLoader() {
        return new Promise((resolve, reject) => {
            // Save original AMD if exists
            const originalDefine = window.define;
            const originalRequire = window.require;

            console.log('[Expert Enhancements Embed] Temporarily hiding AMD for Monaco loader');
            delete window.define;
            delete window.require;

            // Load Monaco loader script
            const loaderScript = document.createElement('script');
            loaderScript.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js';

            loaderScript.onload = () => {
                console.log('[Expert Enhancements Embed] Monaco loader loaded, restoring page AMD');

                // Restore the page's AMD
                if (originalDefine) window.define = originalDefine;
                if (originalRequire) window.require = originalRequire;

                // Store Monaco's require separately
                window.monacoRequire = require;

                console.log('[Expert Enhancements Embed] Page AMD restored, Monaco require stored');
                resolve();
            };

            loaderScript.onerror = () => {
                console.error('[Expert Enhancements Embed] Failed to load Monaco loader');

                // Restore AMD even on error
                if (originalDefine) window.define = originalDefine;
                if (originalRequire) window.require = originalRequire;

                reject(new Error('Failed to load Monaco loader'));
            };

            document.head.appendChild(loaderScript);
        });
    }

    // ============================================================================
    // Initialization
    // ============================================================================

    async function init() {
        try {
            console.log('[Expert Enhancements Embed] Initializing...');

            // 1. Load Monaco loader first
            await loadMonacoLoader();

            // 2. Load core CSS and JS
            await loadCSS(RESOURCES.coreCss);
            await loadJS(RESOURCES.coreJs);

            // Wait for core to be ready
            await new Promise((resolve) => {
                const check = setInterval(() => {
                    if (window.ExpertEnhancements) {
                        clearInterval(check);
                        resolve();
                    }
                }, 50);
            });

            console.log('[Expert Enhancements Embed] Core loaded');

            // 3. Initialize Monaco early (before apps load)
            console.log('[Expert Enhancements Embed] Pre-loading Monaco...');
            await window.ExpertEnhancements.Monaco.init();
            console.log('[Expert Enhancements Embed] Monaco ready');

            // 4. Load app resources
            await loadCSS(RESOURCES.cssEditorCss);
            await loadJS(RESOURCES.cssEditorJs);
            await loadJS(RESOURCES.htmlEditorJs);

            // 5. Wait for apps to register
            await new Promise((resolve) => setTimeout(resolve, 200));

            console.log('[Expert Enhancements Embed] Apps loaded');

            // 6. Create UI
            createToggleButton();
            window.ExpertEnhancements.Overlay.create();

            // 7. Update app switcher
            window.ExpertEnhancements.Overlay.updateAppSwitcher();

            // 8. Restore and load last active app
            const commonState = window.ExpertEnhancements.Storage.getCommonState();
            const lastActiveApp = commonState.lastActiveApp || 'css-editor';

            console.log('[Expert Enhancements Embed] Loading last active app:', lastActiveApp);
            await window.ExpertEnhancements.AppManager.switchTo(lastActiveApp);

            // 9. Restore overlay state
            if (commonState.overlayOpen) {
                console.log('[Expert Enhancements Embed] Restoring overlay open state');
                setTimeout(() => {
                    window.ExpertEnhancements.Overlay.toggle();
                }, 300);
            }

            console.log('[Expert Enhancements Embed] Initialization complete!');

        } catch (error) {
            console.error('[Expert Enhancements Embed] Initialization failed:', error);
        }
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
