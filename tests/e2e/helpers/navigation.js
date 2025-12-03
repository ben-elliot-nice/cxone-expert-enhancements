/**
 * Navigate to the test page with appropriate embed URL
 * @param {import('@playwright/test').Page} page
 */
export async function navigateToTestPage(page) {
  // Add cache-busting parameter to force fresh page load and clear all state
  // This prevents event listeners and global state from leaking between tests
  const cacheBuster = `_t=${Date.now()}`;

  const sanitizeBranch = (value) =>
    (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9-_\/]/g, '-');

  if (process.env.CI) {
    // CI: Load test page with deployed embed.js from DO Spaces
    const bucket = process.env.DO_SPACES_BUCKET || 'cxone-expert-enhancements.syd1';
    const endpoint = process.env.DO_SPACES_ENDPOINT || 'digitaloceanspaces.com';
    const sourceBranch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'develop';
    const branchSlug = process.env.DEPLOYMENT_BRANCH_SLUG || sanitizeBranch(sourceBranch);
    const embedUrl = process.env.EMBED_URL ||
      `https://${bucket}.${endpoint}/cxone-expert-enhancements/${branchSlug}/embed.js`;

    const baseURL = process.env.BASE_URL || 'http://localhost:8080/test-page.html';
    await page.goto(`${baseURL}?embedUrl=${encodeURIComponent(embedUrl)}&${cacheBuster}`);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(200);

    console.log('CI mode: Loading test page with deployed script:', embedUrl);
  } else {
    // Local dev: Vite dev server serves everything
    const baseURL = process.env.BASE_URL || 'http://localhost:5173';
    await page.goto(`${baseURL}?${cacheBuster}`);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(100);

    console.log('Dev mode: Loading from vite dev server:', baseURL);
  }
}
