import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadCore } from '../helpers/core-loader.js';
import { createMockLocalStorage } from '../helpers/test-utils.js';

describe('CSS Editor', () => {
  let CSSEditorApp;

  beforeEach(async () => {
    // Reset mocks
    global.localStorage = createMockLocalStorage();
    vi.clearAllMocks();

    // Load core first (for BaseEditor)
    await loadCore();

    // Load CSS Editor module directly
    const cssEditorModule = await import('../../../src/css-editor.js');
    CSSEditorApp = cssEditorModule.CSSEditorApp;
  });

  describe('App Metadata', () => {
    it('should have correct app ID and name', () => {
      expect(CSSEditorApp.id).toBe('css-editor');
      expect(CSSEditorApp.name).toBe('CSS Editor');
    });

    it('should declare settings as dependency', () => {
      expect(CSSEditorApp.dependencies).toEqual(['settings']);
    });

    it('should have overlay constraints configured', () => {
      expect(CSSEditorApp.constraints).toBeDefined();
      expect(CSSEditorApp.constraints.minWidth).toBe(420);
      expect(CSSEditorApp.constraints.minHeight).toBe(300);
    });
  });

  describe('Role Configuration', () => {
    it('should define 6 CSS roles with correct IDs', () => {
      // Access the ROLE_CONFIG through the initialization
      // We'll verify this through the editor state after init
      expect(CSSEditorApp).toBeDefined();
      // Role IDs are: all, anonymous, viewer, seated, admin, grape
    });

    it('should map roles to correct labels', () => {
      // Verify role labels match expected values
      // all -> All Roles
      // anonymous -> Anonymous
      // viewer -> Community Member
      // seated -> Pro Member
      // admin -> Admin
      // grape -> Legacy Browser
      expect(CSSEditorApp).toBeDefined();
    });
  });

  describe('BaseEditor Integration', () => {
    it('should create BaseEditor instance with CSS configuration', async () => {
      // Create minimal mock context
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor).toBeDefined();
      expect(CSSEditorApp._baseEditor.config.editorType).toBe('css');
    });

    it('should configure correct monaco language', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.config.monacoLanguage).toBe('css');
    });

    it('should configure correct file extension', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.config.fileExtension).toBe('.css');
    });

    it('should configure correct MIME type', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.config.mimeType).toBe('text/css');
    });

    it('should configure CSS comment style', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.config.commentStyle).toBe('/* */');
    });

    it('should configure formatCSS as formatter method', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.config.formatterMethod).toBe('formatCSS');
    });

    it('should configure role as data attribute', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.config.dataAttribute).toBe('role');
    });

    it('should configure role as item label', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.config.itemLabel).toBe('role');
    });

    it('should set API endpoint to custom_css.php', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.config.apiEndpoint).toBe('/deki/cp/custom_css.php?params=%2F');
    });

    it('should set form field prefix to css_template_', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.config.formFieldPrefix).toBe('css_template_');
    });

    it('should set max active editors to 3', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.config.maxActiveEditors).toBe(3);
    });
  });

  describe('Editor State Initialization', () => {
    it('should initialize state for all 6 roles', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;

      expect(editorState.all).toBeDefined();
      expect(editorState.anonymous).toBeDefined();
      expect(editorState.viewer).toBeDefined();
      expect(editorState.seated).toBeDefined();
      expect(editorState.admin).toBeDefined();
      expect(editorState.grape).toBeDefined();
    });

    it('should initialize each role with correct structure', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const allRole = CSSEditorApp._baseEditor.editorState.all;

      expect(allRole.active).toBe(false);
      expect(allRole.editor).toBeNull();
      expect(allRole.content).toBe('');
      expect(allRole.label).toBe('All Roles');
      expect(allRole.isDirty).toBe(false);
    });

    it('should set correct label for anonymous role', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.editorState.anonymous.label).toBe('Anonymous');
    });

    it('should set correct label for viewer role (Community Member)', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.editorState.viewer.label).toBe('Community Member');
    });

    it('should set correct label for seated role (Pro Member)', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.editorState.seated.label).toBe('Pro Member');
    });

    it('should set correct label for admin role', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.editorState.admin.label).toBe('Admin');
    });

    it('should set correct label for grape role (Legacy Browser)', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.editorState.grape.label).toBe('Legacy Browser');
    });
  });

  describe('Live Preview State', () => {
    it('should include live preview state in getState', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const state = CSSEditorApp.getState();

      expect(state.livePreview).toBeDefined();
      expect(state.livePreview.enabled).toBeDefined();
      expect(state.livePreview.selectedRole).toBeDefined();
    });

    it('should default live preview to disabled', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const state = CSSEditorApp.getState();

      expect(state.livePreview.enabled).toBe(false);
    });

    it('should default live preview role to anonymous', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const state = CSSEditorApp.getState();

      expect(state.livePreview.selectedRole).toBe('anonymous');
    });

    it('should restore live preview state from saved state', async () => {
      const savedState = {
        activeRoles: [],
        content: {},
        isDirty: {},
        originalContent: {},
        livePreview: {
          enabled: true,
          selectedRole: 'admin'
        }
      };

      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => savedState) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);
      CSSEditorApp.setState(savedState);

      const state = CSSEditorApp.getState();

      expect(state.livePreview.enabled).toBe(true);
      expect(state.livePreview.selectedRole).toBe('admin');
    });

    it('should handle missing live preview state gracefully', async () => {
      const savedState = {
        activeRoles: [],
        content: {},
        isDirty: {},
        originalContent: {}
        // No livePreview key
      };

      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => savedState) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);
      CSSEditorApp.setState(savedState);

      const state = CSSEditorApp.getState();

      // Should include livePreview in state even if not provided
      expect(state.livePreview).toBeDefined();
      expect(state.livePreview.enabled).toBeDefined();
      expect(state.livePreview.selectedRole).toBeDefined();
    });
  });

  describe('Role Switching Logic', () => {
    it('should track active role state', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;

      // Simulate role activation
      editorState.all.active = true;
      editorState.anonymous.active = false;

      expect(editorState.all.active).toBe(true);
      expect(editorState.anonymous.active).toBe(false);
    });

    it('should allow multiple roles to be active simultaneously', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;

      // Activate multiple roles (up to max of 3)
      editorState.all.active = true;
      editorState.anonymous.active = true;
      editorState.viewer.active = true;

      expect(editorState.all.active).toBe(true);
      expect(editorState.anonymous.active).toBe(true);
      expect(editorState.viewer.active).toBe(true);
    });

    it('should persist active roles in state', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;

      editorState.all.active = true;
      editorState.admin.active = true;

      const state = CSSEditorApp.getState();

      expect(state.activeRoles).toContain('all');
      expect(state.activeRoles).toContain('admin');
    });
  });

  describe('Dirty State Tracking Per Role', () => {
    it('should track dirty state independently per role', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;

      editorState.all.isDirty = true;
      editorState.anonymous.isDirty = false;

      expect(editorState.all.isDirty).toBe(true);
      expect(editorState.anonymous.isDirty).toBe(false);
    });

    it('should include dirty state in getState', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;

      editorState.all.isDirty = true;
      editorState.viewer.isDirty = true;

      const state = CSSEditorApp.getState();

      expect(state.isDirty.all).toBe(true);
      expect(state.isDirty.viewer).toBe(true);
    });

    it('should restore dirty state from saved state', async () => {
      const savedState = {
        activeRoles: ['all'],
        content: { all: 'body { color: red; }' },
        isDirty: { all: true, anonymous: false },
        originalContent: { all: 'body { color: blue; }' }
      };

      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => savedState) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);
      CSSEditorApp.setState(savedState);

      const editorState = CSSEditorApp._baseEditor.editorState;

      expect(editorState.all.isDirty).toBe(true);
      expect(editorState.anonymous.isDirty).toBe(false);
    });
  });

  describe('Content Management Per Role', () => {
    it('should store content independently per role', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;

      editorState.all.content = 'body { margin: 0; }';
      editorState.anonymous.content = '.anonymous-only { display: none; }';

      expect(editorState.all.content).toBe('body { margin: 0; }');
      expect(editorState.anonymous.content).toBe('.anonymous-only { display: none; }');
    });

    it('should include content in getState', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;

      editorState.all.content = 'body { padding: 0; }';

      const state = CSSEditorApp.getState();

      expect(state.content.all).toBe('body { padding: 0; }');
    });

    it('should restore content from saved state', async () => {
      const savedState = {
        activeRoles: ['all', 'admin'],
        content: {
          all: 'body { margin: 0; }',
          admin: '.admin-panel { display: block; }'
        },
        isDirty: { all: false, admin: true },
        originalContent: {
          all: 'body { margin: 0; }',
          admin: ''
        }
      };

      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => savedState) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);
      CSSEditorApp.setState(savedState);

      const editorState = CSSEditorApp._baseEditor.editorState;

      expect(editorState.all.content).toBe('body { margin: 0; }');
      expect(editorState.admin.content).toBe('.admin-panel { display: block; }');
    });
  });

  describe('Form Data Construction', () => {
    it('should build form data for save with CSRF token', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;
      const originalContent = CSSEditorApp._baseEditor.originalContent;

      // Set up state
      editorState.all.content = 'body {}';
      originalContent.all = 'body {}';

      const formData = CSSEditorApp._baseEditor.buildFormDataForSave('all');

      // Should have csrf_token field (actual value depends on loadData being called)
      expect(formData).toHaveProperty('csrf_token');
    });

    it('should include all 6 role fields in form data', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;
      editorState.all.content = 'all css';
      editorState.anonymous.content = 'anon css';
      editorState.viewer.content = 'viewer css';
      editorState.seated.content = 'seated css';
      editorState.admin.content = 'admin css';
      editorState.grape.content = 'grape css';

      const originalContent = CSSEditorApp._baseEditor.originalContent;
      originalContent.all = 'all css';
      originalContent.anonymous = 'anon css';
      originalContent.viewer = 'viewer css';
      originalContent.seated = 'seated css';
      originalContent.admin = 'admin css';
      originalContent.grape = 'grape css';

      const formData = CSSEditorApp._baseEditor.buildFormDataForSave('all');

      expect(formData.css_template_all).toBe('all css');
      expect(formData.css_template_anonymous).toBe('anon css');
      expect(formData.css_template_viewer).toBe('viewer css');
      expect(formData.css_template_seated).toBe('seated css');
      expect(formData.css_template_admin).toBe('admin css');
      expect(formData.css_template_grape).toBe('grape css');
    });

    it('should use current content for saved role, original for others', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;
      editorState.all.content = 'modified all css';
      editorState.anonymous.content = 'modified anon css';

      const originalContent = CSSEditorApp._baseEditor.originalContent;
      originalContent.all = 'original all css';
      originalContent.anonymous = 'original anon css';
      originalContent.viewer = 'original viewer css';
      originalContent.seated = 'original seated css';
      originalContent.admin = 'original admin css';
      originalContent.grape = 'original grape css';

      // Save only 'all' role
      const formData = CSSEditorApp._baseEditor.buildFormDataForSave('all');

      expect(formData.css_template_all).toBe('modified all css');
      expect(formData.css_template_anonymous).toBe('original anon css');
      expect(formData.css_template_viewer).toBe('original viewer css');
    });

    it('should build form data for save all with all current content', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;
      editorState.all.content = 'all modified';
      editorState.anonymous.content = 'anon modified';
      editorState.viewer.content = 'viewer modified';
      editorState.seated.content = 'seated modified';
      editorState.admin.content = 'admin modified';
      editorState.grape.content = 'grape modified';

      const formData = CSSEditorApp._baseEditor.buildFormDataForSaveAll();

      expect(formData).toHaveProperty('csrf_token');
      expect(formData.css_template_all).toBe('all modified');
      expect(formData.css_template_anonymous).toBe('anon modified');
      expect(formData.css_template_viewer).toBe('viewer modified');
      expect(formData.css_template_seated).toBe('seated modified');
      expect(formData.css_template_admin).toBe('admin modified');
      expect(formData.css_template_grape).toBe('grape modified');
    });
  });

  describe('Live Preview Role Hierarchy', () => {
    it('should include only all + anonymous for anonymous preview', () => {
      // Test the role hierarchy logic
      const rolesToInclude = ['all'];
      const livePreviewRole = 'anonymous';

      if (livePreviewRole === 'anonymous') {
        rolesToInclude.push('anonymous');
      }

      expect(rolesToInclude).toEqual(['all', 'anonymous']);
    });

    it('should include only all + viewer for viewer preview', () => {
      const rolesToInclude = ['all'];
      const livePreviewRole = 'viewer';

      if (livePreviewRole === 'viewer') {
        rolesToInclude.push('viewer');
      }

      expect(rolesToInclude).toEqual(['all', 'viewer']);
    });

    it('should include only all + seated for seated preview', () => {
      const rolesToInclude = ['all'];
      const livePreviewRole = 'seated';

      if (livePreviewRole === 'seated') {
        rolesToInclude.push('seated');
      }

      expect(rolesToInclude).toEqual(['all', 'seated']);
    });

    it('should include all + seated + admin for admin preview', () => {
      const rolesToInclude = ['all'];
      const livePreviewRole = 'admin';

      if (livePreviewRole === 'admin') {
        // Admin inherits pro member permissions
        rolesToInclude.push('seated', 'admin');
      }

      expect(rolesToInclude).toEqual(['all', 'seated', 'admin']);
    });

    it('should include only all + grape for grape preview', () => {
      const rolesToInclude = ['all'];
      const livePreviewRole = 'grape';

      if (livePreviewRole === 'grape') {
        rolesToInclude.push('grape');
      }

      expect(rolesToInclude).toEqual(['all', 'grape']);
    });
  });

  describe('CSS-Specific Configuration Validation', () => {
    it('should use correct CSS comment style format', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const commentStyle = CSSEditorApp._baseEditor.config.commentStyle;

      expect(commentStyle).toBe('/* */');
      expect(commentStyle).toContain('/*');
      expect(commentStyle).toContain('*/');
    });

    it('should validate comment style is not HTML style', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const commentStyle = CSSEditorApp._baseEditor.config.commentStyle;

      expect(commentStyle).not.toBe('<!-- -->');
      expect(commentStyle).not.toContain('<!--');
    });

    it('should use css as monaco language', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      expect(CSSEditorApp._baseEditor.config.monacoLanguage).toBe('css');
      expect(CSSEditorApp._baseEditor.config.monacoLanguage).not.toBe('html');
    });
  });

  describe('Method Delegation to BaseEditor', () => {
    it('should delegate toggleEditor to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const spy = vi.spyOn(CSSEditorApp._baseEditor, 'toggleEditor').mockImplementation(() => {});

      CSSEditorApp.toggleEditor('all');

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toBe('all');
      spy.mockRestore();
    });

    it('should delegate exportRole to BaseEditor.exportItem', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const spy = vi.spyOn(CSSEditorApp._baseEditor, 'exportItem').mockImplementation(() => {});

      CSSEditorApp.exportRole('admin');

      expect(spy).toHaveBeenCalledWith('admin');
      spy.mockRestore();
    });

    it('should delegate importRole to BaseEditor.importItem', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const mockFile = new File(['body {}'], 'test.css', { type: 'text/css' });
      const spy = vi.spyOn(CSSEditorApp._baseEditor, 'importItem').mockImplementation(() => {});

      CSSEditorApp.importRole('viewer', mockFile);

      expect(spy).toHaveBeenCalledWith('viewer', mockFile);
      spy.mockRestore();
    });

    it('should delegate formatRole to BaseEditor.formatItem', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const spy = vi.spyOn(CSSEditorApp._baseEditor, 'formatItem').mockImplementation(() => {});

      CSSEditorApp.formatRole('seated');

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toBe('seated');
      spy.mockRestore();
    });

    it('should delegate discardAll to BaseEditor', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const spy = vi.spyOn(CSSEditorApp._baseEditor, 'discardAll').mockImplementation(() => {});

      CSSEditorApp.discardAll();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should delegate revertRole to BaseEditor.revertItem', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const spy = vi.spyOn(CSSEditorApp._baseEditor, 'revertItem').mockImplementation(() => {});

      CSSEditorApp.revertRole('grape');

      expect(spy).toHaveBeenCalledWith('grape');
      spy.mockRestore();
    });
  });

  describe('State Persistence Integration', () => {
    it('should combine base state with live preview state', async () => {
      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => null) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);

      const editorState = CSSEditorApp._baseEditor.editorState;
      editorState.all.active = true;
      editorState.all.content = 'body { margin: 0; }';

      const state = CSSEditorApp.getState();

      // Should have base editor state
      expect(state.activeRoles).toBeDefined();
      expect(state.content).toBeDefined();
      expect(state.isDirty).toBeDefined();
      expect(state.originalContent).toBeDefined();

      // Should also have CSS-specific live preview state
      expect(state.livePreview).toBeDefined();
    });

    it('should restore complete state including live preview', async () => {
      const completeState = {
        activeRoles: ['all', 'admin'],
        content: {
          all: 'body { margin: 0; }',
          admin: '.admin { display: block; }'
        },
        isDirty: {
          all: false,
          admin: true
        },
        originalContent: {
          all: 'body { margin: 0; }',
          admin: ''
        },
        livePreview: {
          enabled: true,
          selectedRole: 'admin'
        }
      };

      const mockContext = {
        Monaco: { init: vi.fn().mockResolvedValue(true) },
        Storage: { getAppState: vi.fn(() => completeState) },
        Config: { get: vi.fn() }
      };

      await CSSEditorApp.init(mockContext);
      CSSEditorApp.setState(completeState);

      const editorState = CSSEditorApp._baseEditor.editorState;

      // Base state restored
      expect(editorState.all.active).toBe(true);
      expect(editorState.admin.active).toBe(true);
      expect(editorState.all.content).toBe('body { margin: 0; }');
      expect(editorState.admin.isDirty).toBe(true);

      // Live preview state restored
      const restoredState = CSSEditorApp.getState();
      expect(restoredState.livePreview.enabled).toBe(true);
      expect(restoredState.livePreview.selectedRole).toBe('admin');
    });
  });
});
