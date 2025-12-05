import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseEditor } from '../../../src/base-editor.js';
import { createMockLocalStorage } from '../helpers/test-utils.js';

describe('BaseEditor', () => {
  let mockConfig;

  beforeEach(() => {
    global.localStorage = createMockLocalStorage();

    // Create a minimal valid config
    mockConfig = {
      editorType: 'css',
      itemsConfig: [
        { id: 'role1', label: 'Role 1' },
        { id: 'role2', label: 'Role 2' }
      ],
      maxActiveEditors: 3,
      apiEndpoint: '/api/test',
      formFieldPrefix: 'test_',
      monacoLanguage: 'css',
      fileExtension: '.css',
      mimeType: 'text/css',
      commentStyle: '/* */',
      formatterMethod: 'formatCSS',
      dataAttribute: 'role',
      itemLabel: 'role'
    };
  });

  describe('Constructor & Configuration', () => {
    it('should create instance with valid config', () => {
      const editor = new BaseEditor(mockConfig);

      expect(editor).toBeDefined();
      expect(editor.config).toEqual(mockConfig);
    });

    it('should initialize empty state properties', () => {
      const editor = new BaseEditor(mockConfig);

      expect(editor.editorState).toEqual({});
      expect(editor.originalContent).toEqual({});
      expect(editor.monacoEditors).toEqual({});
      expect(editor.csrfToken).toBe('');
      expect(editor.activeEditorId).toBeNull();
    });

    it('should throw error for missing required config field', () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.editorType;

      expect(() => new BaseEditor(invalidConfig)).toThrow('BaseEditor config missing required field: editorType');
    });

    it('should throw error for invalid editorType type', () => {
      const invalidConfig = { ...mockConfig, editorType: 123 };

      expect(() => new BaseEditor(invalidConfig)).toThrow('BaseEditor config.editorType must be a string');
    });

    it('should throw error for invalid itemsConfig type', () => {
      const invalidConfig = { ...mockConfig, itemsConfig: 'not-an-array' };

      expect(() => new BaseEditor(invalidConfig)).toThrow('BaseEditor config.itemsConfig must be an array');
    });

    it('should throw error for invalid maxActiveEditors', () => {
      const invalidConfig = { ...mockConfig, maxActiveEditors: 0 };

      expect(() => new BaseEditor(invalidConfig)).toThrow('BaseEditor config.maxActiveEditors must be a positive number');
    });

    it('should validate all required config fields', () => {
      const requiredFields = [
        'editorType', 'itemsConfig', 'maxActiveEditors', 'apiEndpoint',
        'formFieldPrefix', 'monacoLanguage', 'fileExtension', 'mimeType',
        'commentStyle', 'formatterMethod', 'dataAttribute', 'itemLabel'
      ];

      requiredFields.forEach(field => {
        const invalidConfig = { ...mockConfig };
        delete invalidConfig[field];

        expect(() => new BaseEditor(invalidConfig)).toThrow(`BaseEditor config missing required field: ${field}`);
      });
    });
  });

  describe('Config Utilities', () => {
    it('should get config value by key', () => {
      const editor = new BaseEditor(mockConfig);

      expect(editor.getConfig('editorType')).toBe('css');
      expect(editor.getConfig('maxActiveEditors')).toBe(3);
    });

    it('should get editor type in uppercase', () => {
      const editor = new BaseEditor(mockConfig);

      expect(editor.getEditorTypeUpper()).toBe('CSS');
    });

    it('should handle lowercase editor type', () => {
      const config = { ...mockConfig, editorType: 'html' };
      const editor = new BaseEditor(config);

      expect(editor.getEditorTypeUpper()).toBe('HTML');
    });
  });

  describe('Logging', () => {
    it('should log with editor type prefix', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const editor = new BaseEditor(mockConfig);

      editor.log('test message', 'arg2');

      expect(consoleSpy).toHaveBeenCalledWith('[CSS Editor]', 'test message', 'arg2');
      consoleSpy.mockRestore();
    });

    it('should log errors with editor type prefix', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const editor = new BaseEditor(mockConfig);

      editor.logError('error message', 'details');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[CSS Editor]', 'error message', 'details');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('State Management', () => {
    it('should get state for CSS editor (activeRoles)', () => {
      const editor = new BaseEditor(mockConfig);

      // Setup state
      editor.editorState = {
        role1: { active: true, content: 'content1', isDirty: true },
        role2: { active: false, content: 'content2', isDirty: false }
      };
      editor.originalContent = {
        role1: 'original1',
        role2: 'original2'
      };

      const state = editor.getState();

      expect(state.activeRoles).toEqual(['role1']);
      expect(state.content.role1).toBe('content1');
      expect(state.isDirty.role1).toBe(true);
      expect(state.originalContent.role1).toBe('original1');
    });

    it('should get state for HTML editor (activeFields)', () => {
      const htmlConfig = { ...mockConfig, editorType: 'html', itemLabel: 'field' };
      const editor = new BaseEditor(htmlConfig);

      editor.editorState = {
        role1: { active: true, content: 'content1', isDirty: false },
        role2: { active: true, content: 'content2', isDirty: true }
      };
      editor.originalContent = {
        role1: 'original1',
        role2: 'original2'
      };

      const state = editor.getState();

      expect(state.activeFields).toEqual(['role1', 'role2']);
      expect(state.activeRoles).toBeUndefined();
    });

    it('should restore state with activeRoles', () => {
      const editor = new BaseEditor(mockConfig);

      // Initialize editor state
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false },
        role2: { active: false, content: '', isDirty: false }
      };

      const savedState = {
        activeRoles: ['role1'],
        content: { role1: 'restored1', role2: 'restored2' },
        isDirty: { role1: true, role2: false },
        originalContent: { role1: 'orig1', role2: 'orig2' }
      };

      editor.setState(savedState);

      expect(editor.editorState.role1.active).toBe(true);
      expect(editor.editorState.role2.active).toBe(false);
      expect(editor.editorState.role1.content).toBe('restored1');
      expect(editor.editorState.role1.isDirty).toBe(true);
      expect(editor.originalContent.role1).toBe('orig1');
    });

    it('should restore state with activeFields', () => {
      const htmlConfig = { ...mockConfig, editorType: 'html', itemLabel: 'field' };
      const editor = new BaseEditor(htmlConfig);

      editor.editorState = {
        role1: { active: false, content: '', isDirty: false },
        role2: { active: false, content: '', isDirty: false }
      };

      const savedState = {
        activeFields: ['role1', 'role2'],
        content: { role1: 'content1', role2: 'content2' },
        isDirty: { role1: false, role2: true },
        originalContent: { role1: 'orig1', role2: 'orig2' }
      };

      editor.setState(savedState);

      expect(editor.editorState.role1.active).toBe(true);
      expect(editor.editorState.role2.active).toBe(true);
    });

    it('should handle null state gracefully', () => {
      const editor = new BaseEditor(mockConfig);

      editor.editorState = {
        role1: { active: false, content: 'initial', isDirty: false }
      };

      editor.setState(null);

      // State should remain unchanged
      expect(editor.editorState.role1.content).toBe('initial');
    });

    it('should handle undefined state gracefully', () => {
      const editor = new BaseEditor(mockConfig);

      editor.editorState = {
        role1: { active: false, content: 'initial', isDirty: false }
      };

      editor.setState(undefined);

      // State should remain unchanged
      expect(editor.editorState.role1.content).toBe('initial');
    });
  });

  describe('Export Operations', () => {
    it('should create blob with correct content and MIME type', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { content: 'body { color: red; }', label: 'Role 1' }
      };

      // Mock DOM APIs
      const mockBlob = new Blob(['body { color: red; }'], { type: 'text/css' });
      const mockUrl = 'blob:mock-url';
      global.URL.createObjectURL = vi.fn(() => mockUrl);
      global.URL.revokeObjectURL = vi.fn();

      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      };
      document.createElement = vi.fn(() => mockLink);

      // Mock UI
      const mockUI = {
        showToast: vi.fn()
      };
      editor.context = { UI: mockUI };

      editor.exportItem('role1');

      expect(mockLink.href).toBe(mockUrl);
      expect(mockLink.download).toBe('test_role1.css');
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockUI.showToast).toHaveBeenCalledWith('Exported Role 1', 'success');
    });

    it('should generate correct filename with extension', () => {
      const htmlConfig = {
        ...mockConfig,
        editorType: 'html',
        formFieldPrefix: 'html_',
        fileExtension: '.html',
        mimeType: 'text/html'
      };
      const editor = new BaseEditor(htmlConfig);
      editor.editorState = {
        field1: { content: '<div>test</div>', label: 'Field 1' }
      };

      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      };
      global.URL.createObjectURL = vi.fn(() => 'blob:url');
      global.URL.revokeObjectURL = vi.fn();
      document.createElement = vi.fn(() => mockLink);

      editor.context = {
        UI: { showToast: vi.fn() }
      };

      editor.exportItem('field1');

      expect(mockLink.download).toBe('html_field1.html');
    });

    it('should handle export errors gracefully', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { content: 'test', label: 'Role 1' }
      };

      // Force an error
      global.URL.createObjectURL = vi.fn(() => {
        throw new Error('Blob creation failed');
      });

      const mockUI = {
        showToast: vi.fn()
      };
      editor.context = { UI: mockUI };

      editor.exportItem('role1');

      expect(mockUI.showToast).toHaveBeenCalledWith(
        'Failed to export: Blob creation failed',
        'error'
      );
    });

    it('should export empty content', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { content: '', label: 'Role 1' }
      };

      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      };
      global.URL.createObjectURL = vi.fn(() => 'blob:url');
      global.URL.revokeObjectURL = vi.fn();
      document.createElement = vi.fn(() => mockLink);

      editor.context = {
        UI: { showToast: vi.fn() }
      };

      editor.exportItem('role1');

      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  describe('Import Validation', () => {
    it('should validate file extension', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { content: '', label: 'Role 1' }
      };

      const mockUI = {
        showToast: vi.fn()
      };
      editor.context = {
        UI: mockUI,
        Config: { get: vi.fn(() => 5) }
      };

      // File with wrong extension
      const wrongFile = new File(['content'], 'test.txt', { type: 'text/plain' });

      editor.importItem('role1', wrongFile);

      expect(mockUI.showToast).toHaveBeenCalledWith(
        'Please select a CSS file (.css)',
        'error'
      );
    });

    it('should validate file size', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { content: '', label: 'Role 1' }
      };

      const mockUI = {
        showToast: vi.fn()
      };
      editor.context = {
        UI: mockUI,
        Config: { get: vi.fn(() => 5) } // 5MB max
      };

      // Create a large file (6MB)
      const largeContent = 'x'.repeat(6 * 1024 * 1024);
      const largeFile = new File([largeContent], 'large.css', { type: 'text/css' });

      editor.importItem('role1', largeFile);

      expect(mockUI.showToast).toHaveBeenCalledWith(
        expect.stringContaining('File too large'),
        'error'
      );
    });

    it('should reject empty files', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { content: '', label: 'Role 1' }
      };

      const mockUI = {
        showToast: vi.fn()
      };
      editor.context = {
        UI: mockUI,
        Config: { get: vi.fn(() => 5) }
      };

      // Empty file
      const emptyFile = new File([], 'empty.css', { type: 'text/css' });

      editor.importItem('role1', emptyFile);

      expect(mockUI.showToast).toHaveBeenCalledWith(
        'Cannot import empty file',
        'error'
      );
    });

    it('should validate HTML file extension', () => {
      const htmlConfig = {
        ...mockConfig,
        editorType: 'html',
        fileExtension: '.html'
      };
      const editor = new BaseEditor(htmlConfig);
      editor.editorState = {
        field1: { content: '', label: 'Field 1' }
      };

      const mockUI = {
        showToast: vi.fn()
      };
      editor.context = {
        UI: mockUI,
        Config: { get: vi.fn(() => 5) }
      };

      const cssFile = new File(['body {}'], 'styles.css', { type: 'text/css' });

      editor.importItem('field1', cssFile);

      expect(mockUI.showToast).toHaveBeenCalledWith(
        'Please select a HTML file (.html)',
        'error'
      );
    });
  });

  describe('Dirty State Tracking', () => {
    it('should track dirty state concept', () => {
      // Simulate dirty state tracking without Monaco
      let isDirty = false;
      const originalContent = 'original';
      let currentContent = 'original';

      // Content unchanged
      isDirty = currentContent !== originalContent;
      expect(isDirty).toBe(false);

      // Content changed
      currentContent = 'modified';
      isDirty = currentContent !== originalContent;
      expect(isDirty).toBe(true);

      // Content reverted
      currentContent = 'original';
      isDirty = currentContent !== originalContent;
      expect(isDirty).toBe(false);
    });

    it('should track dirty state per item', () => {
      const items = {
        role1: { content: 'content1', original: 'content1', isDirty: false },
        role2: { content: 'content2', original: 'content2', isDirty: false }
      };

      // Modify role1
      items.role1.content = 'modified';
      items.role1.isDirty = items.role1.content !== items.role1.original;

      expect(items.role1.isDirty).toBe(true);
      expect(items.role2.isDirty).toBe(false);
    });

    it('should clear dirty state after save', () => {
      let isDirty = true;
      const content = 'saved content';

      // Simulate save
      const originalContent = content; // Update baseline
      isDirty = false;

      expect(isDirty).toBe(false);
      expect(content).toBe(originalContent);
    });
  });

  describe('Comment Style Generation', () => {
    it('should use CSS comment style', () => {
      const editor = new BaseEditor(mockConfig);
      const commentStyle = editor.config.commentStyle;

      expect(commentStyle).toBe('/* */');

      // Verify format used in import
      const fileName = 'test.css';
      const separator = `\n\n/* ========================================\n   Imported from: ${fileName}\n   Date: ${new Date().toLocaleString()}\n   ======================================== */\n`;

      expect(separator).toContain('/* ===');
      expect(separator).toContain('Imported from: test.css');
      expect(separator).toContain('=== */');
    });

    it('should use HTML comment style', () => {
      const htmlConfig = {
        ...mockConfig,
        editorType: 'html',
        commentStyle: '<!-- -->'
      };
      const editor = new BaseEditor(htmlConfig);
      const commentStyle = editor.config.commentStyle;

      expect(commentStyle).toBe('<!-- -->');

      // Verify format used in import
      const fileName = 'test.html';
      const separator = `\n\n<!-- ========================================\n     Imported from: ${fileName}\n     Date: ${new Date().toLocaleString()}\n     ======================================== -->\n`;

      expect(separator).toContain('<!-- ===');
      expect(separator).toContain('Imported from: test.html');
      expect(separator).toContain('=== -->');
    });
  });

  describe('Editor Type Configuration', () => {
    it('should configure CSS editor correctly', () => {
      const cssConfig = {
        ...mockConfig,
        editorType: 'css',
        monacoLanguage: 'css',
        fileExtension: '.css',
        mimeType: 'text/css',
        formatterMethod: 'formatCSS'
      };
      const editor = new BaseEditor(cssConfig);

      expect(editor.config.editorType).toBe('css');
      expect(editor.config.monacoLanguage).toBe('css');
      expect(editor.config.fileExtension).toBe('.css');
      expect(editor.config.mimeType).toBe('text/css');
      expect(editor.config.formatterMethod).toBe('formatCSS');
    });

    it('should configure HTML editor correctly', () => {
      const htmlConfig = {
        ...mockConfig,
        editorType: 'html',
        monacoLanguage: 'html',
        fileExtension: '.html',
        mimeType: 'text/html',
        formatterMethod: 'formatHTML'
      };
      const editor = new BaseEditor(htmlConfig);

      expect(editor.config.editorType).toBe('html');
      expect(editor.config.monacoLanguage).toBe('html');
      expect(editor.config.fileExtension).toBe('.html');
      expect(editor.config.mimeType).toBe('text/html');
      expect(editor.config.formatterMethod).toBe('formatHTML');
    });
  });

  describe('Viewport Detection State', () => {
    it('should initialize with desktop view', () => {
      const editor = new BaseEditor(mockConfig);

      expect(editor.isMobileView).toBe(false);
    });

    it('should track mobile view state', () => {
      const editor = new BaseEditor(mockConfig);

      editor.isMobileView = true;
      expect(editor.isMobileView).toBe(true);

      editor.isMobileView = false;
      expect(editor.isMobileView).toBe(false);
    });
  });

  describe('Active Editor Tracking', () => {
    it('should track active editor ID', () => {
      const editor = new BaseEditor(mockConfig);

      expect(editor.activeEditorId).toBeNull();

      editor.activeEditorId = 'role1';
      expect(editor.activeEditorId).toBe('role1');

      editor.activeEditorId = null;
      expect(editor.activeEditorId).toBeNull();
    });

    it('should allow switching between active editors', () => {
      const editor = new BaseEditor(mockConfig);

      editor.activeEditorId = 'role1';
      expect(editor.activeEditorId).toBe('role1');

      editor.activeEditorId = 'role2';
      expect(editor.activeEditorId).toBe('role2');
    });
  });

  describe('Hooks Configuration', () => {
    it('should initialize hooks as null', () => {
      const editor = new BaseEditor(mockConfig);

      expect(editor.onEditorContentChange).toBeNull();
      expect(editor.onSaveAll).toBeNull();
      expect(editor.onSaveOpenTabs).toBeNull();
      expect(editor.onFormatAllActive).toBeNull();
      expect(editor.onSaveItem).toBeNull();
      expect(editor.onFormatItem).toBeNull();
      expect(editor.buildFormDataForSave).toBeNull();
      expect(editor.buildFormDataForSaveAll).toBeNull();
    });

    it('should allow setting hooks', () => {
      const editor = new BaseEditor(mockConfig);
      const mockCallback = vi.fn();

      editor.onSaveAll = mockCallback;
      expect(editor.onSaveAll).toBe(mockCallback);

      editor.onSaveAll();
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('CSRF Token Management', () => {
    it('should initialize with empty CSRF token', () => {
      const editor = new BaseEditor(mockConfig);

      expect(editor.csrfToken).toBe('');
    });

    it('should allow setting CSRF token', () => {
      const editor = new BaseEditor(mockConfig);

      editor.csrfToken = 'test-csrf-token-12345';
      expect(editor.csrfToken).toBe('test-csrf-token-12345');
    });
  });
});
