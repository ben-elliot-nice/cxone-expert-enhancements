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

  // Create a stateful mock Monaco
  const models = [];

  global.monaco = {
    editor: {
      create: (container, options = {}) => {
        let value = options.value || '';
        const changeListeners = [];

        const editor = {
          getValue: () => value,
          setValue: (newValue) => {
            value = newValue;
            // Trigger change listeners
            changeListeners.forEach(listener => listener());
          },
          dispose: () => {
            // Clear listeners on dispose
            changeListeners.length = 0;
          },
          onDidChangeModelContent: (callback) => {
            changeListeners.push(callback);
            return {
              dispose: () => {
                const index = changeListeners.indexOf(callback);
                if (index > -1) {
                  changeListeners.splice(index, 1);
                }
              }
            };
          }
        };

        return editor;
      },
      getModels: () => models,
      createModel: (value = '', language) => {
        let modelValue = value;
        const model = {
          getValue: () => modelValue,
          setValue: (newValue) => {
            modelValue = newValue;
          },
          dispose: () => {
            const index = models.indexOf(model);
            if (index > -1) {
              models.splice(index, 1);
            }
          }
        };
        models.push(model);
        return model;
      }
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
