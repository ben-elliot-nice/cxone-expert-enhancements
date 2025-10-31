/**
 * CXone Expert Enhancements - Settings App
 *
 * Manages code formatter settings and preferences.
 *
 * @version 1.0.0
 */

// ES Module - import dependencies from core
import { AppManager } from './core.js';

console.log('[Settings App] Loading...');

    // ============================================================================
    // State & Configuration
    // ============================================================================

    let context = null;
    let currentSettings = null;

    // ============================================================================
    // App Interface Implementation
    // ============================================================================

    const SettingsApp = {
        id: 'settings',
        name: 'Settings',

        // App-specific constraints for overlay sizing
        constraints: {
            minWidth: 420,
            minHeight: 300
        },

        /**
         * Initialize the app with context
         */
        async init(ctx) {
            console.log('[Settings] Initializing...');
            context = ctx;

            // Load current settings
            currentSettings = context.Storage.getFormatterSettings();

            console.log('[Settings] Initialized');
        },

        /**
         * Mount the app into the container
         */
        async mount(container) {
            console.log('[Settings] Mounting...');

            // Load current settings
            currentSettings = context.Storage.getFormatterSettings();

            // Build UI
            container.innerHTML = `
                <div class="enhancements-app-container">
                    <div class="settings-container">
                        <h2 class="settings-heading">Code Formatting Settings</h2>

                        <div class="settings-section">
                            <h3 class="settings-section-title">General</h3>

                            <div class="settings-option">
                                <label class="settings-label">
                                    <input type="checkbox" id="format-on-save" ${currentSettings.formatOnSave ? 'checked' : ''}>
                                    <span>Auto-format on save</span>
                                </label>
                                <p class="settings-description">Automatically format code when clicking Save</p>
                            </div>
                        </div>

                        <div class="settings-section">
                            <h3 class="settings-section-title">Indentation</h3>

                            <div class="settings-option">
                                <label class="settings-label">Indent Style</label>
                                <div class="settings-radio-group">
                                    <label class="settings-radio">
                                        <input type="radio" name="indent-style" value="spaces" ${currentSettings.indentStyle === 'spaces' ? 'checked' : ''}>
                                        <span>Spaces</span>
                                    </label>
                                    <label class="settings-radio">
                                        <input type="radio" name="indent-style" value="tabs" ${currentSettings.indentStyle === 'tabs' ? 'checked' : ''}>
                                        <span>Tabs</span>
                                    </label>
                                </div>
                            </div>

                            <div class="settings-option">
                                <label class="settings-label" for="indent-size">
                                    Indent Size
                                </label>
                                <select id="indent-size" class="settings-select">
                                    <option value="2" ${currentSettings.indentSize === 2 ? 'selected' : ''}>2</option>
                                    <option value="4" ${currentSettings.indentSize === 4 ? 'selected' : ''}>4</option>
                                    <option value="8" ${currentSettings.indentSize === 8 ? 'selected' : ''}>8</option>
                                </select>
                                <p class="settings-description" id="indent-size-description">
                                    ${currentSettings.indentStyle === 'tabs' ? 'Tab width (visual display)' : 'Number of spaces per indentation level'}
                                </p>
                            </div>
                        </div>

                        <div class="settings-section">
                            <h3 class="settings-section-title">Code Style</h3>

                            <div class="settings-option">
                                <label class="settings-label">Quote Style</label>
                                <div class="settings-radio-group">
                                    <label class="settings-radio">
                                        <input type="radio" name="quote-style" value="single" ${currentSettings.quoteStyle === 'single' ? 'checked' : ''}>
                                        <span>Single quotes (')</span>
                                    </label>
                                    <label class="settings-radio">
                                        <input type="radio" name="quote-style" value="double" ${currentSettings.quoteStyle === 'double' ? 'checked' : ''}>
                                        <span>Double quotes (")</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="settings-actions">
                            <button class="btn btn-secondary" id="reset-btn">Reset to Defaults</button>
                            <button class="btn btn-primary" id="save-settings-btn">Save Settings</button>
                        </div>

                        <div class="settings-info">
                            <p><strong>Keyboard Shortcuts:</strong></p>
                            <ul>
                                <li><code>Ctrl+Shift+F</code> - Format current editor</li>
                            </ul>
                            <p class="settings-note">
                                Settings apply immediately to all editors. Formatting uses Prettier for consistent, industry-standard code style.
                            </p>
                        </div>
                    </div>
                </div>
            `;

            // Apply styles
            this.injectStyles();

            // Attach event listeners
            this.attachListeners();

            console.log('[Settings] Mounted');
        },

        /**
         * Unmount the app (cleanup)
         */
        async unmount() {
            console.log('[Settings] Unmounting...');
            console.log('[Settings] Unmounted');
        },

        /**
         * Get current state for persistence
         */
        getState() {
            return {
                lastViewed: Date.now()
            };
        },

        /**
         * Restore state
         */
        setState(state) {
            // No persistent state needed for settings app
        },

        /**
         * Inject custom styles for settings UI
         */
        injectStyles() {
            if (document.getElementById('settings-app-styles')) return;

            const style = document.createElement('style');
            style.id = 'settings-app-styles';
            style.textContent = `
                .enhancements-app-container {
                    overflow-y: auto;
                    height: 100%;
                }

                .settings-container {
                    padding: 2rem;
                    max-width: 800px;
                    margin: 0 auto;
                    color: #e9ecef;
                }

                .settings-heading {
                    font-size: 1.75rem;
                    font-weight: 600;
                    margin: 0 0 2rem 0;
                    color: #fff;
                    border-bottom: 2px solid #444;
                    padding-bottom: 0.75rem;
                }

                .settings-section {
                    margin-bottom: 2.5rem;
                }

                .settings-section-title {
                    font-size: 1.25rem;
                    font-weight: 500;
                    margin: 0 0 1.25rem 0;
                    color: #fff;
                }

                .settings-option {
                    margin-bottom: 1.5rem;
                }

                .settings-label {
                    display: block;
                    font-weight: 500;
                    margin-bottom: 0.5rem;
                    color: #e9ecef;
                    font-size: 0.95rem;
                }

                .settings-label input[type="checkbox"] {
                    margin-right: 0.5rem;
                    cursor: pointer;
                }

                .settings-description {
                    font-size: 0.875rem;
                    color: #adb5bd;
                    margin: 0.375rem 0 0 0;
                }

                .settings-radio-group {
                    display: flex;
                    gap: 1.5rem;
                    margin-top: 0.5rem;
                }

                .settings-radio {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                }

                .settings-radio input[type="radio"] {
                    margin-right: 0.5rem;
                    cursor: pointer;
                }

                .settings-select {
                    width: 100%;
                    max-width: 200px;
                    padding: 0.5rem;
                    background: #2d2d30;
                    border: 1px solid #444;
                    border-radius: 4px;
                    color: #e9ecef;
                    font-size: 0.95rem;
                    cursor: pointer;
                    margin-top: 0.5rem;
                }

                .settings-select:focus {
                    outline: none;
                    border-color: #0d6efd;
                }

                .settings-actions {
                    display: flex;
                    gap: 1rem;
                    margin: 2rem 0;
                    padding-top: 2rem;
                    border-top: 1px solid #444;
                }

                .settings-info {
                    margin-top: 2rem;
                    padding: 1.5rem;
                    background: rgba(13, 110, 253, 0.1);
                    border: 1px solid rgba(13, 110, 253, 0.3);
                    border-radius: 6px;
                }

                .settings-info strong {
                    color: #fff;
                }

                .settings-info ul {
                    margin: 0.75rem 0;
                    padding-left: 1.5rem;
                }

                .settings-info li {
                    margin: 0.375rem 0;
                }

                .settings-info code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 0.2rem 0.4rem;
                    border-radius: 3px;
                    font-family: 'Monaco', 'Courier New', monospace;
                    font-size: 0.875rem;
                }

                .settings-note {
                    margin-top: 1rem;
                    font-size: 0.875rem;
                    color: #adb5bd;
                }

                .btn {
                    padding: 0.5rem 1.25rem;
                    border-radius: 4px;
                    font-size: 0.95rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }

                .btn-primary {
                    background: #0d6efd;
                    color: white;
                }

                .btn-primary:hover {
                    background: #0b5ed7;
                }

                .btn-secondary {
                    background: transparent;
                    color: #e9ecef;
                    border: 1px solid #555;
                }

                .btn-secondary:hover {
                    background: #3a3a3a;
                }
            `;
            document.head.appendChild(style);
        },

        /**
         * Attach event listeners to settings controls
         */
        attachListeners() {
            // Format on save toggle
            const formatOnSaveCheckbox = document.getElementById('format-on-save');
            if (formatOnSaveCheckbox) {
                formatOnSaveCheckbox.addEventListener('change', (e) => {
                    currentSettings.formatOnSave = e.target.checked;
                    this.updateSettings();
                });
            }

            // Indent style radio buttons
            const indentStyleRadios = document.querySelectorAll('input[name="indent-style"]');
            const indentSizeDescription = document.getElementById('indent-size-description');
            indentStyleRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    currentSettings.indentStyle = e.target.value;

                    // Update description based on indent style
                    if (indentSizeDescription) {
                        indentSizeDescription.textContent = e.target.value === 'tabs'
                            ? 'Tab width (visual display)'
                            : 'Number of spaces per indentation level';
                    }

                    this.updateSettings();
                });
            });

            // Indent size select
            const indentSizeSelect = document.getElementById('indent-size');
            if (indentSizeSelect) {
                indentSizeSelect.addEventListener('change', (e) => {
                    currentSettings.indentSize = parseInt(e.target.value, 10);
                    this.updateSettings();
                });
            }

            // Quote style radio buttons
            const quoteStyleRadios = document.querySelectorAll('input[name="quote-style"]');
            quoteStyleRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    currentSettings.quoteStyle = e.target.value;
                    this.updateSettings();
                });
            });

            // Reset button
            const resetBtn = document.getElementById('reset-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => this.resetToDefaults());
            }

            // Save button (explicit save for visual feedback)
            const saveBtn = document.getElementById('save-settings-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => this.saveSettings());
            }
        },

        /**
         * Update settings (auto-save)
         */
        updateSettings() {
            context.Storage.setFormatterSettings(currentSettings);
            console.log('[Settings] Settings auto-saved:', currentSettings);
        },

        /**
         * Save settings (with feedback)
         */
        saveSettings() {
            context.Storage.setFormatterSettings(currentSettings);
            context.UI.showToast('Settings saved successfully!', 'success');
            console.log('[Settings] Settings saved:', currentSettings);
        },

        /**
         * Reset to default settings
         */
        resetToDefaults() {
            const defaults = {
                formatOnSave: true,
                indentStyle: 'spaces',
                indentSize: 2,
                quoteStyle: 'single',
                cssSettings: {
                    parser: 'css'
                },
                htmlSettings: {
                    parser: 'html'
                }
            };

            currentSettings = defaults;
            context.Storage.setFormatterSettings(defaults);

            // Refresh UI
            const container = document.querySelector('.enhancements-app-container');
            if (container) {
                this.mount(container.parentElement);
            }

            context.UI.showToast('Settings reset to defaults', 'info');
            console.log('[Settings] Reset to defaults');
        }
    };

    // ============================================================================
// Register App & Export
// ============================================================================

// Register with AppManager (gracefully handles registration failures)
try {
    // Debug/Test: Allow URL parameter to force registration failure
    const urlParams = new URLSearchParams(window.location.search);
    const failApps = urlParams.getAll('failApp');

    if (failApps.includes('settings')) {
        console.warn('[Settings App] ⚠ Simulating registration failure (failApp URL param)');
        throw new Error('Simulated failure for testing (URL param: failApp=settings)');
    }

    const registered = AppManager.register(SettingsApp);
    if (registered) {
        console.log('[Settings App] Successfully registered');
    } else {
        console.error('[Settings App] Registration failed - check AppManager logs');
    }
} catch (error) {
    console.error('[Settings App] Unexpected error during registration:', error);
}

// Export for potential external use
export { SettingsApp };
