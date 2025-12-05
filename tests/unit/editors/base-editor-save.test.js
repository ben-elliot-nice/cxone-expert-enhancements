import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseEditor } from '../../../src/base-editor.js';
import { createMockLocalStorage, createMockCSRFToken } from '../helpers/test-utils.js';

/**
 * BaseEditor Save Operations Tests
 *
 * Priority 1: Dirty State Bug Regression (commit f870f9f)
 * Priority 2: Save Operations (saveItem, saveAll)
 * Priority 3: Format Integration (formatItemIfNeeded)
 * Priority 4: UI State Management (prepareSaveUI, restoreSaveUI)
 */
describe('BaseEditor Save Operations', () => {
  let mockConfig;
  let mockContext;
  let mockEditor;
  let mockButton;

  beforeEach(() => {
    // Setup DOM
    global.localStorage = createMockLocalStorage();
    global.document = {
      ...global.document,
      getElementById: vi.fn((id) => {
        if (id === 'save-btn') return mockButton;
        return null;
      }),
      querySelectorAll: vi.fn(() => []),
      createElement: vi.fn(() => ({
        href: '',
        download: '',
        click: vi.fn()
      }))
    };

    // Mock button
    mockButton = {
      disabled: false,
      textContent: 'Save',
      classList: {
        add: vi.fn(),
        remove: vi.fn()
      },
      innerHTML: ''
    };

    // Mock Monaco editor
    mockEditor = {
      getValue: vi.fn(() => ''),
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
        formatCSS: vi.fn((content) => Promise.resolve(content)),
        formatHTML: vi.fn((content) => Promise.resolve(content))
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
  // PRIORITY 1: DIRTY STATE BUG REGRESSION (commit f870f9f)
  // ========================================================================

  describe('Dirty State Bug Regression (commit f870f9f)', () => {
    it('should save when content was edited then formatted back to original', async () => {
      /**
       * THE EXACT BUG SCENARIO:
       * 1. Load original content: "<!-- Release -->"
       * 2. User edits to: "<!--Release-->" (removes spaces, isDirty = true)
       * 3. Format operation runs: formats back to "<!-- Release -->" (matches original)
       * 4. BUG: editor.setValue() in formatItemIfNeeded triggers change listener,
       *    recalculating isDirty. Content now matches original, so isDirty = false.
       * 5. Save would abort with "no changes" even though user DID make changes.
       * 6. FIX: hadChanges flag captures dirty state BEFORE formatting
       */
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      // Enable format on save
      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });

      // Setup: Load original content
      const originalContent = '<!-- Release -->';
      editor.editorState.role1 = {
        content: originalContent,
        isDirty: false,
        label: 'Role 1'
      };
      editor.originalContent.role1 = originalContent;
      editor.monacoEditors.role1 = mockEditor;

      // Setup: User edits (removes spaces)
      const editedContent = '<!--Release-->';
      mockEditor.getValue.mockReturnValue(editedContent);
      editor.editorState.role1.isDirty = true;

      // Setup: Formatter will restore spaces (back to original)
      mockContext.Formatter.formatHTML = vi.fn(async (content) => {
        // Simulate formatter restoring spaces
        return '<!-- Release -->';
      });

      // Setup: Build form data hook
      editor.buildFormDataForSave = vi.fn(() => ({
        csrfToken: 'test-token',
        role1: '<!-- Release -->'
      }));

      // Execute: Save
      await editor.saveItem('role1', mockButton);

      // Verify: Save should SUCCEED (hadChanges = true captured before format)
      expect(mockContext.API.fetch).toHaveBeenCalled();
      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'Role 1 saved successfully!',
        'success'
      );

      // Verify: Should NOT show "no changes" warning
      expect(mockContext.UI.showToast).not.toHaveBeenCalledWith(
        expect.stringContaining('no changes'),
        'warning'
      );
    });

    it('should save when isDirty=false but content differs from original (edge case)', async () => {
      /**
       * Edge case: isDirty might be false but content actually differs
       * The hadChanges check uses: item.isDirty || item.content !== originalContent
       */
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'modified content',
        isDirty: false,  // Somehow false (edge case)
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'original content';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('modified content');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));

      await editor.saveItem('role1', mockButton);

      // Should save because content !== originalContent
      expect(mockContext.API.fetch).toHaveBeenCalled();
      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'Role 1 saved successfully!',
        'success'
      );
    });

    it('should NOT save when content matches original and isDirty=false', async () => {
      /**
       * Normal case: No changes, should skip save
       */
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      const content = 'unchanged content';
      editor.editorState.role1 = {
        content: content,
        isDirty: false,
        label: 'Role 1'
      };
      editor.originalContent.role1 = content;
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue(content);

      editor.buildFormDataForSave = vi.fn();

      await editor.saveItem('role1', mockButton);

      // Should NOT save
      expect(mockContext.API.fetch).not.toHaveBeenCalled();
      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'Role 1 has no changes to save',
        'warning'
      );
    });

    it('saveAll should save when items were edited then formatted back', async () => {
      /**
       * Same bug scenario but for saveAll operation
       */
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });

      // Setup: role1 edited then will be formatted back to original
      editor.editorState.role1 = {
        content: '<!--Role1-->',  // Edited (spaces removed)
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = '<!-- Role 1 -->';  // Original
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('<!--Role1-->');

      // Setup: role2 unchanged
      const mockEditor2 = { getValue: vi.fn(() => 'role2 content') };
      editor.editorState.role2 = {
        content: 'role2 content',
        isDirty: false,
        label: 'Role 2'
      };
      editor.originalContent.role2 = 'role2 content';
      editor.monacoEditors.role2 = mockEditor2;

      // Formatter will restore spaces
      mockContext.Formatter.formatCSS = vi.fn(async (content) => {
        if (content.includes('Role1')) {
          return '<!-- Role 1 -->';  // Formatted back to original
        }
        return content;
      });

      editor.buildFormDataForSaveAll = vi.fn(() => ({ csrfToken: 'test-token' }));

      await editor.saveAll(mockButton);

      // Should save because role1 had changes before format
      expect(mockContext.API.fetch).toHaveBeenCalled();
      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'All saved successfully!',
        'success'
      );
    });

    it('saveAll should NOT save when all items match original', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      // All items unchanged
      editor.editorState.role1 = {
        content: 'content1',
        isDirty: false,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'content1';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content1');

      const mockEditor2 = { getValue: vi.fn(() => 'content2') };
      editor.editorState.role2 = {
        content: 'content2',
        isDirty: false,
        label: 'Role 2'
      };
      editor.originalContent.role2 = 'content2';
      editor.monacoEditors.role2 = mockEditor2;

      await editor.saveAll(mockButton);

      expect(mockContext.API.fetch).not.toHaveBeenCalled();
      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'No changes to save',
        'warning'
      );
    });
  });

  // ========================================================================
  // PRIORITY 2: SAVE OPERATIONS
  // ========================================================================

  describe('saveItem()', () => {
    it('should save single item successfully', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'modified content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'original content';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('modified content');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));

      await editor.saveItem('role1', mockButton);

      expect(mockContext.API.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: 'mock-body',
          credentials: 'include'
        })
      );

      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'Role 1 saved successfully!',
        'success'
      );
    });

    it('should sync editor value to state before save', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'old content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'original';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('new content from editor');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));

      await editor.saveItem('role1', mockButton);

      // State should be updated with editor value
      expect(editor.editorState.role1.content).toBe('new content from editor');
      expect(mockContext.API.fetch).toHaveBeenCalled();
    });

    it('should update originalContent after successful save', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'new content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old content';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('new content');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));

      await editor.saveItem('role1', mockButton);

      // originalContent should be updated to saved content
      expect(editor.originalContent.role1).toBe('new content');
    });

    it('should mark item as clean if content unchanged during save', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));
      editor.updateToggleButtons = vi.fn();
      editor.saveState = vi.fn();

      await editor.saveItem('role1', mockButton);

      // Should be marked clean
      expect(editor.editorState.role1.isDirty).toBe(false);
    });

    it('should keep item dirty if content changed during save (concurrent edit)', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'initial content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old';
      editor.monacoEditors.role1 = mockEditor;

      // First call: initial content
      // Second call: changed during save
      mockEditor.getValue
        .mockReturnValueOnce('initial content')
        .mockReturnValueOnce('changed during save');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));
      editor.updateToggleButtons = vi.fn();
      editor.saveState = vi.fn();

      await editor.saveItem('role1', mockButton);

      // Should remain dirty
      expect(editor.editorState.role1.isDirty).toBe(true);
    });

    it('should throw error if item not found', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      await editor.saveItem('nonexistent', mockButton);

      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save'),
        'error'
      );
    });

    it('should throw error if buildFormDataForSave not implemented', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content');

      // Don't set buildFormDataForSave hook

      await editor.saveItem('role1', mockButton);

      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        expect.stringContaining('buildFormDataForSave hook not implemented'),
        'error'
      );
    });

    it('should handle HTTP error response', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));

      // Mock failed response
      mockContext.API.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await editor.saveItem('role1', mockButton);

      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save'),
        'error'
      );
    });

    it('should handle network error', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));

      // Mock network error
      mockContext.API.fetch.mockRejectedValue(new Error('Network error'));

      await editor.saveItem('role1', mockButton);

      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Network error'),
        'error'
      );
    });

    it('should accept successful redirect response', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));
      editor.updateToggleButtons = vi.fn();
      editor.saveState = vi.fn();

      // Mock redirect response
      mockContext.API.fetch.mockResolvedValue({
        ok: false,
        redirected: true,
        status: 302
      });

      await editor.saveItem('role1', mockButton);

      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'Role 1 saved successfully!',
        'success'
      );
    });
  });

  describe('saveAll()', () => {
    it('should save all items successfully', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content1',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old1';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content1');

      const mockEditor2 = { getValue: vi.fn(() => 'content2') };
      editor.editorState.role2 = {
        content: 'content2',
        isDirty: true,
        label: 'Role 2'
      };
      editor.originalContent.role2 = 'old2';
      editor.monacoEditors.role2 = mockEditor2;

      editor.buildFormDataForSaveAll = vi.fn(() => ({ csrfToken: 'test-token' }));

      await editor.saveAll(mockButton);

      expect(mockContext.API.fetch).toHaveBeenCalled();
      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'All saved successfully!',
        'success'
      );
    });

    it('should sync all editor values to state before save', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'old1',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'original1';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('new1');

      const mockEditor2 = { getValue: vi.fn(() => 'new2') };
      editor.editorState.role2 = {
        content: 'old2',
        isDirty: true,
        label: 'Role 2'
      };
      editor.originalContent.role2 = 'original2';
      editor.monacoEditors.role2 = mockEditor2;

      editor.buildFormDataForSaveAll = vi.fn(() => ({ csrfToken: 'test-token' }));

      await editor.saveAll(mockButton);

      // All states should be synced
      expect(editor.editorState.role1.content).toBe('new1');
      expect(editor.editorState.role2.content).toBe('new2');
    });

    it('should update all originalContent after successful save', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'new1',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old1';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('new1');

      const mockEditor2 = { getValue: vi.fn(() => 'new2') };
      editor.editorState.role2 = {
        content: 'new2',
        isDirty: true,
        label: 'Role 2'
      };
      editor.originalContent.role2 = 'old2';
      editor.monacoEditors.role2 = mockEditor2;

      editor.buildFormDataForSaveAll = vi.fn(() => ({ csrfToken: 'test-token' }));
      editor.updateToggleButtons = vi.fn();
      editor.saveState = vi.fn();

      await editor.saveAll(mockButton);

      expect(editor.originalContent.role1).toBe('new1');
      expect(editor.originalContent.role2).toBe('new2');
    });

    it('should mark all items clean if unchanged during save', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content1',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old1';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content1');

      const mockEditor2 = { getValue: vi.fn(() => 'content2') };
      editor.editorState.role2 = {
        content: 'content2',
        isDirty: true,
        label: 'Role 2'
      };
      editor.originalContent.role2 = 'old2';
      editor.monacoEditors.role2 = mockEditor2;

      editor.buildFormDataForSaveAll = vi.fn(() => ({ csrfToken: 'test-token' }));
      editor.updateToggleButtons = vi.fn();
      editor.saveState = vi.fn();

      await editor.saveAll(mockButton);

      expect(editor.editorState.role1.isDirty).toBe(false);
      expect(editor.editorState.role2.isDirty).toBe(false);
    });

    it('should detect concurrent edits per item', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content1',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old1';
      editor.monacoEditors.role1 = mockEditor;
      // First call for sync, second call for concurrent check
      mockEditor.getValue
        .mockReturnValueOnce('content1')
        .mockReturnValueOnce('changed1');

      const mockEditor2 = { getValue: vi.fn(() => 'content2') };
      editor.editorState.role2 = {
        content: 'content2',
        isDirty: true,
        label: 'Role 2'
      };
      editor.originalContent.role2 = 'old2';
      editor.monacoEditors.role2 = mockEditor2;

      editor.buildFormDataForSaveAll = vi.fn(() => ({ csrfToken: 'test-token' }));
      editor.updateToggleButtons = vi.fn();
      editor.saveState = vi.fn();

      await editor.saveAll(mockButton);

      // role1 changed during save, should stay dirty
      expect(editor.editorState.role1.isDirty).toBe(true);
      // role2 unchanged, should be clean
      expect(editor.editorState.role2.isDirty).toBe(false);
    });

    it('should throw error if buildFormDataForSaveAll not implemented', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content');

      // Don't set buildFormDataForSaveAll hook

      await editor.saveAll(mockButton);

      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        expect.stringContaining('buildFormDataForSaveAll hook not implemented'),
        'error'
      );
    });

    it('should handle HTTP error response', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content');

      editor.buildFormDataForSaveAll = vi.fn(() => ({ csrfToken: 'test-token' }));

      mockContext.API.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      await editor.saveAll(mockButton);

      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save'),
        'error'
      );
    });
  });

  describe('postFormData()', () => {
    it('should POST form data with correct headers', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      const formData = {
        csrfToken: 'test-token',
        field1: 'value1'
      };

      const response = await editor.postFormData(formData);

      expect(mockContext.API.buildMultipartBody).toHaveBeenCalledWith(formData);
      expect(mockContext.API.fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'multipart/form-data; boundary=mock-boundary',
          'Accept': expect.stringContaining('text/html')
        }),
        credentials: 'include',
        body: 'mock-body'
        // Note: redirect defaults to 'follow' (not explicitly set)
      });

      expect(response.ok).toBe(true);
    });
  });

  // ========================================================================
  // PRIORITY 3: FORMAT INTEGRATION
  // ========================================================================

  describe('formatItemIfNeeded()', () => {
    it('should skip format if formatOnSave is disabled', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: false });

      const item = { content: 'body{color:red}' };
      await editor.formatItemIfNeeded('role1', item, mockEditor);

      expect(mockContext.Formatter.formatCSS).not.toHaveBeenCalled();
      expect(item.content).toBe('body{color:red}');
    });

    it('should skip format if formatter not ready', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });
      mockContext.Formatter.isReady.mockReturnValue(false);

      const item = { content: 'body{color:red}' };
      await editor.formatItemIfNeeded('role1', item, mockEditor);

      expect(mockContext.Formatter.formatCSS).not.toHaveBeenCalled();
    });

    it('should skip format if content is empty', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });

      const item = { content: '' };
      await editor.formatItemIfNeeded('role1', item, mockEditor);

      expect(mockContext.Formatter.formatCSS).not.toHaveBeenCalled();
    });

    it('should skip format if content is whitespace only', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });

      const item = { content: '   \n\t  ' };
      await editor.formatItemIfNeeded('role1', item, mockEditor);

      expect(mockContext.Formatter.formatCSS).not.toHaveBeenCalled();
    });

    it('should format CSS content', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });
      mockContext.Formatter.formatCSS.mockResolvedValue('body {\n  color: red;\n}');

      const item = { content: 'body{color:red}' };
      await editor.formatItemIfNeeded('role1', item, mockEditor);

      expect(mockContext.Formatter.formatCSS).toHaveBeenCalledWith('body{color:red}');
      expect(item.content).toBe('body {\n  color: red;\n}');
    });

    it('should update editor value when editor provided', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });
      mockContext.Formatter.formatCSS.mockResolvedValue('formatted');

      const item = { content: 'unformatted' };
      await editor.formatItemIfNeeded('role1', item, mockEditor);

      expect(mockEditor.setValue).toHaveBeenCalledWith('formatted');
    });

    it('should not update editor value when editor is null', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });
      mockContext.Formatter.formatCSS.mockResolvedValue('formatted');

      const item = { content: 'unformatted' };
      await editor.formatItemIfNeeded('role1', item, null);

      expect(mockEditor.setValue).not.toHaveBeenCalled();
      expect(item.content).toBe('formatted');
    });

    it('should handle format error gracefully', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });
      mockContext.Formatter.formatCSS.mockRejectedValue(new Error('Format failed'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const item = { content: 'body{color:red}' };
      await editor.formatItemIfNeeded('role1', item, mockEditor);

      // Content should remain unchanged
      expect(item.content).toBe('body{color:red}');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-format failed'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should use correct formatter method for HTML', async () => {
      const htmlConfig = { ...mockConfig, editorType: 'html', formatterMethod: 'formatHTML' };
      const editor = new BaseEditor(htmlConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });
      mockContext.Formatter.formatHTML.mockResolvedValue('<div>\n  content\n</div>');

      const item = { content: '<div>content</div>' };
      await editor.formatItemIfNeeded('field1', item, mockEditor);

      expect(mockContext.Formatter.formatHTML).toHaveBeenCalledWith('<div>content</div>');
      expect(mockContext.Formatter.formatCSS).not.toHaveBeenCalled();
      expect(item.content).toBe('<div>\n  content\n</div>');
    });
  });

  describe('Format-on-Save Integration', () => {
    it('should format before save when enabled', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });
      mockContext.Formatter.formatCSS.mockResolvedValue('body {\n  color: red;\n}');

      editor.editorState.role1 = {
        content: 'body{color:red}',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = '';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('body{color:red}');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));
      editor.updateToggleButtons = vi.fn();
      editor.saveState = vi.fn();

      await editor.saveItem('role1', mockButton);

      // Formatter should be called
      expect(mockContext.Formatter.formatCSS).toHaveBeenCalled();

      // Should save formatted content
      expect(editor.editorState.role1.content).toBe('body {\n  color: red;\n}');
      expect(mockContext.API.fetch).toHaveBeenCalled();
    });

    it('should not format when formatOnSave disabled', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: false });

      editor.editorState.role1 = {
        content: 'body{color:red}',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = '';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('body{color:red}');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));
      editor.updateToggleButtons = vi.fn();
      editor.saveState = vi.fn();

      await editor.saveItem('role1', mockButton);

      expect(mockContext.Formatter.formatCSS).not.toHaveBeenCalled();
      expect(editor.editorState.role1.content).toBe('body{color:red}');
    });

    it('should continue save even if format fails', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      mockContext.Storage.getFormatterSettings.mockReturnValue({ formatOnSave: true });
      mockContext.Formatter.formatCSS.mockRejectedValue(new Error('Format error'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      editor.editorState.role1 = {
        content: 'body{color:red}',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = '';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('body{color:red}');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));
      editor.updateToggleButtons = vi.fn();
      editor.saveState = vi.fn();

      await editor.saveItem('role1', mockButton);

      // Should still save with unformatted content
      expect(mockContext.API.fetch).toHaveBeenCalled();
      expect(mockContext.UI.showToast).toHaveBeenCalledWith(
        'Role 1 saved successfully!',
        'success'
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // ========================================================================
  // PRIORITY 4: UI STATE MANAGEMENT
  // ========================================================================

  describe('prepareSaveUI()', () => {
    it('should disable trigger button and show spinner', () => {
      const editor = new BaseEditor(mockConfig);

      const restoreData = editor.prepareSaveUI(mockButton);

      expect(mockButton.disabled).toBe(true);
      expect(mockButton.classList.add).toHaveBeenCalledWith('saving');
      expect(mockButton.innerHTML).toBe('<span class="spinner"></span> Saving...');

      expect(restoreData.triggerButton).toEqual({
        element: mockButton,
        text: 'Save',
        disabled: false
      });
    });

    it('should handle null trigger button', () => {
      const editor = new BaseEditor(mockConfig);

      const restoreData = editor.prepareSaveUI(null);

      expect(restoreData.triggerButton).toBeNull();
    });

    it('should disable all save and discard buttons', () => {
      const editor = new BaseEditor(mockConfig);

      const saveBtn = { disabled: false };
      const discardBtn = { disabled: false };

      global.document.getElementById = vi.fn((id) => {
        if (id === 'save-btn') return saveBtn;
        return null;
      });

      global.document.querySelectorAll = vi.fn((selector) => {
        if (selector.includes('discard')) return [discardBtn];
        return [];
      });

      const restoreData = editor.prepareSaveUI(mockButton);

      expect(saveBtn.disabled).toBe(true);
      expect(discardBtn.disabled).toBe(true);
      expect(restoreData.allButtons).toHaveLength(2);
    });

    it('should preserve original disabled state of buttons', () => {
      const editor = new BaseEditor(mockConfig);

      const alreadyDisabledBtn = { disabled: true };
      const enabledBtn = { disabled: false };

      global.document.getElementById = vi.fn(() => alreadyDisabledBtn);
      global.document.querySelectorAll = vi.fn(() => [enabledBtn]);

      const restoreData = editor.prepareSaveUI(mockButton);

      expect(restoreData.allButtons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ disabled: true }),
          expect.objectContaining({ disabled: false })
        ])
      );
    });
  });

  describe('restoreSaveUI()', () => {
    it('should restore trigger button state', () => {
      const editor = new BaseEditor(mockConfig);

      mockButton.disabled = true;
      mockButton.innerHTML = '<span class="spinner"></span> Saving...';

      const restoreData = {
        triggerButton: {
          element: mockButton,
          text: 'Save',
          disabled: false
        },
        allButtons: []
      };

      editor.restoreSaveUI(restoreData);

      expect(mockButton.disabled).toBe(false);
      expect(mockButton.classList.remove).toHaveBeenCalledWith('saving');
      expect(mockButton.textContent).toBe('Save');
    });

    it('should handle null trigger button in restore data', () => {
      const editor = new BaseEditor(mockConfig);

      const restoreData = {
        triggerButton: null,
        allButtons: []
      };

      // Should not throw
      expect(() => editor.restoreSaveUI(restoreData)).not.toThrow();
    });

    it('should restore all button states', () => {
      const editor = new BaseEditor(mockConfig);

      const btn1 = { disabled: true };
      const btn2 = { disabled: true };

      const restoreData = {
        triggerButton: null,
        allButtons: [
          { element: btn1, disabled: false },
          { element: btn2, disabled: true }
        ]
      };

      editor.restoreSaveUI(restoreData);

      expect(btn1.disabled).toBe(false);
      expect(btn2.disabled).toBe(true);
    });
  });

  describe('Save UI Lifecycle', () => {
    it('should prepare UI before save and restore after success', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));
      editor.updateToggleButtons = vi.fn();
      editor.saveState = vi.fn();

      // Track call order
      const calls = [];
      mockButton.classList.add = vi.fn(() => calls.push('disable'));
      mockButton.classList.remove = vi.fn(() => calls.push('enable'));

      await editor.saveItem('role1', mockButton);

      // Should disable before API call, enable after
      expect(calls).toEqual(['disable', 'enable']);
    });

    it('should restore UI even if save fails', async () => {
      const editor = new BaseEditor(mockConfig);
      editor.context = mockContext;

      editor.editorState.role1 = {
        content: 'content',
        isDirty: true,
        label: 'Role 1'
      };
      editor.originalContent.role1 = 'old';
      editor.monacoEditors.role1 = mockEditor;
      mockEditor.getValue.mockReturnValue('content');

      editor.buildFormDataForSave = vi.fn(() => ({ csrfToken: 'test-token' }));

      // Mock error
      mockContext.API.fetch.mockRejectedValue(new Error('Network error'));

      await editor.saveItem('role1', mockButton);

      // Should restore button even after error
      expect(mockButton.classList.remove).toHaveBeenCalledWith('saving');
    });
  });
});
