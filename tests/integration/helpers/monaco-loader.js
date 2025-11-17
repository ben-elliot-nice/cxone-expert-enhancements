import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let monacoLoaded = false;

/**
 * Load Monaco editor for integration tests
 *
 * NOTE: This is currently a mock implementation. Loading real Monaco in a
 * Vitest/Node.js environment is challenging because:
 * - Monaco uses AMD loader (require.js) which conflicts with ES modules
 * - Monaco expects full browser APIs that happy-dom may not provide
 * - Dynamic import of Monaco bundles requires special configuration
 *
 * This mock provides the Monaco API surface that our code expects.
 * If tests fail due to Monaco behavior differences, we may need to:
 * 1. Switch to jsdom (heavier but more complete DOM)
 * 2. Use Playwright Component Testing instead of Vitest
 * 3. Load Monaco via dynamic import with special Vite config
 */
export async function loadMonaco() {
  if (monacoLoaded) {
    return global.monaco;
  }

  const monacoPath = path.join(__dirname, 'monaco', 'min', 'vs', 'loader.js');

  // In a real environment, you'd load Monaco via require or import
  // For testing, we might need to use jsdom or similar
  // This is a placeholder for the actual implementation

  // For now, return a mock Monaco
  global.monaco = {
    editor: {
      create: () => ({
        getValue: () => '',
        setValue: () => {},
        dispose: () => {},
        onDidChangeModelContent: () => ({ dispose: () => {} })
      }),
      getModels: () => [],
      createModel: () => ({
        getValue: () => '',
        setValue: () => {},
        dispose: () => {}
      })
    },
    languages: {
      register: () => {},
      setMonarchTokensProvider: () => {},
      setLanguageConfiguration: () => {}
    }
  };

  monacoLoaded = true;
  return global.monaco;
}
