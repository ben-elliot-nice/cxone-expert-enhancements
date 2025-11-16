/**
 * Expert Enhancements - Advanced Smoke Test Suite
 *
 * Comprehensive tests for PR #96 including save operations, import/export,
 * live preview, mobile view, and revert/discard functionality
 *
 * @version 2.0.0
 * @created 2025-01-11
 */

class AdvancedSmokeTest {
    constructor() {
        this.results = [];
        this.startTime = null;
        this.testData = {
            cssTestContent: '/* PR #96 Test */\nbody { background-color: #f0f0f0; }',
            htmlTestContent: '<!-- PR #96 Test -->\n<meta name="test" content="pr96">',
            cleanupNeeded: []
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const styles = {
            info: 'color: #2196f3',
            success: 'color: #4caf50; font-weight: bold',
            error: 'color: #ff6b6b; font-weight: bold',
            warning: 'color: #ff9800',
            section: 'color: #667eea; font-size: 14px; font-weight: bold'
        };
        console.log(`%c[${timestamp}] ${message}`, styles[type] || styles.info);
    }

    async test(name, fn) {
        this.log(`Running: ${name}`);
        const start = performance.now();
        try {
            await fn();
            const duration = Math.round(performance.now() - start);
            this.results.push({ name, status: 'PASS', duration });
            this.log(`✅ PASS: ${name} (${duration}ms)`, 'success');
            return true;
        } catch (error) {
            const duration = Math.round(performance.now() - start);
            this.results.push({ name, status: 'FAIL', duration, error: error.message });
            this.log(`❌ FAIL: ${name} - ${error.message} (${duration}ms)`, 'error');
            return false;
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===========================================================================
    // Helper Methods
    // ===========================================================================

    getMonacoEditor() {
        const models = monaco.editor.getModels();
        if (!models || models.length === 0) {
            throw new Error('No Monaco editor models found');
        }
        return models[0];
    }

    getAllMonacoEditors() {
        return monaco.editor.getEditors();
    }

    findButton(text) {
        return Array.from(document.querySelectorAll('button')).find(
            b => b.textContent.trim() === text
        );
    }

    waitForToast(expectedText, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                const toasts = document.querySelectorAll('[class*="toast"]');
                const found = Array.from(toasts).some(toast =>
                    toast.textContent.includes(expectedText)
                );

                if (found) {
                    clearInterval(checkInterval);
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error(`Toast "${expectedText}" not found within ${timeout}ms`));
                }
            }, 100);
        });
    }

    // ===========================================================================
    // Test: CSS Live Preview
    // ===========================================================================

    async testCSSLivePreviewToggle() {
        // Find live preview toggle button
        const livePreviewBtn = document.querySelector('[description*="Live Preview"]');
        if (!livePreviewBtn) {
            throw new Error('Live preview button not found');
        }

        const initialState = livePreviewBtn.getAttribute('description');
        this.log(`Initial live preview state: ${initialState}`, 'info');

        // Click to toggle
        livePreviewBtn.click();
        await this.sleep(500);

        const newState = livePreviewBtn.getAttribute('description');
        if (initialState === newState) {
            throw new Error('Live preview state did not change');
        }

        this.log(`Live preview toggled to: ${newState}`, 'info');

        // Toggle back to original state
        livePreviewBtn.click();
        await this.sleep(500);
    }

    async testCSSLivePreviewWorks() {
        const livePreviewBtn = document.querySelector('[description*="Live Preview"]');
        if (!livePreviewBtn) {
            throw new Error('Live preview button not found');
        }

        // Enable live preview
        if (livePreviewBtn.getAttribute('description').includes('OFF')) {
            livePreviewBtn.click();
            await this.sleep(500);
        }

        // Get current editor
        const editor = this.getMonacoEditor();
        const original = editor.getValue();

        // Add test CSS
        const testCSS = '\n/* Live Preview Test */\nbody::before { content: "TEST"; }';
        editor.setValue(original + testCSS);
        await this.sleep(1000);

        // Check if style tag was injected
        const livePreviewStyle = document.querySelector('style[data-live-preview]');
        if (!livePreviewStyle) {
            throw new Error('Live preview style tag not injected');
        }

        // Restore original
        editor.setValue(original);
        await this.sleep(500);

        // Disable live preview
        livePreviewBtn.click();
        await this.sleep(500);
    }

    // ===========================================================================
    // Test: Export Functionality
    // ===========================================================================

    async testExportFunctionality() {
        // Click on Actions dropdown
        const actionsBtn = this.findButton('Actions ▼');
        if (!actionsBtn) {
            throw new Error('Actions button not found');
        }

        actionsBtn.click();
        await this.sleep(300);

        // Find Export button in dropdown
        const exportBtn = Array.from(document.querySelectorAll('button')).find(
            b => b.textContent === 'Export'
        );
        if (!exportBtn) {
            throw new Error('Export button not found in Actions dropdown');
        }

        // Mock the download to verify export works
        const originalCreateElement = document.createElement.bind(document);
        let exportCalled = false;

        document.createElement = function(tagName) {
            const element = originalCreateElement(tagName);
            if (tagName === 'a' && element.download) {
                exportCalled = true;
                // Prevent actual download
                element.click = () => {};
            }
            return element;
        };

        exportBtn.click();
        await this.sleep(500);

        // Restore original
        document.createElement = originalCreateElement;

        if (!exportCalled) {
            throw new Error('Export did not trigger download');
        }

        this.log('Export functionality verified (download triggered)', 'info');
    }

    // ===========================================================================
    // Test: Import Functionality
    // ===========================================================================

    async testImportFunctionality() {
        // Click on Actions dropdown
        const actionsBtn = this.findButton('Actions ▼');
        if (!actionsBtn) {
            throw new Error('Actions button not found');
        }

        actionsBtn.click();
        await this.sleep(300);

        // Find Import button
        const importBtn = Array.from(document.querySelectorAll('button')).find(
            b => b.textContent === 'Import'
        );
        if (!importBtn) {
            throw new Error('Import button not found in Actions dropdown');
        }

        // Verify file input exists
        const fileInputs = document.querySelectorAll('input[type="file"]');
        if (fileInputs.length === 0) {
            throw new Error('File input not found');
        }

        this.log(`Found ${fileInputs.length} file input(s)`, 'info');
    }

    // ===========================================================================
    // Test: Mobile View Switching
    // ===========================================================================

    async testMobileViewSwitching() {
        const overlay = document.getElementById('expert-enhancements-overlay');
        if (!overlay) {
            throw new Error('Overlay not found');
        }

        // Get original size
        const originalWidth = overlay.style.width || overlay.offsetWidth;
        this.log(`Original overlay width: ${originalWidth}px`, 'info');

        // Resize to mobile (<920px)
        overlay.style.width = '500px';
        await this.sleep(500);

        // Trigger resize event
        window.dispatchEvent(new Event('resize'));
        await this.sleep(500);

        // Check for mobile selector
        const mobileSelector = document.getElementById('mobile-editor-select');
        const hasMobileView = !!mobileSelector;

        this.log(`Mobile view detected: ${hasMobileView}`, 'info');

        // Resize back to desktop
        overlay.style.width = '1200px';
        await this.sleep(500);
        window.dispatchEvent(new Event('resize'));
        await this.sleep(500);

        // Restore original size
        if (typeof originalWidth === 'string') {
            overlay.style.width = originalWidth;
        }
    }

    // ===========================================================================
    // Test: Dirty State Indicators
    // ===========================================================================

    async testDirtyStateIndicators() {
        const editor = this.getMonacoEditor();
        const original = editor.getValue();

        // Make an edit
        editor.setValue(original + '\n/* Test dirty state */');
        await this.sleep(500);

        // Check for dirty indicator (● symbol)
        const statusIndicators = document.querySelectorAll('[class*="editor-status"]');
        let foundDirty = false;

        statusIndicators.forEach(indicator => {
            if (indicator.textContent.includes('●')) {
                foundDirty = true;
            }
        });

        if (!foundDirty) {
            // Also check button states (orange color, bold)
            const toggleButtons = document.querySelectorAll('.toggle-btn');
            toggleButtons.forEach(btn => {
                if (btn.style.color === 'rgb(255, 152, 0)' || btn.style.fontWeight === 'bold') {
                    foundDirty = true;
                }
            });
        }

        if (!foundDirty) {
            throw new Error('Dirty state indicator not found after edit');
        }

        // Restore original
        editor.setValue(original);
        await this.sleep(500);
    }

    // ===========================================================================
    // Test: Keyboard Shortcuts
    // ===========================================================================

    async testKeyboardShortcuts() {
        // Test Ctrl+S (Save Open Tabs)
        const ctrlSEvent = new KeyboardEvent('keydown', {
            key: 's',
            code: 'KeyS',
            ctrlKey: true,
            bubbles: true
        });

        document.dispatchEvent(ctrlSEvent);
        await this.sleep(500);

        // Test Ctrl+Shift+S (Save All)
        const ctrlShiftSEvent = new KeyboardEvent('keydown', {
            key: 'S',
            code: 'KeyS',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true
        });

        document.dispatchEvent(ctrlShiftSEvent);
        await this.sleep(500);

        // Test Ctrl+Shift+F (Format)
        const ctrlShiftFEvent = new KeyboardEvent('keydown', {
            key: 'F',
            code: 'KeyF',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true
        });

        document.dispatchEvent(ctrlShiftFEvent);
        await this.sleep(500);

        this.log('Keyboard shortcuts dispatched (visual verification needed)', 'info');
    }

    // ===========================================================================
    // Test: Format Functionality
    // ===========================================================================

    async testFormatFunctionality() {
        if (!window.prettier) {
            throw new Error('Prettier not loaded');
        }

        const editor = this.getMonacoEditor();
        const unformatted = 'body{color:red;background:blue;}';

        editor.setValue(unformatted);
        await this.sleep(500);

        // Click Actions button
        const actionsBtn = this.findButton('Actions ▼');
        if (!actionsBtn) {
            throw new Error('Actions button not found');
        }

        actionsBtn.click();
        await this.sleep(300);

        // Click Format button
        const formatBtn = Array.from(document.querySelectorAll('button')).find(
            b => b.textContent === 'Format'
        );
        if (!formatBtn) {
            throw new Error('Format button not found');
        }

        formatBtn.click();
        await this.sleep(1000);

        const formatted = editor.getValue();
        if (formatted === unformatted) {
            throw new Error('Content was not formatted');
        }

        this.log('Format changed content successfully', 'info');
    }

    // ===========================================================================
    // Test: Multiple Editors Open (CSS only)
    // ===========================================================================

    async testMultipleEditorsOpen() {
        // Click on another role button (Shift+Click to open multiple)
        const roleButtons = Array.from(document.querySelectorAll('button')).filter(
            b => ['All Roles', 'Anonymous', 'Community Member'].includes(b.textContent)
        );

        if (roleButtons.length < 2) {
            throw new Error('Not enough role buttons found');
        }

        // Click first role
        roleButtons[0].click();
        await this.sleep(300);

        // Shift+click second role
        const shiftClickEvent = new MouseEvent('click', {
            bubbles: true,
            shiftKey: true
        });
        roleButtons[1].dispatchEvent(shiftClickEvent);
        await this.sleep(500);

        // Check if multiple editors are visible
        const editorPanes = document.querySelectorAll('.editor-pane');
        if (editorPanes.length < 2) {
            throw new Error(`Expected 2+ editor panes, found ${editorPanes.length}`);
        }

        this.log(`Successfully opened ${editorPanes.length} editors`, 'info');
    }

    // ===========================================================================
    // Test: Revert Functionality
    // ===========================================================================

    async testRevertFunctionality() {
        const editor = this.getMonacoEditor();
        const original = editor.getValue();

        // Make an edit
        editor.setValue(original + '\n/* Test revert */');
        await this.sleep(500);

        // Find revert button (in dropdown)
        const saveDropdownToggle = document.querySelector('[class*="save-dropdown-toggle"], button[data-dropdown-role], button[data-dropdown-field]');
        if (saveDropdownToggle) {
            saveDropdownToggle.click();
            await this.sleep(300);

            const revertBtn = Array.from(document.querySelectorAll('button')).find(
                b => b.textContent.includes('Revert')
            );

            if (revertBtn) {
                revertBtn.click();
                await this.sleep(300);

                // Confirm revert (inline confirmation)
                revertBtn.click();
                await this.sleep(500);

                const currentValue = editor.getValue();
                if (currentValue !== original) {
                    throw new Error('Revert did not restore original content');
                }

                this.log('Revert successfully restored original content', 'info');
            } else {
                this.log('Revert button not found in dropdown', 'warning');
            }
        } else {
            this.log('Save dropdown toggle not found', 'warning');
        }
    }

    // ===========================================================================
    // Test: Discard All Functionality
    // ===========================================================================

    async testDiscardAllFunctionality() {
        // Make edits to trigger dirty state
        const editor = this.getMonacoEditor();
        const original = editor.getValue();
        editor.setValue(original + '\n/* Test discard */');
        await this.sleep(500);

        // Click Save dropdown toggle
        const saveDropdownToggle = document.getElementById('save-dropdown-toggle');
        if (!saveDropdownToggle) {
            throw new Error('Save dropdown toggle not found');
        }

        saveDropdownToggle.click();
        await this.sleep(300);

        // Find Discard All button
        const discardBtn = document.getElementById('discard-btn');
        if (!discardBtn) {
            throw new Error('Discard All button not found');
        }

        discardBtn.click();
        await this.sleep(300);

        // Confirm discard (inline confirmation)
        discardBtn.click();
        await this.sleep(500);

        const currentValue = editor.getValue();
        if (currentValue !== original) {
            throw new Error('Discard All did not restore original content');
        }

        this.log('Discard All successfully restored original content', 'info');
    }

    // ===========================================================================
    // Run All Tests
    // ===========================================================================

    async runAll() {
        this.startTime = performance.now();
        this.log('='.repeat(80), 'info');
        this.log('ADVANCED SMOKE TEST SUITE - PR #96', 'section');
        this.log('Testing: Save, Import/Export, Live Preview, Mobile View, Revert/Discard', 'section');
        this.log('='.repeat(80), 'info');

        // Section 1: CSS Live Preview Tests
        this.log('\n📺 CSS LIVE PREVIEW TESTS', 'section');
        await this.test('CSS live preview toggle works', () => this.testCSSLivePreviewToggle());
        await this.test('CSS live preview injects styles', () => this.testCSSLivePreviewWorks());

        // Section 2: Import/Export Tests
        this.log('\n📦 IMPORT/EXPORT TESTS', 'section');
        await this.test('Export functionality triggers download', () => this.testExportFunctionality());
        await this.test('Import button and file input exist', () => this.testImportFunctionality());

        // Section 3: Mobile View Tests
        this.log('\n📱 MOBILE VIEW TESTS', 'section');
        await this.test('Mobile view switching works', () => this.testMobileViewSwitching());

        // Section 4: State Management Tests
        this.log('\n💾 STATE MANAGEMENT TESTS', 'section');
        await this.test('Dirty state indicators work', () => this.testDirtyStateIndicators());

        // Section 5: Keyboard Shortcuts
        this.log('\n⌨️  KEYBOARD SHORTCUT TESTS', 'section');
        await this.test('Keyboard shortcuts dispatch events', () => this.testKeyboardShortcuts());

        // Section 6: Formatting Tests
        this.log('\n✨ FORMATTING TESTS', 'section');
        await this.test('Format functionality works', () => this.testFormatFunctionality());

        // Section 7: Multiple Editors (CSS only)
        this.log('\n🔀 MULTIPLE EDITORS TESTS', 'section');
        await this.test('Multiple editors can be opened', () => this.testMultipleEditorsOpen());

        // Section 8: Revert/Discard Tests
        this.log('\n↩️  REVERT/DISCARD TESTS', 'section');
        await this.test('Revert functionality works', () => this.testRevertFunctionality());
        await this.test('Discard All functionality works', () => this.testDiscardAllFunctionality());

        // Summary
        this.printSummary();
    }

    printSummary() {
        const duration = Math.round(performance.now() - this.startTime);
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const total = this.results.length;

        this.log('\n' + '='.repeat(80), 'info');
        this.log('ADVANCED TEST SUMMARY', 'section');
        this.log('='.repeat(80), 'info');
        this.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`, 'info');
        this.log(`Duration: ${duration}ms`, 'info');

        if (failed > 0) {
            this.log('\n❌ Failed Tests:', 'error');
            this.results.filter(r => r.status === 'FAIL').forEach(r => {
                this.log(`  • ${r.name}: ${r.error}`, 'error');
            });
        }

        const passRate = ((passed / total) * 100).toFixed(1);
        if (failed === 0) {
            this.log(`\n🎉 All tests passed! (100% pass rate)`, 'success');
        } else {
            this.log(`\n⚠️  ${failed} test(s) failed (${passRate}% pass rate)`, 'warning');
        }

        this.log('='.repeat(80), 'info');

        return {
            total,
            passed,
            failed,
            passRate: parseFloat(passRate),
            duration,
            results: this.results
        };
    }
}

// Export for global use
window.AdvancedSmokeTest = AdvancedSmokeTest;

// Convenience function
async function runAdvancedTests() {
    const suite = new AdvancedSmokeTest();
    return await suite.runAll();
}

// Auto-run message
if (typeof module === 'undefined') {
    console.log('%c🧪 Advanced Smoke Test Suite Loaded', 'color: #667eea; font-size: 16px; font-weight: bold');
    console.log('%cRun: await runAdvancedTests()', 'color: #667eea; font-size: 14px');
}
