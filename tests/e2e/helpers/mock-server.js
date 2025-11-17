import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Mock server for CXone Expert API
 */
export class CXoneAPIMock {
  constructor(page, options = {}) {
    this.page = page;
    this.mode = options.mode || process.env.TEST_MODE || 'mock';
    this.fixtures = this.loadFixtures();
    this.capturedRequests = [];
  }

  /**
   * Load all fixture files
   */
  loadFixtures() {
    const fixturesDir = path.join(__dirname, '../fixtures/api-responses');

    return {
      css: {
        loadAllRoles: this.loadJSON(path.join(fixturesDir, 'css/load-all-roles.json')),
        saveSuccess: this.loadJSON(path.join(fixturesDir, 'css/save-success.json')),
        saveError: this.loadJSON(path.join(fixturesDir, 'css/save-error.json'))
      },
      html: {
        loadBodyFooter: this.loadJSON(path.join(fixturesDir, 'html/load-body-footer.json')),
        saveSuccess: this.loadJSON(path.join(fixturesDir, 'html/save-success.json'))
      },
      csrf: {
        token: this.loadJSON(path.join(fixturesDir, 'csrf/token-response.json'))
      }
    };
  }

  /**
   * Load JSON file
   */
  loadJSON(filepath) {
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    } catch (error) {
      console.warn(`Could not load fixture: ${filepath}`);
      return null;
    }
  }

  /**
   * Enable API mocking
   */
  async enableMocking() {
    if (this.mode !== 'mock') {
      console.log('Running in REAL mode - API calls will hit actual endpoints');
      return;
    }

    // Mock CSS load
    await this.page.route('**/api/css/load', (route) => {
      this.capturedRequests.push({
        url: route.request().url(),
        method: route.request().method()
      });

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(this.fixtures.css.loadAllRoles)
      });
    });

    // Mock CSS save (actual endpoint used by CSS editor)
    await this.page.route('**/deki/cp/custom_css.php**', async (route) => {
      const postData = route.request().postData();

      this.capturedRequests.push({
        url: route.request().url(),
        method: route.request().method(),
        payload: postData
      });

      // Deki form posts return a redirect
      route.fulfill({
        status: 302,
        headers: {
          'Location': route.request().url()
        }
      });
    });

    // Mock HTML load
    await this.page.route('**/api/html/load', (route) => {
      this.capturedRequests.push({
        url: route.request().url(),
        method: route.request().method()
      });

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(this.fixtures.html.loadBodyFooter)
      });
    });

    // Mock HTML save
    await this.page.route('**/api/html/save', async (route) => {
      const postData = route.request().postDataJSON();

      this.capturedRequests.push({
        url: route.request().url(),
        method: route.request().method(),
        payload: postData
      });

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(this.fixtures.html.saveSuccess)
      });
    });

    // Mock actual HTML editor endpoint
    await this.page.route('**/deki/cp/custom_html.php**', async (route) => {
      const postData = route.request().postData();

      this.capturedRequests.push({
        url: route.request().url(),
        method: route.request().method(),
        payload: postData
      });

      // Deki form posts return a redirect
      route.fulfill({
        status: 302,
        headers: {
          'Location': route.request().url()
        }
      });
    });

    // Mock CSRF token
    await this.page.route('**/api/csrf-token', (route) => {
      this.capturedRequests.push({
        url: route.request().url(),
        method: route.request().method()
      });

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(this.fixtures.csrf.token)
      });
    });
  }

  /**
   * Inject errors on specific endpoints
   */
  async injectError(endpoint, errorType = '500') {
    await this.page.route(`**${endpoint}`, (route) => {
      if (errorType === 'timeout') {
        // Don't respond - simulates timeout
        return;
      }

      const statusCode = parseInt(errorType) || 500;

      route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: `Mock ${errorType} error`
        })
      });
    });
  }

  /**
   * Get captured requests
   */
  getRequests(filterURL = null) {
    if (filterURL) {
      return this.capturedRequests.filter(req => req.url.includes(filterURL));
    }
    return this.capturedRequests;
  }

  /**
   * Clear captured requests
   */
  clearRequests() {
    this.capturedRequests = [];
  }
}
