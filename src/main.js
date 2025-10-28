/**
 * CXone Expert Enhancements - Main Entry Point
 *
 * This is the Vite entry point that loads all enhancement modules.
 * In development: Served by Vite dev server with HMR
 * In production: Bundled into dist/expert-enhancements-embed.js
 *
 * NOTE: This is a work-in-progress conversion to ES modules.
 * The source files (core.js, css-editor.js, etc.) are currently IIFEs and need to be converted.
 */

// Import CSS files (Vite will handle these)
import './core.css';
import './css-editor.css';

console.log('[Expert Enhancements] Main entry point loading...');
console.warn('[Expert Enhancements] ES module conversion in progress - current files are still IIFEs');

// TODO: Convert source files to ES modules
// For now, we need to manually convert the IIFE files to export their modules

// Temporary message for development
if (import.meta.env.DEV) {
    console.log('%c[Expert Enhancements] Development Mode', 'color: #4CAF50; font-weight: bold');
    console.log('Vite dev server is running. Files need ES module conversion to work properly.');
    console.log('Next step: Convert core.js, css-editor.js, html-editor.js, settings.js to ES modules');
}

// Display info in the page
setTimeout(() => {
    document.body.insertAdjacentHTML('beforeend', `
        <div style="position: fixed; top: 10px; right: 10px; background: #ff9800; color: white; padding: 10px 15px; border-radius: 4px; font-family: monospace; font-size: 12px; max-width: 300px; z-index: 10000;">
            <strong>⚠️ Build System Setup in Progress</strong><br>
            <small>ES module conversion needed. Check console for details.</small>
        </div>
    `);
}, 1000);
