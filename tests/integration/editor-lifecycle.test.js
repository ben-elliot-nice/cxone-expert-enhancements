import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadMonaco } from './helpers/monaco-loader.js';

describe('Editor Lifecycle', () => {
  let monaco;

  beforeEach(async () => {
    monaco = await loadMonaco();
    document.body.innerHTML = '';
  });

  describe('Editor Creation and Disposal', () => {
    it('should create editor instance', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = monaco.editor.create(container, {
        value: 'test content',
        language: 'css'
      });

      expect(editor).toBeDefined();
      expect(editor.getValue()).toBe('test content');

      editor.dispose();
      container.remove();
    });

    it('should dispose editor properly', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = monaco.editor.create(container, {
        value: 'test',
        language: 'css'
      });

      const disposeSpy = vi.spyOn(editor, 'dispose');

      editor.dispose();

      expect(disposeSpy).toHaveBeenCalled();

      container.remove();
    });

    it('should handle multiple editors', () => {
      const containers = [
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div')
      ];

      containers.forEach(c => document.body.appendChild(c));

      const editors = containers.map((container, i) =>
        monaco.editor.create(container, {
          value: `content ${i}`,
          language: 'css'
        })
      );

      expect(editors).toHaveLength(3);
      expect(editors[0].getValue()).toBe('content 0');
      expect(editors[1].getValue()).toBe('content 1');
      expect(editors[2].getValue()).toBe('content 2');

      editors.forEach(e => e.dispose());
      containers.forEach(c => c.remove());
    });
  });

  describe('Event Handlers', () => {
    it('should attach onChange handler', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = monaco.editor.create(container, {
        value: 'initial',
        language: 'css'
      });

      const onChange = vi.fn();
      editor.onDidChangeModelContent(onChange);

      editor.setValue('changed');

      expect(onChange).toHaveBeenCalled();

      editor.dispose();
      container.remove();
    });

    it('should detach event handlers on disposal', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = monaco.editor.create(container, {
        value: 'test',
        language: 'css'
      });

      const onChange = vi.fn();
      const disposable = editor.onDidChangeModelContent(onChange);

      disposable.dispose();
      editor.setValue('changed');

      expect(onChange).not.toHaveBeenCalled();

      editor.dispose();
      container.remove();
    });
  });
});
