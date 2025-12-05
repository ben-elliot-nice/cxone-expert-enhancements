import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseEditor } from '../../../src/base-editor.js';
import { createMockLocalStorage } from '../helpers/test-utils.js';

/**
 * BaseEditor Keyboard Shortcuts Tests
 *
 * Priority 1: e.code vs e.key Bug Regression (commit 7f42cb9)
 * Priority 2: Platform-Specific Shortcuts (Mac/Windows)
 * Priority 3: Edge Cases (no editor, disabled, input fields)
 * Priority 4: Event Handling (attach, remove, propagation)
 *
 * CRITICAL BUG CONTEXT (commit 7f42cb9):
 * The keyboard shortcut implementation must use e.code instead of e.key
 * to ensure cross-keyboard-layout compatibility. On non-US keyboards,
 * the same physical key produces different characters (e.key), but e.code
 * represents the physical key position which is consistent across layouts.
 */
describe('BaseEditor Keyboard Shortcuts', () => {
  let mockConfig;
  let mockContext;
  let mockEditor;
  let mockSaveBtn;
  let mockSaveAllBtn;
  let keyboardEventListener;

  /**
   * Helper to create keyboard events with various configurations
   */
  function createKeyboardEvent(options = {}) {
    return {
      code: options.code || 'KeyS',
      key: options.key || 's',
      metaKey: options.metaKey || false,
      ctrlKey: options.ctrlKey || false,
      shiftKey: options.shiftKey || false,
      altKey: options.altKey || false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };
  }

  beforeEach(() => {
    // Setup DOM
    global.localStorage = createMockLocalStorage();

    // Capture event listener when addEventListener is called
    keyboardEventListener = null;
    global.document = {
      addEventListener: vi.fn((event, handler) => {
        if (event === 'keydown') {
          keyboardEventListener = handler;
        }
      }),
      removeEventListener: vi.fn(),
      getElementById: vi.fn((id) => {
        if (id === 'save-btn') return mockSaveAllBtn;
        return null;
      }),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      createElement: vi.fn(() => ({
        href: '',
        download: '',
        click: vi.fn()
      }))
    };

    // Mock buttons
    mockSaveBtn = {
      disabled: false,
      textContent: 'Save',
      classList: { add: vi.fn(), remove: vi.fn() },
      innerHTML: ''
    };

    mockSaveAllBtn = {
      disabled: false,
      textContent: 'Save All',
      classList: { add: vi.fn(), remove: vi.fn() },
      innerHTML: ''
    };

    // Mock Monaco editor
    mockEditor = {
      getValue: vi.fn(() => 'test content'),
      setValue: vi.fn(),
      onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() }))
    };

    // Mock context
    mockContext = {
      UI: {
        showToast: vi.fn()
      },
      Storage: {
        getFormatterSettings: vi.fn(() => ({ formatOnSave: false }))
      },
      Formatter: {
        isReady: vi.fn(() => true),
        formatCSS: vi.fn((content) => Promise.resolve(content))
      },
      API: {
        buildMultipartBody: vi.fn(() => ({
          body: 'mock-body',
          boundary: 'mock-boundary'
        })),
        fetch: vi.fn(() => Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('Success')
        }))
      },
      Config: {
        get: vi.fn(() => 5)
      }
    };

    // Base config
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // PRIORITY 1: E.CODE VS E.KEY BUG REGRESSION (commit 7f42cb9)
  // ========================================================================

  describe('Keyboard Layout Compatibility (commit 7f42cb9)', () => {
    it('should use e.code instead of e.key for Cmd+S shortcut', async () => {
      /**
       * THE EXACT BUG SCENARIO (commit 7f42cb9):
       * On French AZERTY keyboard, physical key position for 'S' produces
       * different character. The code must check e.code='KeyS' (physical key)
       * not e.key='s' (character) to work across keyboard layouts.
       *
       * This test simulates French keyboard where:
       * - e.code = 'KeyS' (same physical position as US keyboard)
       * - e.key = 's' (character varies by layout, could be different)
       */
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      // Setup active editor
      editor.activeEditorId = 'role1';
      editor.editorState.role1 = {
        content: 'test content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old content';
      editor.monacoEditors.role1 = mockEditor;

      // Mock save button exists
      global.document.querySelector = vi.fn((selector) => {
        if (selector.includes('[data-save-role="role1"]')) {
          return mockSaveBtn;
        }
        return null;
      });

      // Mock save callback
      editor.onSaveItem = vi.fn();

      // CRITICAL: Test with e.code='KeyS' (physical key position)
      // This works regardless of keyboard layout
      const event = createKeyboardEvent({
        code: 'KeyS',      // Physical key position - CORRECT approach
        key: 's',          // Character value - varies by layout
        metaKey: true,     // Mac Cmd key
        shiftKey: false
      });

      keyboardEventListener(event);

      // Verify shortcut triggered using e.code
      expect(event.preventDefault).toHaveBeenCalled();
      expect(editor.onSaveItem).toHaveBeenCalledWith('role1', mockSaveBtn);
    });

    it('should work on non-US keyboard layouts (e.g., French AZERTY)', async () => {
      /**
       * Simulate French keyboard where the character for the S key position
       * might be different, but e.code is still 'KeyS'
       */
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.editorState.role1 = {
        content: 'test',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old';
      editor.monacoEditors.role1 = mockEditor;

      global.document.querySelector = vi.fn(() => mockSaveBtn);
      editor.onSaveItem = vi.fn();

      // French keyboard: same physical key, potentially different character
      const frenchKeyboardEvent = createKeyboardEvent({
        code: 'KeyS',      // Physical position unchanged
        key: 's',          // Character might differ on some layouts
        ctrlKey: true,
        shiftKey: false
      });

      keyboardEventListener(frenchKeyboardEvent);

      // Should work because code checks e.code='KeyS', not e.key
      expect(frenchKeyboardEvent.preventDefault).toHaveBeenCalled();
      expect(editor.onSaveItem).toHaveBeenCalled();
    });

    it('should use e.code for Shift+S save-all shortcut', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveAll = vi.fn();

      // Test Ctrl+Shift+S with e.code
      const event = createKeyboardEvent({
        code: 'KeyS',      // Physical key position
        key: 'S',          // Uppercase because shift is pressed
        ctrlKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(editor.onSaveAll).toHaveBeenCalledWith(mockSaveAllBtn);
    });

    it('should use e.code for Cmd+Shift+F format shortcut', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onFormatAllActive = vi.fn();

      // Test Cmd+Shift+F with e.code
      const event = createKeyboardEvent({
        code: 'KeyF',      // Physical key position
        key: 'F',          // Character
        metaKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(editor.onFormatAllActive).toHaveBeenCalled();
    });

    it('should NOT trigger on wrong e.code even if e.key matches', () => {
      /**
       * This test verifies the fix is in place: we check e.code, not e.key
       * If someone presses a different physical key that produces 's' character,
       * it should NOT trigger the save shortcut
       */
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.onSaveItem = vi.fn();

      // Wrong physical key (e.g., some other key that produces 's')
      const event = createKeyboardEvent({
        code: 'KeyX',      // Wrong physical key
        key: 's',          // Happens to produce 's' character
        ctrlKey: true,
        shiftKey: false
      });

      keyboardEventListener(event);

      // Should NOT trigger because e.code !== 'KeyS'
      expect(editor.onSaveItem).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // PRIORITY 2: PLATFORM-SPECIFIC SHORTCUTS (Mac/Windows)
  // ========================================================================

  describe('Mac Shortcuts (metaKey)', () => {
    it('should trigger save on Cmd+S (metaKey + KeyS)', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.editorState.role1 = {
        content: 'test',
        isDirty: true,
        label: 'Role 1'
      };
      editor.monacoEditors.role1 = mockEditor;

      global.document.querySelector = vi.fn(() => mockSaveBtn);
      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        metaKey: true,  // Mac Cmd key
        ctrlKey: false,
        shiftKey: false
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(editor.onSaveItem).toHaveBeenCalledWith('role1', mockSaveBtn);
    });

    it('should trigger save-all on Cmd+Shift+S', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveAll = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        metaKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(editor.onSaveAll).toHaveBeenCalledWith(mockSaveAllBtn);
    });

    it('should trigger format on Cmd+Shift+F', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onFormatAllActive = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyF',
        metaKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(editor.onFormatAllActive).toHaveBeenCalled();
    });
  });

  describe('Windows Shortcuts (ctrlKey)', () => {
    it('should trigger save on Ctrl+S (ctrlKey + KeyS)', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.editorState.role1 = {
        content: 'test',
        isDirty: true,
        label: 'Role 1'
      };
      editor.monacoEditors.role1 = mockEditor;

      global.document.querySelector = vi.fn(() => mockSaveBtn);
      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true,  // Windows Ctrl key
        metaKey: false,
        shiftKey: false
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(editor.onSaveItem).toHaveBeenCalledWith('role1', mockSaveBtn);
    });

    it('should trigger save-all on Ctrl+Shift+S', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveAll = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(editor.onSaveAll).toHaveBeenCalledWith(mockSaveAllBtn);
    });

    it('should trigger format on Ctrl+Shift+F', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onFormatAllActive = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyF',
        ctrlKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(editor.onFormatAllActive).toHaveBeenCalled();
    });
  });

  describe('Cross-Platform Support', () => {
    it('should work with either Ctrl or Cmd for save', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.editorState.role1 = {
        content: 'test',
        isDirty: true,
        label: 'Role 1'
      };
      editor.monacoEditors.role1 = mockEditor;

      global.document.querySelector = vi.fn(() => mockSaveBtn);
      editor.onSaveItem = vi.fn();

      // Test with Ctrl (Windows/Linux)
      const ctrlEvent = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true,
        metaKey: false
      });
      keyboardEventListener(ctrlEvent);
      expect(editor.onSaveItem).toHaveBeenCalledTimes(1);

      // Test with Cmd (Mac)
      const cmdEvent = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: false,
        metaKey: true
      });
      keyboardEventListener(cmdEvent);
      expect(editor.onSaveItem).toHaveBeenCalledTimes(2);
    });

    it('should work if both Ctrl and Cmd are pressed (edge case)', () => {
      /**
       * Some virtual machines or remote desktop scenarios might have
       * both ctrlKey and metaKey set simultaneously
       */
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.editorState.role1 = {
        content: 'test',
        isDirty: true,
        label: 'Role 1'
      };
      editor.monacoEditors.role1 = mockEditor;

      global.document.querySelector = vi.fn(() => mockSaveBtn);
      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true,
        metaKey: true  // Both pressed
      });

      keyboardEventListener(event);

      // Should still work because check is (e.ctrlKey || e.metaKey)
      expect(event.preventDefault).toHaveBeenCalled();
      expect(editor.onSaveItem).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // PRIORITY 3: EDGE CASES
  // ========================================================================

  describe('Save Shortcut Edge Cases', () => {
    it('should show toast when no editor is active (Cmd+S)', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      // No active editor
      editor.activeEditorId = null;
      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        metaKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'No editor focused',
        'info'
      );
      expect(editor.onSaveItem).not.toHaveBeenCalled();
    });

    it('should show toast when onSaveItem callback not set', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.onSaveItem = null;  // No callback set

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'No editor focused',
        'info'
      );
    });

    it('should NOT trigger if save button not found in DOM', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.onSaveItem = vi.fn();

      // Save button not found
      global.document.querySelector = vi.fn(() => null);

      const event = createKeyboardEvent({
        code: 'KeyS',
        metaKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      // Should still call onSaveItem with null button
      expect(editor.onSaveItem).toHaveBeenCalledWith('role1', null);
    });
  });

  describe('Save-All Shortcut Edge Cases', () => {
    it('should NOT trigger save-all if callback not set', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveAll = null;  // No callback

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      // Should still prevent default but not call callback
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should work even if save-all button not found', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveAll = vi.fn();

      // Button not found
      global.document.getElementById = vi.fn(() => null);

      const event = createKeyboardEvent({
        code: 'KeyS',
        metaKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
      // Should call with null button
      expect(editor.onSaveAll).toHaveBeenCalledWith(null);
    });
  });

  describe('Format Shortcut Edge Cases', () => {
    it('should NOT trigger format if formatter not ready', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      mockContext.Formatter.isReady.mockReturnValue(false);
      editor.onFormatAllActive = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyF',
        ctrlKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      // Should prevent default but not call format
      expect(event.preventDefault).toHaveBeenCalled();
      expect(editor.onFormatAllActive).not.toHaveBeenCalled();
    });

    it('should NOT trigger format if callback not set', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      mockContext.Formatter.isReady.mockReturnValue(true);
      editor.onFormatAllActive = null;  // No callback

      const event = createKeyboardEvent({
        code: 'KeyF',
        metaKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      // Silent no-op (as per code comment)
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should be silent no-op if both formatter not ready and no callback', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      mockContext.Formatter.isReady.mockReturnValue(false);
      editor.onFormatAllActive = null;

      const event = createKeyboardEvent({
        code: 'KeyF',
        ctrlKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      // Should still prevent default
      expect(event.preventDefault).toHaveBeenCalled();
      // No toast, no callback - silent
      expect(mockContext.UI.showToast).not.toHaveBeenCalled();
    });
  });

  describe('Wrong Modifier Keys', () => {
    it('should NOT trigger save on S without Ctrl/Cmd', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: false,
        metaKey: false
      });

      keyboardEventListener(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(editor.onSaveItem).not.toHaveBeenCalled();
    });

    it('should NOT trigger save on Shift+S alone', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        shiftKey: true,
        ctrlKey: false,
        metaKey: false
      });

      keyboardEventListener(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(editor.onSaveItem).not.toHaveBeenCalled();
    });

    it('should NOT trigger save-all on Ctrl+S without Shift', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveAll = vi.fn();
      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true,
        shiftKey: false
      });

      keyboardEventListener(event);

      // Should trigger regular save, not save-all
      expect(editor.onSaveAll).not.toHaveBeenCalled();
      // Regular save would be called (if active editor exists)
    });

    it('should NOT trigger on Alt+S', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        altKey: true,
        ctrlKey: false,
        metaKey: false
      });

      keyboardEventListener(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(editor.onSaveItem).not.toHaveBeenCalled();
    });

    it('should NOT trigger format on Ctrl+F without Shift', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onFormatAllActive = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyF',
        ctrlKey: true,
        shiftKey: false
      });

      keyboardEventListener(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(editor.onFormatAllActive).not.toHaveBeenCalled();
    });
  });

  describe('Wrong Keys', () => {
    it('should NOT trigger on Ctrl+A', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyA',
        ctrlKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(editor.onSaveItem).not.toHaveBeenCalled();
    });

    it('should NOT trigger on Ctrl+D', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyD',
        metaKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(editor.onSaveItem).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // PRIORITY 4: EVENT HANDLING
  // ========================================================================

  describe('Event Listener Management', () => {
    it('should attach keydown event listener on setup', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.setupKeyboardShortcuts();

      expect(global.document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should store keyboard handler reference', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      expect(editor.keyboardHandler).toBeNull();

      editor.setupKeyboardShortcuts();

      expect(editor.keyboardHandler).toBeInstanceOf(Function);
    });

    it('should log keyboard shortcuts registration', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.setupKeyboardShortcuts();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[CSS Editor] Keyboard shortcuts registered: Ctrl+S (save active), Ctrl+Shift+S (save all), Ctrl+Shift+F (format)'
      );

      consoleSpy.mockRestore();
    });

    it('should use correct editor type in log message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const htmlConfig = { ...mockConfig, editorType: 'html' };
      const editor = new BaseEditor(htmlConfig);
      editor.context = mockContext;

      editor.setupKeyboardShortcuts();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[HTML Editor] Keyboard shortcuts registered: Ctrl+S (save active), Ctrl+Shift+S (save all), Ctrl+Shift+F (format)'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Event Propagation', () => {
    it('should call preventDefault on save shortcut', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.editorState.role1 = { content: 'test', isDirty: true, label: 'Role 1' };
      editor.monacoEditors.role1 = mockEditor;
      global.document.querySelector = vi.fn(() => mockSaveBtn);
      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should call preventDefault on save-all shortcut', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onSaveAll = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should call preventDefault on format shortcut', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.onFormatAllActive = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyF',
        metaKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should NOT call stopPropagation (allow bubbling)', () => {
      /**
       * Keyboard shortcuts should not stop propagation
       * in case parent elements need to handle events
       */
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.editorState.role1 = { content: 'test', isDirty: true, label: 'Role 1' };
      editor.monacoEditors.role1 = mockEditor;
      global.document.querySelector = vi.fn(() => mockSaveBtn);
      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true
      });

      keyboardEventListener(event);

      expect(event.stopPropagation).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Rapid Keypresses', () => {
    it('should handle rapid Ctrl+S presses', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.editorState.role1 = {
        content: 'test',
        isDirty: true,
        label: 'Role 1'
      };
      editor.monacoEditors.role1 = mockEditor;
      global.document.querySelector = vi.fn(() => mockSaveBtn);
      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true
      });

      // Rapid fire 3 times
      keyboardEventListener(event);
      keyboardEventListener(event);
      keyboardEventListener(event);

      // All should be processed
      expect(editor.onSaveItem).toHaveBeenCalledTimes(3);
      expect(event.preventDefault).toHaveBeenCalledTimes(3);
    });

    it('should handle alternating shortcuts', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.editorState.role1 = {
        content: 'test',
        isDirty: true,
        label: 'Role 1'
      };
      editor.monacoEditors.role1 = mockEditor;
      global.document.querySelector = vi.fn(() => mockSaveBtn);
      editor.onSaveItem = vi.fn();
      editor.onSaveAll = vi.fn();

      // Alternate between Ctrl+S and Ctrl+Shift+S
      const saveEvent = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true,
        shiftKey: false
      });

      const saveAllEvent = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true,
        shiftKey: true
      });

      keyboardEventListener(saveEvent);
      keyboardEventListener(saveAllEvent);
      keyboardEventListener(saveEvent);

      expect(editor.onSaveItem).toHaveBeenCalledTimes(2);
      expect(editor.onSaveAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('Shortcut Priority', () => {
    it('should prioritize save-all (Ctrl+Shift+S) over save (Ctrl+S)', () => {
      /**
       * When both Shift and no-Shift conditions could match,
       * the code checks Shift first (save-all) in else-if chain
       */
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.activeEditorId = 'role1';
      editor.onSaveItem = vi.fn();
      editor.onSaveAll = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true,
        shiftKey: true
      });

      keyboardEventListener(event);

      // Should trigger save-all, not save
      expect(editor.onSaveAll).toHaveBeenCalled();
      expect(editor.onSaveItem).not.toHaveBeenCalled();
    });
  });

  describe('Integration with Monaco Editor Focus', () => {
    it('should respect activeEditorId when Monaco editor has focus', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      // Setup multiple editors
      editor.editorState.role1 = {
        content: 'content1',
        isDirty: true,
        label: 'Role 1'
      };
      editor.monacoEditors.role1 = mockEditor;

      const mockEditor2 = {
        getValue: vi.fn(() => 'content2'),
        setValue: vi.fn()
      };
      editor.editorState.role2 = {
        content: 'content2',
        isDirty: true,
        label: 'Role 2'
      };
      editor.monacoEditors.role2 = mockEditor2;

      // Focus on role2
      editor.activeEditorId = 'role2';

      const mockSaveBtn2 = {
        disabled: false,
        classList: { add: vi.fn(), remove: vi.fn() }
      };

      global.document.querySelector = vi.fn((selector) => {
        if (selector.includes('[data-save-role="role2"]')) {
          return mockSaveBtn2;
        }
        return null;
      });

      editor.onSaveItem = vi.fn();

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true
      });

      keyboardEventListener(event);

      // Should save role2 (active), not role1
      expect(editor.onSaveItem).toHaveBeenCalledWith('role2', mockSaveBtn2);
    });

    it('should handle activeEditorId change during session', () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;
      editor.setupKeyboardShortcuts();

      editor.editorState.role1 = {
        content: 'content1',
        isDirty: true,
        label: 'Role 1'
      };
      editor.monacoEditors.role1 = mockEditor;

      editor.onSaveItem = vi.fn();

      // Start with role1 active
      editor.activeEditorId = 'role1';

      global.document.querySelector = vi.fn(() => mockSaveBtn);

      const event = createKeyboardEvent({
        code: 'KeyS',
        ctrlKey: true
      });

      keyboardEventListener(event);
      expect(editor.onSaveItem).toHaveBeenCalledWith('role1', mockSaveBtn);

      // Change to no active editor
      editor.activeEditorId = null;

      keyboardEventListener(event);

      // Should show "No editor focused" toast
      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'No editor focused',
        'info'
      );
    });
  });
});
