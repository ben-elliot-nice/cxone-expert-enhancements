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
// Initialization Complete
// ============================================================================

console.log('[Expert Enhancements] All modules loaded successfully');

if (import.meta.env.DEV) {
    console.log('%c[Expert Enhancements] Development Mode', 'color: #4CAF50; font-weight: bold');
    console.log('✅ Vite dev server running');
    console.log('✅ HMR enabled - changes will reload automatically');
    console.log('✅ Source maps enabled - debug original source in DevTools');
}
