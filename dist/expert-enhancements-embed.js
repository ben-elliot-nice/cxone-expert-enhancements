/**
 * CXone Expert Enhancements - Unified Embed Loader
 *
 * Single embed script that loads all enhancements (CSS Editor, HTML Editor, etc.)
 *
 * Usage:
 * <script src="https://releases.benelliot-nice.com/cxone-expert-enhancements/latest/expert-enhancements-embed.js"></script>
 *
 * Documentation: https://github.com/ben-elliot-nice/cxone-expert-enhancements#readme
 * Issues: https://github.com/ben-elliot-nice/cxone-expert-enhancements/issues
 *
 * @version 1.2.0
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
        let loadingShown = false;

        try {
            console.log('[Expert Enhancements Embed] Initializing...');

            // Check for state clear parameter
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('ceeState') === 'clear') {
                console.log('[Expert Enhancements Embed] Clearing all editor state from localStorage...');

                // Clear unified app system state
                localStorage.removeItem('expertEnhancements:common');
                localStorage.removeItem('expertEnhancements:app:css-editor');
                localStorage.removeItem('expertEnhancements:app:html-editor');

                // Clear old standalone CSS editor state
                localStorage.removeItem('cssEditorActiveRoles');
                localStorage.removeItem('cssEditorContent');
                localStorage.removeItem('cssEditorOverlayDimensions');
                localStorage.removeItem('cssEditorOverlayOpen');
                localStorage.removeItem('cssEditorPreviewRole');
                localStorage.removeItem('cssEditorLivePreviewEnabled');

                // Clear old standalone HTML editor state
                localStorage.removeItem('htmlEditorActiveRoles');
                localStorage.removeItem('htmlEditorContent');
                localStorage.removeItem('htmlEditorOverlayDimensions');
                localStorage.removeItem('htmlEditorOverlayOpen');

                console.log('[Expert Enhancements Embed] All editor state cleared');
            }

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

            // Show loading overlay when switching to app if overlay is open
            if (commonState.overlayOpen) {
                // Overlay will be opened, show loading indicator
                window.ExpertEnhancements.LoadingOverlay.show('Initializing editor...', {
                    timeout: 30000,
                    showProgress: true
                });
                loadingShown = true;
            }

            await window.ExpertEnhancements.AppManager.switchTo(lastActiveApp);

            // 9. Restore overlay state
            if (commonState.overlayOpen) {
                console.log('[Expert Enhancements Embed] Restoring overlay open state');
                setTimeout(() => {
                    window.ExpertEnhancements.Overlay.toggle();
                    // Hide loading overlay after app is mounted
                    if (loadingShown) {
                        setTimeout(() => {
                            window.ExpertEnhancements.LoadingOverlay.hide();
                        }, 500);
                    }
                }, 300);
            }

            console.log('[Expert Enhancements Embed] Initialization complete!');

        } catch (error) {
            console.error('[Expert Enhancements Embed] Initialization failed:', error);

            // Show error in loading overlay if it's shown
            if (loadingShown && window.ExpertEnhancements && window.ExpertEnhancements.LoadingOverlay) {
                window.ExpertEnhancements.LoadingOverlay.showError(
                    'Failed to initialize: ' + error.message
                );
            }
        }
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
