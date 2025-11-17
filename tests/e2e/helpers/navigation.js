/**
 * Navigate to the test page with appropriate embed URL
 * @param {import('@playwright/test').Page} page
 */
export async function navigateToTestPage(page) {
  if (process.env.CI) {
    // CI: Load test page with deployed embed.js from DO Spaces
    const bucket = process.env.DO_SPACES_BUCKET || 'cxone-expert-enhancements.syd1';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'digitaloceanspaces.com';
    const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'develop';
    const embedUrl = `https://${bucket}.${endpoint}/cxone-expert-enhancements/${branch}/embed.js`;

    const baseURL = process.env.BASE_URL || 'http://localhost:8080/test-page.html';
    await page.goto(`${baseURL}?embedUrl=${encodeURIComponent(embedUrl)}`);

    console.log('CI mode: Loading test page with deployed script:', embedUrl);
  } else {
    // Local dev: Vite dev server serves everything
    const baseURL = process.env.BASE_URL || 'http://localhost:5173';
    await page.goto(baseURL);

    console.log('Dev mode: Loading from vite dev server:', baseURL);
  }
}
