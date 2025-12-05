import { beforeEach, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup for integration tests that use Monaco
beforeEach(() => {
  // Set up Monaco loader
  global.MonacoEnvironment = {
    getWorkerUrl: function(moduleId, label) {
      const monacoBase = path.join(__dirname, 'monaco', 'min', 'vs');

      if (label === 'json') {
        return `${monacoBase}/language/json/json.worker.js`;
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return `${monacoBase}/language/css/css.worker.js`;
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return `${monacoBase}/language/html/html.worker.js`;
      }
      if (label === 'typescript' || label === 'javascript') {
        return `${monacoBase}/language/typescript/ts.worker.js`;
      }
      return `${monacoBase}/editor/editor.worker.js`;
    }
  };
});

afterEach(() => {
  // Cleanup Monaco instances
  if (global.monaco) {
    const models = global.monaco.editor.getModels();
    models.forEach(model => model.dispose());
  }
});
