import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load core.js ES Module and execute it to populate window.ExpertEnhancements
 *
 * Note: core.js is an ES Module with imports, not an IIFE.
 * It imports ConfigManager from './config.js' and exports named exports.
 * The file also assigns to window.ExpertEnhancements for backwards compatibility.
 */
export async function loadCore() {
  // Dynamically import the core module
  const corePath = path.resolve(__dirname, '../../../src/core.js');

  // Import the module - this will execute it and populate window.ExpertEnhancements
  await import(corePath);

  // Return the window.ExpertEnhancements object that was assigned during module execution
  return globalThis.ExpertEnhancements;
}
