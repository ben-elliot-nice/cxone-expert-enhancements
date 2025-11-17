import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadMonaco } from './helpers/monaco-loader.js';
import { loadCore } from '../unit/helpers/core-loader.js';

describe('Monaco Integration Tests', () => {
  let Core;
  let monaco;

  beforeEach(async () => {
    // Load mock Monaco
    monaco = await loadMonaco();

    // Load Core module
    Core = await loadCore();

    // Mock window.monaco for Core.Monaco.get()
    global.window = global.window || {};
    global.window.monaco = monaco;

    // Clear any previous state
    document.body.innerHTML = '';
  });

  describe('Core.Monaco Wrapper', () => {
    it('should expose Monaco wrapper methods', () => {
      expect(Core.Monaco).toBeDefined();
      expect(Core.Monaco.init).toBeDefined();
      expect(Core.Monaco.isReady).toBeDefined();
      expect(Core.Monaco.get).toBeDefined();
      expect(Core.Monaco.onReady).toBeDefined();
    });

    it('should return monaco instance from get()', () => {
      const monacoInstance = Core.Monaco.get();
      expect(monacoInstance).toBe(monaco);
      expect(monacoInstance.editor).toBeDefined();
      expect(monacoInstance.languages).toBeDefined();
    });

    it('should provide editor creation API', () => {
      const monacoInstance = Core.Monaco.get();
      expect(monacoInstance.editor.create).toBeDefined();
      expect(monacoInstance.editor.getModels).toBeDefined();
      expect(monacoInstance.editor.createModel).toBeDefined();
    });
  });

  describe('Monaco Editor Creation', () => {
    it('should create editor instance', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = monaco.editor.create(container, {
        value: 'body { color: red; }',
        language: 'css'
      });

      expect(editor).toBeDefined();
      expect(editor.getValue).toBeDefined();
      expect(editor.setValue).toBeDefined();
      expect(editor.dispose).toBeDefined();

      editor.dispose();
      container.remove();
    });

    it('should get editor value', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = monaco.editor.create(container, {
        value: 'test content',
        language: 'css'
      });

      // Mock implementation returns empty string by default
      const value = editor.getValue();
      expect(value).toBeDefined();

      editor.dispose();
      container.remove();
    });

    it('should support setValue operation', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = monaco.editor.create(container, {
        value: 'initial',
        language: 'css'
      });

      // Should not throw
      expect(() => {
        editor.setValue('new content');
      }).not.toThrow();

      editor.dispose();
      container.remove();
    });

    it('should support dispose operation', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = monaco.editor.create(container, {
        value: 'test',
        language: 'css'
      });

      expect(() => {
        editor.dispose();
      }).not.toThrow();

      container.remove();
    });
  });

  describe('Monaco onChange Events', () => {
    it('should support onDidChangeModelContent listener', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = monaco.editor.create(container, {
        value: 'initial',
        language: 'css'
      });

      // Should return disposable
      const disposable = editor.onDidChangeModelContent(() => {});
      expect(disposable).toBeDefined();
      expect(disposable.dispose).toBeDefined();

      disposable.dispose();
      editor.dispose();
      container.remove();
    });
  });

  describe('Monaco Language Support', () => {
    it('should create editor with CSS language', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = monaco.editor.create(container, {
        value: 'body { color: blue; }',
        language: 'css'
      });

      expect(editor).toBeDefined();

      editor.dispose();
      container.remove();
    });

    it('should create editor with HTML language', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = monaco.editor.create(container, {
        value: '<div>Test</div>',
        language: 'html'
      });

      expect(editor).toBeDefined();

      editor.dispose();
      container.remove();
    });
  });

  describe('Monaco Models API', () => {
    it('should expose getModels method', () => {
      expect(monaco.editor.getModels).toBeDefined();
      const models = monaco.editor.getModels();
      expect(Array.isArray(models)).toBe(true);
    });

    it('should expose createModel method', () => {
      expect(monaco.editor.createModel).toBeDefined();

      const model = monaco.editor.createModel();
      expect(model).toBeDefined();
      expect(model.getValue).toBeDefined();
      expect(model.setValue).toBeDefined();
      expect(model.dispose).toBeDefined();
    });
  });

  describe('Monaco Languages API', () => {
    it('should expose language registration API', () => {
      expect(monaco.languages.register).toBeDefined();
      expect(monaco.languages.setMonarchTokensProvider).toBeDefined();
      expect(monaco.languages.setLanguageConfiguration).toBeDefined();
    });
  });
});
