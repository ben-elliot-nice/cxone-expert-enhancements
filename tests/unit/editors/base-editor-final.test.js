import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseEditor } from '../../../src/base-editor.js';
import { createMockLocalStorage } from '../helpers/test-utils.js';

/**
 * BaseEditor Final Tests - Task 2.14
 *
 * Testing remaining testable business logic from uncovered lines:
 * - toggleEditor() - Editor activation logic with shift-click support (lines 1024-1062)
 * - getState() / setState() - State serialization and restoration (lines 174-239)
 * - saveState() - Storage integration (lines 244-248)
 * - importItem() - Comment separator generation logic (lines 476-483)
 *
 * Note: DOM-heavy methods (createEditorPane, updateGrid, toggleDropdowns, etc.)
 * are intentionally skipped as they're better suited for integration/E2E tests.
 */
describe('BaseEditor Final Business Logic', () => {
  let mockConfig;
  let mockContext;
  let mockButton;

  beforeEach(() => {
    global.localStorage = createMockLocalStorage();

    mockButton = {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false)
      },
      disabled: false,
      textContent: '',
      style: {}
    };

    global.document = {
      getElementById: vi.fn((id) => {
        if (id === 'toggle-bar') return { querySelectorAll: vi.fn(() => []) };
        if (id === 'expert-enhancements-overlay') return { offsetWidth: 1200 };
        return null;
      }),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      createElement: vi.fn(() => ({
        classList: { add: vi.fn(), remove: vi.fn() },
        style: {},
        appendChild: vi.fn(),
        addEventListener: vi.fn()
      }))
    };

    mockConfig = {
      editorType: 'css',
      itemLabel: 'role',
      dataAttribute: 'role',
      formFieldPrefix: 'test_',
      fileExtension: '.css',
      mimeType: 'text/css',
      commentStyle: '/* */',
      monacoLanguage: 'css',
      formatterMethod: 'css',
      itemsConfig: [
        { id: 'role1', label: 'Role 1' },
        { id: 'role2', label: 'Role 2' },
        { id: 'role3', label: 'Role 3' },
        { id: 'role4', label: 'Role 4' }
      ],
      maxActiveEditors: 3,
      apiEndpoint: '/api/test'
    };

    mockContext = {
      Storage: {
        setAppState: vi.fn(),
        getAppState: vi.fn(() => null)
      },
      UI: {
        showToast: vi.fn(),
        showConfirmDialog: vi.fn(),
        showItemSelector: vi.fn()
      },
      Config: {
        get: vi.fn((key) => {
          if (key === 'editor.maxActiveTabs') return 3;
          if (key === 'files.maxSizeMB') return 5;
          return null;
        })
      },
      LoadingOverlay: {
        show: vi.fn(),
        hide: vi.fn()
      },
      DOM: {
        create: vi.fn(() => ({
          appendChild: vi.fn(),
          addEventListener: vi.fn(),
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {}
        }))
      },
      Monaco: {
        isReady: vi.fn(() => false),
        get: vi.fn()
      },
      Formatter: {
        isReady: vi.fn(() => false)
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Editor Activation Logic - toggleEditor()
  // ============================================================================

  describe('Editor Activation Logic - toggleEditor()', () => {
    it('should activate editor when not already active (regular click)', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false, label: 'Role 1' },
        role2: { active: false, content: '', isDirty: false, label: 'Role 2' }
      };
      editor.updateGrid = vi.fn();
      editor.updateToggleButtons = vi.fn();

      const event = { shiftKey: false };
      editor.toggleEditor('role1', event);

      expect(editor.editorState.role1.active).toBe(true);
      expect(editor.editorState.role2.active).toBe(false);
    });

    it('should deactivate other editors when activating one (regular click)', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: true, content: '', isDirty: false, label: 'Role 1' },
        role2: { active: false, content: '', isDirty: false, label: 'Role 2' }
      };
      editor.updateGrid = vi.fn();
      editor.updateToggleButtons = vi.fn();

      const event = { shiftKey: false };
      editor.toggleEditor('role2', event);

      expect(editor.editorState.role1.active).toBe(false);
      expect(editor.editorState.role2.active).toBe(true);
    });

    it('should not close editor if it is the only one open (regular click)', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: true, content: '', isDirty: false, label: 'Role 1' },
        role2: { active: false, content: '', isDirty: false, label: 'Role 2' }
      };
      editor.updateGrid = vi.fn();
      editor.updateToggleButtons = vi.fn();

      const event = { shiftKey: false };
      editor.toggleEditor('role1', event);

      // Should remain active (don't close the only open editor)
      expect(editor.editorState.role1.active).toBe(true);
      expect(editor.updateGrid).not.toHaveBeenCalled();
    });

    it('should support shift+click to activate editor alongside others', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: true, content: '', isDirty: false, label: 'Role 1' },
        role2: { active: false, content: '', isDirty: false, label: 'Role 2' }
      };
      editor.updateGrid = vi.fn();
      editor.updateToggleButtons = vi.fn();

      const event = { shiftKey: true };
      editor.toggleEditor('role2', event);

      // Both should be active
      expect(editor.editorState.role1.active).toBe(true);
      expect(editor.editorState.role2.active).toBe(true);
    });

    it('should support shift+click to deactivate editor while keeping others', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: true, content: '', isDirty: false, label: 'Role 1' },
        role2: { active: true, content: '', isDirty: false, label: 'Role 2' }
      };
      editor.updateGrid = vi.fn();
      editor.updateToggleButtons = vi.fn();

      const event = { shiftKey: true };
      editor.toggleEditor('role2', event);

      // role1 stays active, role2 deactivated
      expect(editor.editorState.role1.active).toBe(true);
      expect(editor.editorState.role2.active).toBe(false);
    });

    it('should enforce max active editors limit on shift+click', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: true, content: '', isDirty: false, label: 'Role 1' },
        role2: { active: true, content: '', isDirty: false, label: 'Role 2' },
        role3: { active: true, content: '', isDirty: false, label: 'Role 3' },
        role4: { active: false, content: '', isDirty: false, label: 'Role 4' }
      };
      editor.updateGrid = vi.fn();
      editor.updateToggleButtons = vi.fn();

      const event = { shiftKey: true };
      editor.toggleEditor('role4', event);

      // Should not activate (max is 3)
      expect(editor.editorState.role4.active).toBe(false);
      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'Maximum 3 editors can be open at once',
        'warning'
      );
    });

    it('should call updateGrid and updateToggleButtons after toggling', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false, label: 'Role 1' }
      };
      editor.updateGrid = vi.fn();
      editor.updateToggleButtons = vi.fn();

      const event = { shiftKey: false };
      editor.toggleEditor('role1', event);

      expect(editor.updateGrid).toHaveBeenCalled();
      expect(editor.updateToggleButtons).toHaveBeenCalled();
      expect(mockContext.Storage.setAppState).toHaveBeenCalled();
    });

    it('should handle null or undefined event (no shift key)', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false, label: 'Role 1' },
        role2: { active: true, content: '', isDirty: false, label: 'Role 2' }
      };
      editor.updateGrid = vi.fn();
      editor.updateToggleButtons = vi.fn();

      editor.toggleEditor('role1', null);

      // Should behave like regular click
      expect(editor.editorState.role1.active).toBe(true);
      expect(editor.editorState.role2.active).toBe(false);
    });

    it('should do nothing if item does not exist', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: true, content: '', isDirty: false, label: 'Role 1' }
      };
      editor.updateGrid = vi.fn();
      editor.updateToggleButtons = vi.fn();

      const event = { shiftKey: false };
      editor.toggleEditor('nonexistent', event);

      expect(editor.updateGrid).not.toHaveBeenCalled();
      expect(editor.updateToggleButtons).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // State Serialization - getState()
  // ============================================================================

  describe('State Serialization - getState()', () => {
    it('should serialize active roles correctly (CSS editor)', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { active: true, content: 'body {}', isDirty: false, label: 'Role 1' },
        role2: { active: false, content: 'div {}', isDirty: true, label: 'Role 2' },
        role3: { active: true, content: '', isDirty: false, label: 'Role 3' }
      };
      editor.originalContent = {
        role1: 'original1',
        role2: 'original2',
        role3: 'original3'
      };

      const state = editor.getState();

      expect(state.activeRoles).toEqual(['role1', 'role3']);
      expect(state.content.role1).toBe('body {}');
      expect(state.content.role2).toBe('div {}');
      expect(state.isDirty.role2).toBe(true);
      expect(state.originalContent.role1).toBe('original1');
    });

    it('should serialize active fields correctly (HTML editor)', () => {
      const htmlConfig = {
        ...mockConfig,
        editorType: 'html',
        itemLabel: 'field',
        dataAttribute: 'field',
        itemsConfig: [
          { id: 'field1', label: 'Field 1' },
          { id: 'field2', label: 'Field 2' }
        ]
      };
      const editor = new BaseEditor(htmlConfig);
      editor.editorState = {
        field1: { active: true, content: '<div></div>', isDirty: false, label: 'Field 1' },
        field2: { active: false, content: '<p></p>', isDirty: false, label: 'Field 2' }
      };
      editor.originalContent = {
        field1: 'original1',
        field2: 'original2'
      };

      const state = editor.getState();

      expect(state.activeFields).toEqual(['field1']);
      expect(state.activeRoles).toBeUndefined();
      expect(state.content.field1).toBe('<div></div>');
    });

    it('should include all items in content/isDirty even if not active', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { active: true, content: 'active', isDirty: true, label: 'Role 1' },
        role2: { active: false, content: 'inactive', isDirty: false, label: 'Role 2' }
      };
      editor.originalContent = {
        role1: 'orig1',
        role2: 'orig2'
      };

      const state = editor.getState();

      expect(Object.keys(state.content)).toEqual(['role1', 'role2']);
      expect(Object.keys(state.isDirty)).toEqual(['role1', 'role2']);
      expect(Object.keys(state.originalContent)).toEqual(['role1', 'role2']);
    });

    it('should handle empty editor state', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {};
      editor.originalContent = {};

      const state = editor.getState();

      expect(state.activeRoles).toEqual([]);
      expect(state.content).toEqual({});
      expect(state.isDirty).toEqual({});
      expect(state.originalContent).toEqual({});
    });
  });

  // ============================================================================
  // State Restoration - setState()
  // ============================================================================

  describe('State Restoration - setState()', () => {
    it('should restore active roles from saved state', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false, label: 'Role 1' },
        role2: { active: false, content: '', isDirty: false, label: 'Role 2' },
        role3: { active: false, content: '', isDirty: false, label: 'Role 3' }
      };

      const savedState = {
        activeRoles: ['role1', 'role3'],
        content: {},
        isDirty: {},
        originalContent: {}
      };

      editor.setState(savedState);

      expect(editor.editorState.role1.active).toBe(true);
      expect(editor.editorState.role2.active).toBe(false);
      expect(editor.editorState.role3.active).toBe(true);
    });

    it('should restore content from saved state', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false, label: 'Role 1' },
        role2: { active: false, content: '', isDirty: false, label: 'Role 2' }
      };

      const savedState = {
        activeRoles: [],
        content: {
          role1: 'restored content 1',
          role2: 'restored content 2'
        },
        isDirty: {},
        originalContent: {}
      };

      editor.setState(savedState);

      expect(editor.editorState.role1.content).toBe('restored content 1');
      expect(editor.editorState.role2.content).toBe('restored content 2');
    });

    it('should restore dirty state from saved state', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false, label: 'Role 1' },
        role2: { active: false, content: '', isDirty: false, label: 'Role 2' }
      };

      const savedState = {
        activeRoles: [],
        content: {},
        isDirty: {
          role1: true,
          role2: false
        },
        originalContent: {}
      };

      editor.setState(savedState);

      expect(editor.editorState.role1.isDirty).toBe(true);
      expect(editor.editorState.role2.isDirty).toBe(false);
    });

    it('should restore originalContent from saved state', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false, label: 'Role 1' }
      };
      editor.originalContent = {};

      const savedState = {
        activeRoles: [],
        content: {},
        isDirty: {},
        originalContent: {
          role1: 'original from server'
        }
      };

      editor.setState(savedState);

      expect(editor.originalContent.role1).toBe('original from server');
    });

    it('should handle null state gracefully', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { active: false, content: 'test', isDirty: false, label: 'Role 1' }
      };

      editor.setState(null);

      // Should not crash, state unchanged
      expect(editor.editorState.role1.content).toBe('test');
    });

    it('should handle undefined state gracefully', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { active: false, content: 'test', isDirty: false, label: 'Role 1' }
      };

      editor.setState(undefined);

      // Should not crash, state unchanged
      expect(editor.editorState.role1.content).toBe('test');
    });

    it('should skip items in saved state that do not exist in editorState', () => {
      const editor = new BaseEditor(mockConfig);
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false, label: 'Role 1' }
      };

      const savedState = {
        activeRoles: ['role1', 'role2', 'role3'], // role2 and role3 don't exist
        content: {
          role1: 'content1',
          role2: 'content2'
        },
        isDirty: {},
        originalContent: {}
      };

      editor.setState(savedState);

      // Should restore role1, skip role2 and role3
      expect(editor.editorState.role1.active).toBe(true);
      expect(editor.editorState.role1.content).toBe('content1');
      expect(editor.editorState.role2).toBeUndefined();
    });

    it('should restore activeFields for HTML editor', () => {
      const htmlConfig = {
        ...mockConfig,
        editorType: 'html',
        itemLabel: 'field',
        dataAttribute: 'field',
        itemsConfig: [
          { id: 'field1', label: 'Field 1' },
          { id: 'field2', label: 'Field 2' }
        ]
      };
      const editor = new BaseEditor(htmlConfig);
      editor.editorState = {
        field1: { active: false, content: '', isDirty: false, label: 'Field 1' },
        field2: { active: false, content: '', isDirty: false, label: 'Field 2' }
      };

      const savedState = {
        activeFields: ['field2'],
        content: {},
        isDirty: {},
        originalContent: {}
      };

      editor.setState(savedState);

      expect(editor.editorState.field1.active).toBe(false);
      expect(editor.editorState.field2.active).toBe(true);
    });
  });

  // ============================================================================
  // State Persistence - saveState()
  // ============================================================================

  describe('State Persistence - saveState()', () => {
    it('should save state to storage with correct app ID (CSS editor)', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: true, content: 'test', isDirty: false, label: 'Role 1' }
      };
      editor.originalContent = { role1: 'original' };

      editor.saveState();

      expect(mockContext.Storage.setAppState).toHaveBeenCalledWith(
        'css-editor',
        expect.objectContaining({
          activeRoles: ['role1'],
          content: { role1: 'test' },
          originalContent: { role1: 'original' }
        })
      );
    });

    it('should save state to storage with correct app ID (HTML editor)', () => {
      const htmlConfig = {
        ...mockConfig,
        editorType: 'html',
        itemLabel: 'field',
        itemsConfig: [
          { id: 'field1', label: 'Field 1' }
        ]
      };
      const editor = new BaseEditor(htmlConfig);
      editor.context = mockContext;
      editor.editorState = {
        field1: { active: true, content: '<div></div>', isDirty: false, label: 'Field 1' }
      };
      editor.originalContent = { field1: '<p></p>' };

      editor.saveState();

      expect(mockContext.Storage.setAppState).toHaveBeenCalledWith(
        'html-editor',
        expect.objectContaining({
          activeFields: ['field1'],
          content: { field1: '<div></div>' },
          originalContent: { field1: '<p></p>' }
        })
      );
    });

    it('should call getState to serialize current state', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: true, content: 'test', isDirty: true, label: 'Role 1' }
      };
      editor.originalContent = { role1: 'original' };

      const getStateSpy = vi.spyOn(editor, 'getState');
      editor.saveState();

      expect(getStateSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Import Comment Separator Logic
  // ============================================================================

  describe('Import Comment Separator Generation', () => {
    it('should generate CSS-style comment separator', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: false, content: 'existing', isDirty: false, label: 'Role 1' }
      };

      const file = new File(['imported content'], 'test.css', { type: 'text/css' });

      // Mock FileReader
      const mockReader = {
        onload: null,
        onerror: null,
        readAsText: vi.fn(function() {
          this.onload({ target: { result: 'imported content' } });
        })
      };
      global.FileReader = vi.fn(function() {
        return mockReader;
      });

      editor.importItem('role1', file);

      // Check that content was appended with CSS-style comment
      expect(editor.editorState.role1.content).toContain('/* ========================================');
      expect(editor.editorState.role1.content).toContain('Imported from: test.css');
      expect(editor.editorState.role1.content).toContain('======================================== */');
      expect(editor.editorState.role1.content).toContain('imported content');
    });

    it('should generate HTML-style comment separator', () => {
      const htmlConfig = {
        ...mockConfig,
        editorType: 'html',
        fileExtension: '.html',
        commentStyle: '<!-- -->',
        itemsConfig: [
          { id: 'field1', label: 'Field 1' }
        ]
      };
      const editor = new BaseEditor(htmlConfig);
      editor.context = mockContext;
      editor.editorState = {
        field1: { active: false, content: 'existing', isDirty: false, label: 'Field 1' }
      };

      const file = new File(['<div>imported</div>'], 'test.html', { type: 'text/html' });

      // Mock FileReader
      const mockReader = {
        onload: null,
        onerror: null,
        readAsText: vi.fn(function() {
          this.onload({ target: { result: '<div>imported</div>' } });
        })
      };
      global.FileReader = vi.fn(function() {
        return mockReader;
      });

      editor.importItem('field1', file);

      // Check that content was appended with HTML-style comment
      expect(editor.editorState.field1.content).toContain('<!-- ========================================');
      expect(editor.editorState.field1.content).toContain('Imported from: test.html');
      expect(editor.editorState.field1.content).toContain('======================================== -->');
      expect(editor.editorState.field1.content).toContain('<div>imported</div>');
    });

    it('should include timestamp in import separator', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false, label: 'Role 1' }
      };

      const file = new File(['content'], 'test.css', { type: 'text/css' });

      // Mock FileReader
      const mockReader = {
        onload: null,
        onerror: null,
        readAsText: vi.fn(function() {
          this.onload({ target: { result: 'content' } });
        })
      };
      global.FileReader = vi.fn(function() {
        return mockReader;
      });

      editor.importItem('role1', file);

      // Check that timestamp is included (the Date() call will execute normally)
      expect(editor.editorState.role1.content).toContain('Date:');
      expect(editor.editorState.role1.content).toContain('content');
    });

    it('should append imported content to existing content', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: false, content: 'existing content', isDirty: false, label: 'Role 1' }
      };

      const file = new File(['new content'], 'test.css', { type: 'text/css' });

      // Mock FileReader
      const mockReader = {
        onload: null,
        onerror: null,
        readAsText: vi.fn(function() {
          this.onload({ target: { result: 'new content' } });
        })
      };
      global.FileReader = vi.fn(function() {
        return mockReader;
      });

      editor.importItem('role1', file);

      // Check that both old and new content are present
      expect(editor.editorState.role1.content).toContain('existing content');
      expect(editor.editorState.role1.content).toContain('new content');
    });

    it('should mark item as dirty after import', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false, label: 'Role 1' }
      };
      editor.updateToggleButtons = vi.fn();

      const file = new File(['content'], 'test.css', { type: 'text/css' });

      // Mock FileReader
      const mockReader = {
        onload: null,
        onerror: null,
        readAsText: vi.fn(function() {
          this.onload({ target: { result: 'content' } });
        })
      };
      global.FileReader = vi.fn(function() {
        return mockReader;
      });

      editor.importItem('role1', file);

      expect(editor.editorState.role1.isDirty).toBe(true);
    });

    it('should call saveState after successful import', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.editorState = {
        role1: { active: false, content: '', isDirty: false, label: 'Role 1' }
      };
      editor.updateToggleButtons = vi.fn();

      const file = new File(['content'], 'test.css', { type: 'text/css' });

      // Mock FileReader
      const mockReader = {
        onload: null,
        onerror: null,
        readAsText: vi.fn(function() {
          this.onload({ target: { result: 'content' } });
        })
      };
      global.FileReader = vi.fn(function() {
        return mockReader;
      });

      editor.importItem('role1', file);

      expect(mockContext.Storage.setAppState).toHaveBeenCalled();
    });
  });
});
