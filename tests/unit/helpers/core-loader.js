import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load core.js and execute it to populate window.CXoneExpertCore
 */
export function loadCore() {
  const corePath = path.resolve(__dirname, '../../../src/core.js');
  const coreCode = fs.readFileSync(corePath, 'utf-8');

  // Execute the IIFE in the current context
  // This will populate window.CXoneExpertCore
  const fn = new Function('window', coreCode);
  fn(globalThis);

  return globalThis.CXoneExpertCore;
}
