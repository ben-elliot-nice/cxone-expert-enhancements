#!/usr/bin/env node

import 'dotenv/config';
import { readFileSync, createReadStream } from 'fs';
import { execSync } from 'child_process';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// ============================================================================
// Configuration
// ============================================================================

const bucket = process.env.DO_SPACES_BUCKET || 'benelliot-nice';
const endpoint = process.env.DO_SPACES_ENDPOINT || 'sgp1.digitaloceanspaces.com';
const basePrefix = 'media/misc/expert-css';

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: `https://${endpoint}`,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Files to deploy
const distFiles = [
  { local: 'dist/css-editor.css', filename: 'css-editor.css', contentType: 'text/css' },
  { local: 'dist/css-editor.js', filename: 'css-editor.js', contentType: 'application/javascript' },
  { local: 'dist/css-editor-embed.js', filename: 'css-editor-embed.js', contentType: 'application/javascript' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current git branch name
 */
function getCurrentGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.warn('[WARN] Could not detect git branch:', error.message);
    return null;
  }
}

/**
 * Read version from package.json
 */
function getPackageVersion() {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    return packageJson.version;
  } catch (error) {
    console.warn('[WARN] Could not read package.json version:', error.message);
    return '0.0.0';
  }
}

/**
 * Sanitize branch name for use in S3 path
 */
function sanitizeBranchName(branch) {
  return branch
    .replace(/[^a-zA-Z0-9-_\/]/g, '-')
    .replace(/^feature\//, '')
    .toLowerCase();
}

/**
 * Determine deployment paths based on environment
 */
function calculateDeployPaths() {
  // Detect branch from GitHub Actions or git
  const branch = process.env.GITHUB_REF_NAME || getCurrentGitBranch();
  const version = getPackageVersion();

  if (!branch) {
    throw new Error('Could not detect branch name. Set GITHUB_REF_NAME or run from git repository.');
  }

  console.log(`[INFO] Detected branch: ${branch}`);
  console.log(`[INFO] Package version: ${version}`);

  const isMainBranch = branch === 'main';
  const isDevelopBranch = branch === 'develop';
  const isFeatureBranch = branch.startsWith('feature/');

  let deployPaths = [];

  if (isMainBranch) {
    // Main branch deploys to 3 locations:
    // 1. main/ - current main branch
    // 2. v{version}/ - pinned version
    // 3. latest/ - always points to latest release
    deployPaths = [
      { path: 'main', description: 'Main branch' },
      { path: `v${version}`, description: `Version ${version} (pinned)` },
      { path: 'latest', description: 'Latest release' }
    ];
  } else if (isDevelopBranch) {
    // Develop branch deploys to develop/
    deployPaths = [
      { path: 'develop', description: 'Development branch' }
    ];
  } else if (isFeatureBranch) {
    // Feature branches deploy to feature/{name}/
    const featureName = sanitizeBranchName(branch.replace('feature/', ''));
    deployPaths = [
      { path: `feature/${featureName}`, description: `Feature: ${branch}` }
    ];
  } else {
    // Fallback: deploy to sanitized branch name
    const sanitized = sanitizeBranchName(branch);
    deployPaths = [
      { path: sanitized, description: `Branch: ${branch}` }
    ];
  }

  return { branch, version, deployPaths };
}

/**
 * Get cache control header based on deployment path
 */
function getCacheControl(deployPath) {
  // Versioned releases are immutable - cache forever
  if (deployPath.startsWith('v')) {
    return 'public, max-age=31536000, immutable';
  }

  // Everything else: no cache (develop, feature, latest, main)
  return 'no-cache, no-store, must-revalidate';
}

/**
 * Upload a file to S3
 */
async function uploadFile(localPath, s3Key, contentType, cacheControl) {
  console.log(`[UPLOAD] ${localPath} -> ${s3Key}`);

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: createReadStream(localPath),
    ACL: "public-read",
    ContentType: contentType,
    CacheControl: cacheControl,
  }));

  const url = `https://${bucket}.${endpoint}/${s3Key}`;
  console.log(`[SUCCESS] ${url}`);
  return url;
}

// ============================================================================
// Main Deployment
// ============================================================================

async function deploy() {
  console.log('');
  console.log('='.repeat(80));
  console.log('CXone Expert Enhancements - Deployment');
  console.log('='.repeat(80));
  console.log('');

  // Validate credentials
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('Missing AWS credentials. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
  }

  console.log(`[CONFIG] Bucket: ${bucket}`);
  console.log(`[CONFIG] Endpoint: ${endpoint}`);
  console.log(`[CONFIG] Base prefix: ${basePrefix}`);
  console.log('');

  // Calculate deployment paths
  const { branch, version, deployPaths } = calculateDeployPaths();

  console.log('[DEPLOY] Target deployment paths:');
  deployPaths.forEach(({ path, description }) => {
    console.log(`  - ${basePrefix}/${path}/ (${description})`);
  });
  console.log('');

  // Deploy to each target path
  const deployedUrls = [];

  for (const { path, description } of deployPaths) {
    console.log(`[DEPLOY] Deploying to: ${description}`);
    console.log('-'.repeat(80));

    const cacheControl = getCacheControl(path);

    for (const file of distFiles) {
      const s3Key = `${basePrefix}/${path}/${file.filename}`;
      const url = await uploadFile(file.local, s3Key, file.contentType, cacheControl);

      // Store embed URL for summary
      if (file.filename === 'css-editor-embed.js') {
        deployedUrls.push({ description, url });
      }
    }

    console.log('');
  }

  // Print summary
  console.log('='.repeat(80));
  console.log('Deployment Complete!');
  console.log('='.repeat(80));
  console.log('');
  console.log('Embed script URLs:');
  deployedUrls.forEach(({ description, url }) => {
    console.log(`  ${description}:`);
    console.log(`    <script src="${url}"></script>`);
    console.log('');
  });

  // GitHub Actions output (for PR comments)
  if (process.env.GITHUB_ACTIONS === 'true') {
    const primaryUrl = deployedUrls[0]?.url || '';
    console.log(`::set-output name=deploy_url::${primaryUrl}`);
    console.log(`::set-output name=branch::${branch}`);
    console.log(`::set-output name=version::${version}`);
  }
}

// ============================================================================
// Run
// ============================================================================

(async () => {
  try {
    await deploy();
  } catch (err) {
    console.error('');
    console.error('='.repeat(80));
    console.error('[ERROR] Deployment failed');
    console.error('='.repeat(80));
    console.error(err);
    process.exit(1);
  }
})();
