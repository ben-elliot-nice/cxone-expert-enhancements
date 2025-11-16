/**
 * Expert Enhancements - Automated Smoke Test Suite
 *
 * Tests the DRY refactoring (PR #96) to ensure BaseEditor delegation works correctly
 * Run this script in the browser console on a CXone Expert site with the tool loaded
 *
 * Usage:
 * 1. Open browser DevTools console
 * 2. Copy and paste this entire script
 * 3. Run: await runSmokeTests()
 *
 * @version 1.0.0
 * @created 2025-01-11
 */

class ExpertEnhancementsSmokeTest {
    constructor() {
        this.results = [];
        this.startTime = null;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const styles = {
            info: 'color: #2196f3',
            success: 'color: #4caf50; font-weight: bold',
            error: 'color: #ff6b6b; font-weight: bold',
            warning: 'color: #ff9800'
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
    // Test: Application Loading
    // ===========================================================================

    async testApplicationLoaded() {
        const toggleBtn = document.querySelector('[description="CXone Expert Enhancements"]');
        if (!toggleBtn) throw new Error('Toggle button not found');

        // Check if overlay exists (may be hidden)
        const overlay = document.getElementById('expert-enhancements-overlay');
        if (!overlay) throw new Error('Overlay not found in DOM');
    }

    async testCSSEditorLoads() {
        // Switch to CSS Editor
        const appSelector = document.querySelector('select, [role="combobox"]');
        if (!appSelector) throw new Error('App selector not found');

        const cssOption = Array.from(appSelector.querySelectorAll('option')).find(
            opt => opt.value === 'CSS Editor'
        );
        if (!cssOption) throw new Error('CSS Editor option not found');

        // Verify all 6 role buttons exist
        await this.sleep(100);
        const roleButtons = ['All Roles', 'Anonymous', 'Community Member', 'Pro Member', 'Admin', 'Legacy Browser'];
        for (const label of roleButtons) {
            const btn = Array.from(document.querySelectorAll('button')).find(
                b => b.textContent === label
            );
            if (!btn) throw new Error(`Role button "${label}" not found`);
        }
    }

    async testHTMLEditorLoads() {
        // Verify both field buttons exist
        const fieldButtons = ['Page HTML Head', 'Page HTML Tail'];
        for (const label of fieldButtons) {
            const btn = Array.from(document.querySelectorAll('button')).find(
                b => b.textContent === label
            );
            if (!btn) throw new Error(`Field button "${label}" not found`);
        }
    }

    // ===========================================================================
    // Test: Monaco Editor Integration
    // ===========================================================================

    async testMonacoEditorExists() {
        if (!window.monaco) throw new Error('Monaco not loaded globally');

        const models = monaco.editor.getModels();
        if (!models || models.length === 0) {
            throw new Error('No Monaco editor models found');
        }
    }

    async testMonacoEditorEditable() {
        const models = monaco.editor.getModels();
        if (!models || models.length === 0) throw new Error('No editor models');

        const model = models[0];
        const originalValue = model.getValue();

        // Try to edit
        const testValue = originalValue + '\n/* Smoke test edit */';
        model.setValue(testValue);

        if (model.getValue() !== testValue) {
            throw new Error('Editor value did not update');
        }

        // Restore original
        model.setValue(originalValue);
    }

    // ===========================================================================
    // Test: BaseEditor Delegation (DRY Refactoring Verification)
    // ===========================================================================

    async testStateManagement() {
        // Check localStorage for app state
        const keys = Object.keys(localStorage);
        const stateKeys = keys.filter(k => k.includes('expertEnhancements'));

        if (stateKeys.length === 0) {
            throw new Error('No state keys found in localStorage');
        }

        this.log(`Found ${stateKeys.length} state keys in localStorage`, 'info');
    }

    async testUIComponents() {
        // Verify Save All button exists
        const saveAllBtn = Array.from(document.querySelectorAll('button')).find(
            b => b.textContent === 'Save All'
        );
        if (!saveAllBtn) throw new Error('Save All button not found');

        // Verify Actions dropdown exists
        const actionsBtn = Array.from(document.querySelectorAll('button')).find(
            b => b.textContent.includes('Actions')
        );
        if (!actionsBtn) throw new Error('Actions dropdown not found');
    }

    async testFormatterLoaded() {
        // Check if Prettier loaded
        if (!window.prettier) {
            throw new Error('Prettier not loaded globally');
        }
    }

    // ===========================================================================
    // Test: Console Errors
    // ===========================================================================

    async testNoConsoleErrors() {
        // This is a manual check - automated tests would need to monitor console
        this.log('Manual check: Review console for errors', 'warning');
    }

    // ===========================================================================
    // Run All Tests
    // ===========================================================================

    async runAll() {
        this.startTime = performance.now();
        this.log('='.repeat(60), 'info');
        this.log('Expert Enhancements Smoke Test Suite', 'info');
        this.log('Testing PR #96: DRY Refactoring with BaseEditor', 'info');
        this.log('='.repeat(60), 'info');

        // Application Loading Tests
        await this.test('Application loaded', () => this.testApplicationLoaded());
        await this.test('CSS Editor loads with 6 roles', () => this.testCSSEditorLoads());
        await this.test('HTML Editor loads with 2 fields', () => this.testHTMLEditorLoads());

        // Monaco Integration Tests
        await this.test('Monaco editor exists', () => this.testMonacoEditorExists());
        await this.test('Monaco editor is editable', () => this.testMonacoEditorEditable());

        // BaseEditor Delegation Tests (DRY verification)
        await this.test('State management works', () => this.testStateManagement());
        await this.test('UI components rendered', () => this.testUIComponents());
        await this.test('Code formatter loaded', () => this.testFormatterLoaded());

        // Summary
        this.printSummary();
    }

    printSummary() {
        const duration = Math.round(performance.now() - this.startTime);
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const total = this.results.length;

        this.log('='.repeat(60), 'info');
        this.log('Test Summary', 'info');
        this.log('='.repeat(60), 'info');
        this.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`, 'info');
        this.log(`Duration: ${duration}ms`, 'info');

        if (failed > 0) {
            this.log('\nFailed Tests:', 'error');
            this.results.filter(r => r.status === 'FAIL').forEach(r => {
                this.log(`  ❌ ${r.name}: ${r.error}`, 'error');
            });
        }

        if (failed === 0) {
            this.log('\n🎉 All tests passed!', 'success');
        } else {
            this.log(`\n⚠️  ${failed} test(s) failed`, 'error');
        }

        this.log('='.repeat(60), 'info');

        return {
            total,
            passed,
            failed,
            duration,
            results: this.results
        };
    }
}

// Export for global use
window.ExpertEnhancementsSmokeTest = ExpertEnhancementsSmokeTest;

// Convenience function
async function runSmokeTests() {
    const suite = new ExpertEnhancementsSmokeTest();
    return await suite.runAll();
}

// Auto-run if script is loaded directly
if (typeof module === 'undefined') {
    console.log('%c📋 Smoke Test Suite Loaded', 'color: #667eea; font-size: 16px; font-weight: bold');
    console.log('%cRun: await runSmokeTests()', 'color: #667eea; font-size: 14px');
}
