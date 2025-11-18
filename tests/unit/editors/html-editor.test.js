import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadCore } from '../helpers/core-loader.js';
import { createMockLocalStorage } from '../helpers/test-utils.js';

describe('HTML Editor', () => {
  let HTMLEditorApp;

  beforeEach(async () => {
    // Reset mocks
    global.localStorage = createMockLocalStorage();
    vi.clearAllMocks();

    // Load core first (for BaseEditor)
    await loadCore();

    // Load HTML Editor module directly
    const htmlEditorModule = await import('../../../src/html-editor.js');
    HTMLEditorApp = htmlEditorModule.HTMLEditorApp;
  });

  describe('App Metadata', () => {
    it('should have correct app ID and name', () => {
      expect(HTMLEditorApp.id).toBe('html-editor');
      expect(HTMLEditorApp.name).toBe('HTML Editor');
    });

    it('should declare settings as dependency', () => {
      expect(HTMLEditorApp.dependencies).toEqual(['settings']);
    });

    it('should have overlay constraints configured', () => {
      expect(HTMLEditorApp.constraints).toBeDefined();
      expect(HTMLEditorApp.constraints.minWidth).toBe(420);
      expect(HTMLEditorApp.constraints.minHeight).toBe(300);
    });
  });

  describe('Field Configuration', () => {
    it('should define 2 HTML fields with correct IDs', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      expect(editorState.head).toBeDefined();
      expect(editorState.tail).toBeDefined();
    });

    it('should map fields to correct labels', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      expect(editorState.head.label).toBe('Page HTML Head');
      expect(editorState.tail.label).toBe('Page HTML Tail');
    });

    it('should only have 2 fields (not more)', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;
      const fieldIds = Object.keys(editorState);

      expect(fieldIds).toHaveLength(2);
      expect(fieldIds).toContain('head');
      expect(fieldIds).toContain('tail');
    });
  });

  describe('BaseEditor Integration', () => {
    it('should create BaseEditor instance with HTML configuration', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor).toBeDefined();
      expect(HTMLEditorApp._baseEditor.config.editorType).toBe('html');
    });

    it('should configure correct monaco language', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.monacoLanguage).toBe('html');
    });

    it('should configure correct file extension', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.fileExtension).toBe('.html');
    });

    it('should configure correct MIME type', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.mimeType).toBe('text/html');
    });

    it('should configure HTML comment style', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.commentStyle).toBe('<!-- -->');
    });

    it('should configure formatHTML as formatter method', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.formatterMethod).toBe('formatHTML');
    });

    it('should configure field as data attribute', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.dataAttribute).toBe('field');
    });

    it('should configure field as item label', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.itemLabel).toBe('field');
    });

    it('should set API endpoint to custom_html.php', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.apiEndpoint).toBe('/deki/cp/custom_html.php?params=%2F');
    });

    it('should set form field prefix to html_template_', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.formFieldPrefix).toBe('html_template_');
    });

    it('should set max active editors to 2', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.maxActiveEditors).toBe(2);
    });
  });

  describe('Editor State Initialization', () => {
    it('should initialize state for both fields', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      expect(editorState.head).toBeDefined();
      expect(editorState.tail).toBeDefined();
    });

    it('should initialize each field with correct structure', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const headField = HTMLEditorApp._baseEditor.editorState.head;

      expect(headField.active).toBe(false);
      expect(headField.editor).toBeNull();
      expect(headField.content).toBe('');
      expect(headField.label).toBe('Page HTML Head');
      expect(headField.isDirty).toBe(false);
    });

    it('should set correct label for head field', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.editorState.head.label).toBe('Page HTML Head');
    });

    it('should set correct label for tail field', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.editorState.tail.label).toBe('Page HTML Tail');
    });
  });

  describe('Field Switching Logic', () => {
    it('should track active field state', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      // Simulate field activation
      editorState.head.active = true;
      editorState.tail.active = false;

      expect(editorState.head.active).toBe(true);
      expect(editorState.tail.active).toBe(false);
    });

    it('should allow both fields to be active simultaneously', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      // Activate both fields (max is 2)
      editorState.head.active = true;
      editorState.tail.active = true;

      expect(editorState.head.active).toBe(true);
      expect(editorState.tail.active).toBe(true);
    });

    it('should persist active fields in state', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      editorState.head.active = true;
      editorState.tail.active = true;

      const state = HTMLEditorApp.getState();

      // HTML Editor uses 'activeFields' instead of 'activeRoles'
      expect(state.activeFields).toContain('head');
      expect(state.activeFields).toContain('tail');
    });
  });

  describe('Dirty State Tracking Per Field', () => {
    it('should track dirty state independently per field', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      editorState.head.isDirty = true;
      editorState.tail.isDirty = false;

      expect(editorState.head.isDirty).toBe(true);
      expect(editorState.tail.isDirty).toBe(false);
    });

    it('should include dirty state in getState', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      editorState.head.isDirty = true;
      editorState.tail.isDirty = false;

      const state = HTMLEditorApp.getState();

      expect(state.isDirty.head).toBe(true);
      expect(state.isDirty.tail).toBe(false);
    });

    it('should restore dirty state from saved state', async () => {
      const savedState = {
        activeFields: ['head'],
        content: { head: '<script>alert("test")</script>' },
        isDirty: { head: true, tail: false },
        originalContent: { head: '' }
      };

      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => savedState) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);
      HTMLEditorApp.setState(savedState);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      expect(editorState.head.isDirty).toBe(true);
      expect(editorState.tail.isDirty).toBe(false);
    });
  });

  describe('Content Management Per Field', () => {
    it('should store content independently per field', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      editorState.head.content = '<meta name="description" content="Test">';
      editorState.tail.content = '<script>console.log("footer")</script>';

      expect(editorState.head.content).toBe('<meta name="description" content="Test">');
      expect(editorState.tail.content).toBe('<script>console.log("footer")</script>');
    });

    it('should include content in getState', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      editorState.head.content = '<link rel="stylesheet" href="custom.css">';

      const state = HTMLEditorApp.getState();

      expect(state.content.head).toBe('<link rel="stylesheet" href="custom.css">');
    });

    it('should restore content from saved state', async () => {
      const savedState = {
        activeFields: ['head', 'tail'],
        content: {
          head: '<meta charset="UTF-8">',
          tail: '<script src="analytics.js"></script>'
        },
        isDirty: { head: false, tail: true },
        originalContent: {
          head: '<meta charset="UTF-8">',
          tail: ''
        }
      };

      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => savedState) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);
      HTMLEditorApp.setState(savedState);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      expect(editorState.head.content).toBe('<meta charset="UTF-8">');
      expect(editorState.tail.content).toBe('<script src="analytics.js"></script>');
    });
  });

  describe('Form Data Construction', () => {
    it('should build form data for save with CSRF token', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;
      const originalContent = HTMLEditorApp._baseEditor.originalContent;

      // Set up state
      editorState.head.content = '<meta name="test">';
      originalContent.head = '<meta name="test">';

      const formData = HTMLEditorApp._baseEditor.buildFormDataForSave('head');

      // Should have csrf_token field (actual value depends on loadData being called)
      expect(formData).toHaveProperty('csrf_token');
    });

    it('should include both field fields in form data', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;
      editorState.head.content = '<meta name="viewport" content="width=device-width">';
      editorState.tail.content = '<script>window.loaded = true;</script>';

      const originalContent = HTMLEditorApp._baseEditor.originalContent;
      originalContent.head = '<meta name="viewport" content="width=device-width">';
      originalContent.tail = '<script>window.loaded = true;</script>';

      const formData = HTMLEditorApp._baseEditor.buildFormDataForSave('head');

      expect(formData.html_template_head).toBe('<meta name="viewport" content="width=device-width">');
      expect(formData.html_template_tail).toBe('<script>window.loaded = true;</script>');
    });

    it('should use current content for saved field, original for others', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;
      editorState.head.content = 'modified head html';
      editorState.tail.content = 'modified tail html';

      const originalContent = HTMLEditorApp._baseEditor.originalContent;
      originalContent.head = 'original head html';
      originalContent.tail = 'original tail html';

      // Save only 'head' field
      const formData = HTMLEditorApp._baseEditor.buildFormDataForSave('head');

      expect(formData.html_template_head).toBe('modified head html');
      expect(formData.html_template_tail).toBe('original tail html');
    });

    it('should build form data for save all with all current content', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;
      editorState.head.content = 'head modified';
      editorState.tail.content = 'tail modified';

      const formData = HTMLEditorApp._baseEditor.buildFormDataForSaveAll();

      expect(formData).toHaveProperty('csrf_token');
      expect(formData.html_template_head).toBe('head modified');
      expect(formData.html_template_tail).toBe('tail modified');
    });
  });

  describe('HTML-Specific Configuration Validation', () => {
    it('should use correct HTML comment style format', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const commentStyle = HTMLEditorApp._baseEditor.config.commentStyle;

      expect(commentStyle).toBe('<!-- -->');
      expect(commentStyle).toContain('<!--');
      expect(commentStyle).toContain('-->');
    });

    it('should validate comment style is not CSS style', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const commentStyle = HTMLEditorApp._baseEditor.config.commentStyle;

      expect(commentStyle).not.toBe('/* */');
      expect(commentStyle).not.toContain('/*');
    });

    it('should use html as monaco language', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.monacoLanguage).toBe('html');
      expect(HTMLEditorApp._baseEditor.config.monacoLanguage).not.toBe('css');
    });

    it('should use formatHTML formatter method', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.formatterMethod).toBe('formatHTML');
      expect(HTMLEditorApp._baseEditor.config.formatterMethod).not.toBe('formatCSS');
    });

    it('should use .html file extension', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.fileExtension).toBe('.html');
      expect(HTMLEditorApp._baseEditor.config.fileExtension).not.toBe('.css');
    });

    it('should use text/html MIME type', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      expect(HTMLEditorApp._baseEditor.config.mimeType).toBe('text/html');
      expect(HTMLEditorApp._baseEditor.config.mimeType).not.toBe('text/css');
    });
  });

  describe('No Live Preview Feature', () => {
    it('should not include live preview state in getState', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const state = HTMLEditorApp.getState();

      // HTML Editor should not have live preview (CSS Editor feature)
      expect(state.livePreview).toBeUndefined();
    });

    it('should have simpler state structure than CSS Editor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const state = HTMLEditorApp.getState();

      // Should have base editor state (uses 'activeFields' not 'activeRoles')
      expect(state.activeFields).toBeDefined();
      expect(state.content).toBeDefined();
      expect(state.isDirty).toBeDefined();
      expect(state.originalContent).toBeDefined();

      // Should not have CSS-specific features
      expect(state.livePreview).toBeUndefined();
    });
  });

  describe('Method Delegation to BaseEditor', () => {
    it('should delegate toggleEditor to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'toggleEditor').mockImplementation(() => {});

      HTMLEditorApp.toggleEditor('head');

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toBe('head');
      spy.mockRestore();
    });

    it('should delegate exportField to BaseEditor.exportItem', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'exportItem').mockImplementation(() => {});

      HTMLEditorApp.exportField('tail');

      expect(spy).toHaveBeenCalledWith('tail');
      spy.mockRestore();
    });

    it('should delegate importField to BaseEditor.importItem', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const mockFile = new File(['<html></html>'], 'test.html', { type: 'text/html' });
      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'importItem').mockImplementation(() => {});

      HTMLEditorApp.importField('head', mockFile);

      expect(spy).toHaveBeenCalledWith('head', mockFile);
      spy.mockRestore();
    });

    it('should delegate formatField to BaseEditor.formatItem', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'formatItem').mockImplementation(() => {});

      HTMLEditorApp.formatField('tail');

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toBe('tail');
      spy.mockRestore();
    });

    it('should delegate discardAll to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'discardAll').mockImplementation(() => {});

      HTMLEditorApp.discardAll();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should delegate revertField to BaseEditor.revertItem', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'revertItem').mockImplementation(() => {});

      HTMLEditorApp.revertField('head');

      expect(spy).toHaveBeenCalledWith('head');
      spy.mockRestore();
    });

    it('should delegate checkViewportWidth to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'checkViewportWidth').mockImplementation(() => false);

      const result = HTMLEditorApp.checkViewportWidth();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should delegate handleMobileEditorChange to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'handleMobileEditorChange').mockImplementation(() => {});

      HTMLEditorApp.handleMobileEditorChange('tail');

      expect(spy).toHaveBeenCalledWith('tail');
      spy.mockRestore();
    });

    it('should delegate buildToggleBar to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'buildToggleBar').mockImplementation(() => {});

      HTMLEditorApp.buildToggleBar();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should delegate setupSaveDropdown to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'setupSaveDropdown').mockImplementation(() => {});

      HTMLEditorApp.setupSaveDropdown();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should delegate saveState to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'saveState').mockImplementation(() => {});

      HTMLEditorApp.saveState();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should delegate updateGrid to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'updateGrid').mockImplementation(() => {});

      HTMLEditorApp.updateGrid();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should delegate updateHeights to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'updateHeights').mockImplementation(() => {});

      HTMLEditorApp.updateHeights();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should delegate updateToggleButtons to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'updateToggleButtons').mockImplementation(() => {});

      HTMLEditorApp.updateToggleButtons();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should delegate performDiscardAll to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'performDiscardAll').mockImplementation(() => {});

      HTMLEditorApp.performDiscardAll();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should delegate performRevert to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'performRevert').mockImplementation(() => {});

      HTMLEditorApp.performRevert('head');

      expect(spy).toHaveBeenCalledWith('head');
      spy.mockRestore();
    });

    it('should delegate toggleEditorDropdown to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'toggleEditorDropdown').mockImplementation(() => {});

      HTMLEditorApp.toggleEditorDropdown('tail');

      expect(spy).toHaveBeenCalledWith('tail');
      spy.mockRestore();
    });

    it('should delegate toggleActionsDropdown to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const spy = vi.spyOn(HTMLEditorApp._baseEditor, 'toggleActionsDropdown').mockImplementation(() => {});

      HTMLEditorApp.toggleActionsDropdown('head');

      expect(spy).toHaveBeenCalledWith('head');
      spy.mockRestore();
    });
  });

  describe('State Persistence Integration', () => {
    it('should include all required state fields', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);

      const editorState = HTMLEditorApp._baseEditor.editorState;
      editorState.head.active = true;
      editorState.head.content = '<meta charset="UTF-8">';

      const state = HTMLEditorApp.getState();

      // Should have base editor state fields (uses 'activeFields' not 'activeRoles')
      expect(state.activeFields).toBeDefined();
      expect(state.content).toBeDefined();
      expect(state.isDirty).toBeDefined();
      expect(state.originalContent).toBeDefined();
    });

    it('should restore complete state', async () => {
      const completeState = {
        activeFields: ['head', 'tail'],
        content: {
          head: '<meta charset="UTF-8">',
          tail: '<script>console.log("loaded")</script>'
        },
        isDirty: {
          head: false,
          tail: true
        },
        originalContent: {
          head: '<meta charset="UTF-8">',
          tail: ''
        }
      };

      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => completeState) },
        Config: { get: vi.fn() }
      };

      await HTMLEditorApp.init(mockContext);
      HTMLEditorApp.setState(completeState);

      const editorState = HTMLEditorApp._baseEditor.editorState;

      // State restored correctly
      expect(editorState.head.active).toBe(true);
      expect(editorState.tail.active).toBe(true);
      expect(editorState.head.content).toBe('<meta charset="UTF-8">');
      expect(editorState.tail.content).toBe('<script>console.log("loaded")</script>');
      expect(editorState.tail.isDirty).toBe(true);
    });
  });
});
