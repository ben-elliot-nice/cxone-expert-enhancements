import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseEditor } from '../../../src/base-editor.js';
import { createMockLocalStorage } from '../helpers/test-utils.js';

/**
 * BaseEditor UI State Management Tests
 *
 * Priority 1: Format Operations (formatItem, formatAllActive)
 * Priority 2: Discard Operations (discardAll, performDiscardAll, revertItem, performRevert)
 * Priority 3: Toggle Button Management (buildToggleBar, updateToggleButtons)
 * Priority 4: Mobile UI Handling (mobile dropdown, responsive behavior)
 *
 * Focus: Test the LOGIC of UI state management, not actual DOM rendering
 * - State changes (dirty indicators, button states)
 * - Confirmation flows
 * - Visual indicator management (asterisks, colors)
 * - Business rules (when to show/hide elements)
 */
describe('BaseEditor UI State Management', () => {
  let mockConfig;
  let mockContext;
  let mockEditor;
  let mockButton;
  let mockToggleBar;
  let mockOverlay;

  beforeEach(() => {
    // Setup DOM
    global.localStorage = createMockLocalStorage();

    // Mock toggle bar
    mockToggleBar = {
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      insertBefore: vi.fn(),
      appendChild: vi.fn(),
      firstChild: null
    };

    // Mock overlay for viewport detection
    mockOverlay = {
      offsetWidth: 1200 // Desktop by default
    };

    // Mock button
    mockButton = {
      disabled: false,
      textContent: 'Test Button',
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
        toggle: vi.fn()
      },
      style: {},
      dataset: { itemId: 'role1' },
      innerHTML: '',
      setAttribute: vi.fn(),
      getAttribute: vi.fn(() => 'role1')
    };

    global.document = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getElementById: vi.fn((id) => {
        if (id === 'toggle-bar') return mockToggleBar;
        if (id === 'expert-enhancements-overlay') return mockOverlay;
        if (id === 'discard-btn') return mockButton;
        if (id === 'save-dropdown-menu') return { classList: { remove: vi.fn() } };
        return null;
      }),
      querySelector: vi.fn((selector) => {
        if (selector === '.save-dropdown') return { classList: { remove: vi.fn() } };
        if (selector.includes('data-revert-')) return mockButton;
        if (selector.includes('data-menu-')) return { classList: { remove: vi.fn() } };
        return null;
      }),
      querySelectorAll: vi.fn((selector) => {
        if (selector === '.toggle-btn') return [mockButton];
        return [];
      }),
      createElement: vi.fn((tag) => {
        const el = {
          tagName: tag.toUpperCase(),
          className: '',
          textContent: '',
          value: '',
          appendChild: vi.fn(),
          addEventListener: vi.fn(),
          setAttribute: vi.fn(),
          getAttribute: vi.fn(),
          remove: vi.fn(),
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn(() => false)
          },
          style: {},
          dataset: {},
          innerHTML: ''
        };
        if (tag === 'select') {
          el.querySelectorAll = vi.fn(() => []);
        }
        return el;
      })
    };

    // Mock Monaco editor
    mockEditor = {
      getValue: vi.fn(() => 'test content'),
      setValue: vi.fn(),
      onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() })),
      onDidFocusEditorWidget: vi.fn(() => ({ dispose: vi.fn() })),
      onDidBlurEditorWidget: vi.fn(() => ({ dispose: vi.fn() }))
    };

    // Mock context
    mockContext = {
      UI: {
        showToast: vi.fn(),
        showInlineConfirmation: vi.fn((button, callback) => {
          // Simulate user clicking "yes" on confirmation
          callback();
        }),
        showNoChangesMessage: vi.fn()
      },
      Storage: {
        getFormatterSettings: vi.fn(() => ({ formatOnSave: false })),
        setAppState: vi.fn(),
        clearAppState: vi.fn()
      },
      Formatter: {
        isReady: vi.fn(() => true),
        formatCSS: vi.fn((content) => Promise.resolve(content + ' /* formatted */')),
        formatHTML: vi.fn((content) => Promise.resolve(content + ' <!-- formatted -->'))
      },
      Config: {
        get: vi.fn((key) => {
          if (key === 'advanced.breakpoints.desktop') return 768;
          return 5;
        })
      },
      Monaco: {
        get: vi.fn(() => ({})),
        isReady: vi.fn(() => true)
      },
      DOM: {
        create: vi.fn((tag, attrs = {}, children = []) => {
          const el = document.createElement(tag);
          Object.assign(el, attrs);
          return el;
        })
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
  // PRIORITY 1: FORMAT OPERATIONS
  // ========================================================================

  describe('Format Operations', () => {
    describe('formatItem()', () => {
      it('should format single item content using configured formatter method', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // Setup state
        editor.editorState.role1 = {
          active: true,
          content: 'body { color: red; }',
          isDirty: false,
          label: 'Role 1'
        };
        editor.originalContent.role1 = 'body { color: red; }';
        editor.monacoEditors.role1 = mockEditor;
        mockEditor.getValue.mockReturnValue('body { color: red; }');

        // Format
        const result = await editor.formatItem('role1');

        // Should use configured formatter method
        expect(mockContext.Formatter.formatCSS).toHaveBeenCalledWith('body { color: red; }');

        // Should update editor with formatted content
        expect(mockEditor.setValue).toHaveBeenCalledWith('body { color: red; } /* formatted */');

        // Should mark as dirty since content changed
        expect(editor.editorState.role1.isDirty).toBe(true);

        // Should return result object
        expect(result).toEqual({
          changed: true,
          label: 'Role 1'
        });

        // Should show success toast
        expect(mockContext.UI.showToast).toHaveBeenCalledWith('Role 1 formatted', 'success');
      });

      it('should return changed: false if content already formatted', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // Setup state
        editor.editorState.role1 = {
          active: true,
          content: 'body { color: red; }',
          isDirty: false,
          label: 'Role 1'
        };
        editor.originalContent.role1 = 'body { color: red; }';
        editor.monacoEditors.role1 = mockEditor;
        mockEditor.getValue.mockReturnValue('body { color: red; }');

        // Formatter returns same content (already formatted)
        mockContext.Formatter.formatCSS.mockResolvedValue('body { color: red; }');

        // Format
        const result = await editor.formatItem('role1');

        // Should return changed: false
        expect(result).toEqual({
          changed: false,
          label: 'Role 1'
        });

        // Should show "already formatted" message
        expect(mockContext.UI.showToast).toHaveBeenCalledWith('Role 1 already formatted', 'success');
      });

      it('should support silent mode (suppress success toast)', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // Setup state
        editor.editorState.role1 = {
          active: true,
          content: 'test',
          isDirty: false,
          label: 'Role 1'
        };
        editor.originalContent.role1 = 'test';
        editor.monacoEditors.role1 = mockEditor;
        mockEditor.getValue.mockReturnValue('test');

        // Format in silent mode
        await editor.formatItem('role1', true);

        // Should NOT show toast
        expect(mockContext.UI.showToast).not.toHaveBeenCalled();
      });

      it('should warn if formatter not ready', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        mockContext.Formatter.isReady.mockReturnValue(false);

        // Setup state
        editor.editorState.role1 = {
          active: true,
          content: 'test',
          isDirty: false,
          label: 'Role 1'
        };
        editor.monacoEditors.role1 = mockEditor;

        // Format should fail
        const result = await editor.formatItem('role1');

        expect(result).toBeNull();
        expect(mockContext.UI.showToast).toHaveBeenCalledWith(
          'Code formatting is currently unavailable',
          'warning'
        );
      });

      it('should warn if content is empty', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // Setup state
        editor.editorState.role1 = {
          active: true,
          content: '',
          isDirty: false,
          label: 'Role 1'
        };
        editor.monacoEditors.role1 = mockEditor;
        mockEditor.getValue.mockReturnValue('   '); // Empty/whitespace only

        // Format should fail
        const result = await editor.formatItem('role1');

        expect(result).toBeNull();
        expect(mockContext.UI.showToast).toHaveBeenCalledWith('Nothing to format', 'warning');
      });

      it('should handle format errors gracefully', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // Setup state
        editor.editorState.role1 = {
          active: true,
          content: 'test',
          isDirty: false,
          label: 'Role 1'
        };
        editor.monacoEditors.role1 = mockEditor;
        mockEditor.getValue.mockReturnValue('test');

        // Formatter throws error
        mockContext.Formatter.formatCSS.mockRejectedValue(new Error('Syntax error'));

        // Format should handle error
        const result = await editor.formatItem('role1');

        expect(result).toBeNull();
        expect(mockContext.UI.showToast).toHaveBeenCalledWith(
          'Formatting failed: Syntax error',
          'error'
        );
      });

      it('should return null if item or editor not found', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // No editor state
        const result = await editor.formatItem('nonexistent');

        expect(result).toBeNull();
        expect(mockContext.UI.showToast).not.toHaveBeenCalled();
      });
    });

    describe('formatAllActive()', () => {
      it('should format all active editors', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // Setup multiple active editors
        editor.editorState.role1 = {
          active: true,
          content: 'test1',
          isDirty: false,
          label: 'Role 1'
        };
        editor.editorState.role2 = {
          active: true,
          content: 'test2',
          isDirty: false,
          label: 'Role 2'
        };
        editor.originalContent.role1 = 'test1';
        editor.originalContent.role2 = 'test2';
        editor.monacoEditors.role1 = mockEditor;
        editor.monacoEditors.role2 = { ...mockEditor };

        mockEditor.getValue.mockReturnValueOnce('test1').mockReturnValueOnce('test2');

        // Format all
        await editor.formatAllActive();

        // Should format both
        expect(mockContext.Formatter.formatCSS).toHaveBeenCalledTimes(2);

        // Should show summary toast
        expect(mockContext.UI.showToast).toHaveBeenCalledWith('2 editors formatted', 'success');
      });

      it('should show single editor name if only one formatted', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // Setup single active editor
        editor.editorState.role1 = {
          active: true,
          content: 'test1',
          isDirty: false,
          label: 'Role 1'
        };
        editor.editorState.role2 = {
          active: false,
          content: 'test2',
          isDirty: false,
          label: 'Role 2'
        };
        editor.originalContent.role1 = 'test1';
        editor.monacoEditors.role1 = mockEditor;
        mockEditor.getValue.mockReturnValue('test1');

        // Format all (only 1 active)
        await editor.formatAllActive();

        // Should show specific editor name
        expect(mockContext.UI.showToast).toHaveBeenCalledWith('Role 1 formatted', 'success');
      });

      it('should show "already formatted" if no changes made', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // Setup state
        editor.editorState.role1 = {
          active: true,
          content: 'test',
          isDirty: false,
          label: 'Role 1'
        };
        editor.originalContent.role1 = 'test';
        editor.monacoEditors.role1 = mockEditor;
        mockEditor.getValue.mockReturnValue('test');

        // Formatter returns same content
        mockContext.Formatter.formatCSS.mockResolvedValue('test');

        // Format all
        await editor.formatAllActive();

        expect(mockContext.UI.showToast).toHaveBeenCalledWith('Role 1 already formatted', 'success');
      });

      it('should warn if formatter not ready', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        mockContext.Formatter.isReady.mockReturnValue(false);

        editor.editorState.role1 = { active: true };

        await editor.formatAllActive();

        expect(mockContext.UI.showToast).toHaveBeenCalledWith(
          'Code formatting is currently unavailable',
          'warning'
        );
      });

      it('should warn if no editors open', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // No active editors
        editor.editorState.role1 = { active: false };
        editor.editorState.role2 = { active: false };

        await editor.formatAllActive();

        expect(mockContext.UI.showToast).toHaveBeenCalledWith('No editors open to format', 'warning');
      });

      it('should handle format errors gracefully', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          active: true,
          content: 'test',
          isDirty: false,
          label: 'Role 1'
        };
        editor.monacoEditors.role1 = mockEditor;
        mockEditor.getValue.mockReturnValue('test');

        // Formatter throws error
        mockContext.Formatter.formatCSS.mockRejectedValue(new Error('Parse error'));

        await editor.formatAllActive();

        expect(mockContext.UI.showToast).toHaveBeenCalledWith('Formatting failed: Parse error', 'error');
      });
    });
  });

  // ========================================================================
  // PRIORITY 2: DISCARD OPERATIONS
  // ========================================================================

  describe('Discard Operations', () => {
    describe('discardAll()', () => {
      it('should show inline confirmation if there are unsaved changes', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // Setup dirty state
        editor.editorState.role1 = { isDirty: true };
        editor.originalContent.role1 = 'original';

        const discardBtn = document.getElementById('discard-btn');

        // Call discardAll
        editor.discardAll();

        // Should show inline confirmation
        expect(mockContext.UI.showInlineConfirmation).toHaveBeenCalledWith(
          discardBtn,
          expect.any(Function)
        );
      });

      it('should show "no changes" message if no unsaved changes', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // Setup clean state
        editor.editorState.role1 = { isDirty: false };
        editor.originalContent.role1 = 'original';

        const discardBtn = document.getElementById('discard-btn');

        // Call discardAll
        editor.discardAll();

        // Should show no changes message
        expect(mockContext.UI.showNoChangesMessage).toHaveBeenCalledWith(discardBtn);
      });

      it('should warn if no original content to revert to', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // No original content
        editor.originalContent = {};

        editor.discardAll();

        expect(mockContext.UI.showToast).toHaveBeenCalledWith(
          'No original content to revert to',
          'warning'
        );
      });

      it('should not show confirmation if button already confirming', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = { isDirty: true };
        editor.originalContent.role1 = 'original';

        const discardBtn = document.getElementById('discard-btn');
        discardBtn.classList.contains = vi.fn(() => true); // Already confirming

        editor.discardAll();

        // Should not call showInlineConfirmation again
        expect(mockContext.UI.showInlineConfirmation).not.toHaveBeenCalled();
      });
    });

    describe('performDiscardAll()', () => {
      it('should revert all editors to original content', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        // Setup dirty state with editors
        editor.editorState.role1 = {
          content: 'modified1',
          isDirty: true
        };
        editor.editorState.role2 = {
          content: 'modified2',
          isDirty: true
        };
        editor.originalContent.role1 = 'original1';
        editor.originalContent.role2 = 'original2';
        editor.monacoEditors.role1 = mockEditor;
        editor.monacoEditors.role2 = { ...mockEditor };

        // Perform discard
        editor.performDiscardAll();

        // Should revert all content
        expect(editor.editorState.role1.content).toBe('original1');
        expect(editor.editorState.role2.content).toBe('original2');

        // Should clear dirty flags
        expect(editor.editorState.role1.isDirty).toBe(false);
        expect(editor.editorState.role2.isDirty).toBe(false);

        // Should update editor values
        expect(mockEditor.setValue).toHaveBeenCalledWith('original1');
        expect(mockEditor.setValue).toHaveBeenCalledWith('original2');
      });

      it('should close dropdown menu after discarding', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = { isDirty: false };
        editor.originalContent.role1 = 'original';

        const dropdownMenu = { classList: { remove: vi.fn() } };
        const dropdown = { classList: { remove: vi.fn() } };

        global.document.getElementById = vi.fn((id) => {
          if (id === 'save-dropdown-menu') return dropdownMenu;
          return null;
        });

        global.document.querySelector = vi.fn((selector) => {
          if (selector === '.save-dropdown') return dropdown;
          return null;
        });

        editor.performDiscardAll();

        // Should close dropdown
        expect(dropdownMenu.classList.remove).toHaveBeenCalledWith('show');
        expect(dropdown.classList.remove).toHaveBeenCalledWith('open');
      });

      it('should clear app state if all editors clean', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.id = 'css-editor';

        editor.editorState.role1 = { isDirty: true };
        editor.editorState.role2 = { isDirty: true };
        editor.originalContent.role1 = 'original1';
        editor.originalContent.role2 = 'original2';

        editor.performDiscardAll();

        // All clean, should clear state
        expect(mockContext.Storage.clearAppState).toHaveBeenCalledWith('css-editor');
      });

      it('should show success toast', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = { isDirty: false };
        editor.originalContent.role1 = 'original';

        editor.performDiscardAll();

        expect(mockContext.UI.showToast).toHaveBeenCalledWith('All changes discarded', 'success');
      });
    });

    describe('revertItem()', () => {
      it('should show inline confirmation if item has unsaved changes', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          isDirty: true,
          content: 'modified'
        };
        editor.originalContent.role1 = 'original';

        const revertBtn = document.querySelector('[data-revert-role="role1"]');

        editor.revertItem('role1');

        expect(mockContext.UI.showInlineConfirmation).toHaveBeenCalledWith(
          revertBtn,
          expect.any(Function)
        );
      });

      it('should show "no changes" message if item is clean', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          isDirty: false,
          content: 'original'
        };
        editor.originalContent.role1 = 'original';

        const revertBtn = document.querySelector('[data-revert-role="role1"]');

        editor.revertItem('role1');

        expect(mockContext.UI.showNoChangesMessage).toHaveBeenCalledWith(revertBtn);
      });

      it('should return early if item not found', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.revertItem('nonexistent');

        expect(mockContext.UI.showInlineConfirmation).not.toHaveBeenCalled();
      });

      it('should not show confirmation if button already confirming', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = { isDirty: true };
        editor.originalContent.role1 = 'original';

        const revertBtn = document.querySelector('[data-revert-role="role1"]');
        revertBtn.classList.contains = vi.fn(() => true); // Already confirming

        editor.revertItem('role1');

        expect(mockContext.UI.showInlineConfirmation).not.toHaveBeenCalled();
      });
    });

    describe('performRevert()', () => {
      it('should revert single item to original content', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          content: 'modified',
          isDirty: true,
          label: 'Role 1'
        };
        editor.originalContent.role1 = 'original';
        editor.monacoEditors.role1 = mockEditor;

        editor.performRevert('role1');

        // Should revert content
        expect(editor.editorState.role1.content).toBe('original');
        expect(editor.editorState.role1.isDirty).toBe(false);

        // Should update editor
        expect(mockEditor.setValue).toHaveBeenCalledWith('original');

        // Should show success toast
        expect(mockContext.UI.showToast).toHaveBeenCalledWith('Role 1 reverted', 'success');
      });

      it('should handle empty original content', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          content: 'modified',
          isDirty: true,
          label: 'Role 1'
        };
        editor.originalContent.role1 = undefined; // No original
        editor.monacoEditors.role1 = mockEditor;

        editor.performRevert('role1');

        // Should revert to empty string
        expect(editor.editorState.role1.content).toBe('');
        expect(mockEditor.setValue).toHaveBeenCalledWith('');
      });

      it('should close dropdown menu after reverting', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          content: 'modified',
          isDirty: false,
          label: 'Role 1'
        };
        editor.originalContent.role1 = 'original';

        const menu = { classList: { remove: vi.fn() } };
        global.document.querySelector = vi.fn((selector) => {
          if (selector === '[data-menu-role="role1"]') return menu;
          return null;
        });

        editor.performRevert('role1');

        expect(menu.classList.remove).toHaveBeenCalledWith('show');
      });

      it('should clear app state if all editors clean', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.id = 'css-editor';

        editor.editorState.role1 = { isDirty: true, label: 'Role 1' };
        editor.editorState.role2 = { isDirty: false, label: 'Role 2' };
        editor.originalContent.role1 = 'original';

        editor.performRevert('role1');

        // All clean now
        expect(mockContext.Storage.clearAppState).toHaveBeenCalledWith('css-editor');
      });

      it('should save state if some editors still dirty', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = { isDirty: true, label: 'Role 1' };
        editor.editorState.role2 = { isDirty: true, label: 'Role 2' };
        editor.originalContent.role1 = 'original';

        editor.performRevert('role1');

        // role2 still dirty, should save state
        expect(mockContext.Storage.setAppState).toHaveBeenCalled();
      });
    });
  });

  // ========================================================================
  // PRIORITY 3: TOGGLE BUTTON MANAGEMENT
  // ========================================================================

  describe('Toggle Button Management', () => {
    describe('updateToggleButtons()', () => {
      it('should add active class to buttons for active editors', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          active: true,
          isDirty: false
        };

        const button = {
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {},
          getAttribute: vi.fn(() => 'role1')
        };

        global.document.querySelectorAll = vi.fn((selector) => {
          if (selector === '.toggle-btn') return [button];
          return [];
        });

        editor.updateToggleButtons();

        expect(button.classList.add).toHaveBeenCalledWith('active');
      });

      it('should remove active class from buttons for inactive editors', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          active: false,
          isDirty: false
        };

        const button = {
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {},
          getAttribute: vi.fn(() => 'role1')
        };

        global.document.querySelectorAll = vi.fn((selector) => {
          if (selector === '.toggle-btn') return [button];
          return [];
        });

        editor.updateToggleButtons();

        expect(button.classList.remove).toHaveBeenCalledWith('active');
      });

      it('should show dirty indicator with bold orange text', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          active: true,
          isDirty: true
        };

        const button = {
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {},
          getAttribute: vi.fn(() => 'role1')
        };

        global.document.querySelectorAll = vi.fn((selector) => {
          if (selector === '.toggle-btn') return [button];
          return [];
        });

        editor.updateToggleButtons();

        expect(button.style.fontWeight).toBe('bold');
        expect(button.style.color).toBe('#ff9800');
      });

      it('should clear dirty indicator for clean editors', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          active: true,
          isDirty: false
        };

        const button = {
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {},
          getAttribute: vi.fn(() => 'role1')
        };

        global.document.querySelectorAll = vi.fn((selector) => {
          if (selector === '.toggle-btn') return [button];
          return [];
        });

        editor.updateToggleButtons();

        expect(button.style.fontWeight).toBe('');
        expect(button.style.color).toBe('');
      });

      it('should update mobile dropdown with status icons', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          active: true,
          isDirty: true,
          label: 'Role 1'
        };
        editor.editorState.role2 = {
          active: false,
          isDirty: false,
          label: 'Role 2'
        };

        const option1 = {
          textContent: '',
          getAttribute: vi.fn(() => 'role1')
        };
        const option2 = {
          textContent: '',
          getAttribute: vi.fn(() => 'role2')
        };

        const mobileSelect = {
          querySelectorAll: vi.fn(() => [option1, option2]),
          value: ''
        };

        global.document.getElementById = vi.fn((id) => {
          if (id === 'mobile-editor-select') return mobileSelect;
          return null;
        });

        editor.updateToggleButtons();

        // Should add dirty indicator (●) to dirty item
        expect(option1.textContent).toBe('● Role 1');

        // Should add clean indicator (✓) to clean item
        expect(option2.textContent).toBe('✓ Role 2');

        // Should set selected value to active item
        expect(mobileSelect.value).toBe('role1');
      });

      it('should update editor pane status indicators', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        editor.editorState.role1 = {
          isDirty: true
        };
        editor.editorState.role2 = {
          isDirty: false
        };

        const status1 = { textContent: '', style: {} };
        const status2 = { textContent: '', style: {} };

        global.document.getElementById = vi.fn((id) => {
          if (id === 'status-role1') return status1;
          if (id === 'status-role2') return status2;
          return null;
        });

        editor.updateToggleButtons();

        // Dirty status
        expect(status1.textContent).toBe('●');
        expect(status1.style.color).toBe('#ff9800');

        // Clean status
        expect(status2.textContent).toBe('✓');
        expect(status2.style.color).toBe('#4caf50');
      });
    });

    describe('buildToggleBar()', () => {
      it('should create desktop toggle buttons', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.isMobileView = false;

        // Setup mock elements
        const buttons = [];
        mockToggleBar.querySelectorAll = vi.fn(() => []);
        mockToggleBar.querySelector = vi.fn(() => ({ /* save dropdown */ }));

        global.document.createElement = vi.fn((tag) => {
          const button = {
            tagName: tag.toUpperCase(),
            className: '',
            textContent: '',
            setAttribute: vi.fn(),
            addEventListener: vi.fn(),
            dataset: {}
          };
          buttons.push(button);
          return button;
        });

        editor.editorState.role1 = { active: true, isDirty: false };
        editor.editorState.role2 = { active: false, isDirty: false };

        editor.buildToggleBar();

        // Should create button for each item
        expect(buttons.length).toBeGreaterThan(0);

        // Should add event listeners
        const btnWithListener = buttons.find(b => b.addEventListener.mock.calls.length > 0);
        expect(btnWithListener).toBeDefined();
      });

      it('should create mobile dropdown selector', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.isMobileView = true;

        const wrapper = { appendChild: vi.fn() };
        const label = {};
        const select = {
          appendChild: vi.fn(),
          addEventListener: vi.fn(),
          value: ''
        };

        let elementCount = 0;
        global.document.createElement = vi.fn((tag) => {
          elementCount++;
          if (tag === 'div') return wrapper;
          if (tag === 'label') return label;
          if (tag === 'select') return select;
          if (tag === 'option') {
            return {
              setAttribute: vi.fn(),
              textContent: '',
              value: ''
            };
          }
          return {};
        });

        editor.editorState.role1 = { active: true, isDirty: false, label: 'Role 1' };
        editor.editorState.role2 = { active: false, isDirty: false, label: 'Role 2' };

        editor.buildToggleBar();

        // Should create wrapper, label, select
        expect(wrapper.appendChild).toHaveBeenCalled();
        expect(select.addEventListener).toHaveBeenCalled();
      });

      it('should activate first editor if none active in mobile view', async () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.isMobileView = true;
        editor.updateGrid = vi.fn();
        editor.saveState = vi.fn();

        const select = {
          appendChild: vi.fn(),
          addEventListener: vi.fn(),
          value: ''
        };

        global.document.createElement = vi.fn((tag) => {
          if (tag === 'select') return select;
          if (tag === 'option') {
            return { setAttribute: vi.fn(), textContent: '', value: '' };
          }
          return { appendChild: vi.fn() };
        });

        // No active editors
        editor.editorState.role1 = { active: false, isDirty: false, label: 'Role 1' };
        editor.editorState.role2 = { active: false, isDirty: false, label: 'Role 2' };

        editor.buildToggleBar();

        // Should activate first editor after timeout
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(editor.editorState.role1.active).toBe(true);
        expect(editor.updateGrid).toHaveBeenCalled();
        expect(editor.saveState).toHaveBeenCalled();
      });

      it('should remove existing buttons before rebuilding', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;

        const existingBtn = { remove: vi.fn() };
        mockToggleBar.querySelectorAll = vi.fn(() => [existingBtn]);

        editor.editorState.role1 = { active: true, isDirty: false };

        editor.buildToggleBar();

        expect(existingBtn.remove).toHaveBeenCalled();
      });
    });
  });

  // ========================================================================
  // PRIORITY 4: MOBILE UI HANDLING
  // ========================================================================

  describe('Mobile UI Handling', () => {
    describe('checkViewportWidth()', () => {
      it('should detect mobile view when width below breakpoint', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.buildToggleBar = vi.fn();
        editor.updateToggleButtons = vi.fn();

        // Set overlay width to mobile
        mockOverlay.offsetWidth = 500; // < 768

        const isMobile = editor.checkViewportWidth();

        expect(isMobile).toBe(true);
        expect(editor.isMobileView).toBe(true);
      });

      it('should detect desktop view when width above breakpoint', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.buildToggleBar = vi.fn();
        editor.updateToggleButtons = vi.fn();

        // Set overlay width to desktop
        mockOverlay.offsetWidth = 1200; // > 768

        const isMobile = editor.checkViewportWidth();

        expect(isMobile).toBe(false);
        expect(editor.isMobileView).toBe(false);
      });

      it('should rebuild toggle bar when view mode changes', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.buildToggleBar = vi.fn();
        editor.updateToggleButtons = vi.fn();
        editor.isMobileView = false;

        // Switch to mobile
        mockOverlay.offsetWidth = 500;

        editor.checkViewportWidth();

        expect(editor.buildToggleBar).toHaveBeenCalled();
        expect(editor.updateToggleButtons).toHaveBeenCalled();
      });

      it('should not rebuild if view mode unchanged', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.buildToggleBar = vi.fn();
        editor.updateToggleButtons = vi.fn();
        editor.isMobileView = false;

        // Stay desktop
        mockOverlay.offsetWidth = 1200;

        editor.checkViewportWidth();

        expect(editor.buildToggleBar).not.toHaveBeenCalled();
      });

      it('should deactivate extra editors when switching to mobile', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.buildToggleBar = vi.fn();
        editor.updateToggleButtons = vi.fn();
        editor.updateGrid = vi.fn();
        editor.saveState = vi.fn();
        editor.isMobileView = false;

        // Multiple active editors
        editor.editorState.role1 = { active: true };
        editor.editorState.role2 = { active: true };

        // Switch to mobile
        mockOverlay.offsetWidth = 500;

        editor.checkViewportWidth();

        // Should keep first, deactivate second
        expect(editor.editorState.role1.active).toBe(true);
        expect(editor.editorState.role2.active).toBe(false);
        expect(editor.updateGrid).toHaveBeenCalled();
      });
    });

    describe('handleMobileEditorChange()', () => {
      it('should switch active editor in mobile view', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.updateGrid = vi.fn();
        editor.saveState = vi.fn();
        editor.updateToggleButtons = vi.fn();

        editor.editorState.role1 = { active: true };
        editor.editorState.role2 = { active: false };

        editor.handleMobileEditorChange('role2');

        // Should switch
        expect(editor.editorState.role1.active).toBe(false);
        expect(editor.editorState.role2.active).toBe(true);
        expect(editor.updateGrid).toHaveBeenCalled();
        expect(editor.saveState).toHaveBeenCalled();
      });

      it('should do nothing if selecting same editor', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.updateGrid = vi.fn();

        editor.editorState.role1 = { active: true };

        editor.handleMobileEditorChange('role1');

        // Should not call updateGrid
        expect(editor.updateGrid).not.toHaveBeenCalled();
      });

      it('should deactivate all other editors', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.updateGrid = vi.fn();
        editor.saveState = vi.fn();

        editor.editorState.role1 = { active: true };
        editor.editorState.role2 = { active: false };

        const mockConfig2 = {
          ...mockConfig,
          itemsConfig: [
            { id: 'role1', label: 'Role 1' },
            { id: 'role2', label: 'Role 2' },
            { id: 'role3', label: 'Role 3' }
          ]
        };

        editor.config = mockConfig2;
        editor.editorState.role3 = { active: false };

        editor.handleMobileEditorChange('role3');

        expect(editor.editorState.role1.active).toBe(false);
        expect(editor.editorState.role2.active).toBe(false);
        expect(editor.editorState.role3.active).toBe(true);
      });

      it('should update mobile select options after change', () => {
        const editor = new BaseEditor(mockConfig);
        editor.context = mockContext;
        editor.updateGrid = vi.fn();
        editor.saveState = vi.fn();
        editor.updateToggleButtons = vi.fn();

        const mobileSelect = {
          querySelectorAll: vi.fn(() => [])
        };

        global.document.getElementById = vi.fn((id) => {
          if (id === 'mobile-editor-select') return mobileSelect;
          return null;
        });

        editor.editorState.role1 = { active: true };
        editor.editorState.role2 = { active: false };

        editor.handleMobileEditorChange('role2');

        expect(editor.updateToggleButtons).toHaveBeenCalled();
      });
    });
  });
});
