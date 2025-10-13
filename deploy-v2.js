#!/usr/bin/env node

import 'dotenv/config';
import { readFileSync, createReadStream, existsSync } from 'fs';
import { execSync } from 'child_process';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  bucket: process.env.DO_SPACES_BUCKET || 'benelliot-nice',
  endpoint: process.env.DO_SPACES_ENDPOINT || 'syd1.digitaloceanspaces.com',
  region: 'us-east-1',
  basePrefix: 'cxone-expert-enhancements',
  files: [
    { local: 'dist/css-editor.css', remote: 'css-editor.css', contentType: 'text/css' },
    { local: 'dist/css-editor.js', remote: 'css-editor.js', contentType: 'application/javascript' },
    { local: 'dist/css-editor-embed.js', remote: 'css-editor-embed.js', contentType: 'application/javascript' },
  ]
};

// ============================================================================
// Helper Functions
// ============================================================================

function log(message) {
  console.log(message);
}

function error(message) {
  console.error(`[ERROR] ${message}`);
}

function getCurrentBranch() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return branch;
  } catch (err) {
    return null;
  }
}

function getVersion() {
  try {
    if (!existsSync('package.json')) {
      return '0.0.0';
    }
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    return pkg.version || '0.0.0';
  } catch (err) {
    error(`Failed to read package.json: ${err.message}`);
    return '0.0.0';
  }
}

function sanitizeBranchName(branch) {
  return branch
    .replace(/[^a-zA-Z0-9-_\/]/g, '-')
    .toLowerCase();
}

function getDeploymentConfig() {
  const branch = process.env.GITHUB_REF_NAME || getCurrentBranch();

  if (!branch) {
    throw new Error('Cannot determine branch. Ensure you are in a git repository or set GITHUB_REF_NAME.');
  }

  const version = getVersion();

  log(`Branch: ${branch}`);
  log(`Version: ${version}`);

  let targets = [];

  if (branch === 'main') {
    targets = [
      { path: 'main', desc: 'Main branch', cache: 'no-cache' },
      { path: `releases/v${version}`, desc: `Version ${version}`, cache: 'immutable' },
      { path: 'latest', desc: 'Latest release', cache: 'no-cache' }
    ];
  } else if (branch === 'develop') {
    targets = [
      { path: 'develop', desc: 'Develop branch', cache: 'no-cache' }
    ];
  } else {
    // Any other branch - deploy to sanitized branch name
    const sanitized = sanitizeBranchName(branch);
    targets = [
      { path: sanitized, desc: `Branch: ${branch}`, cache: 'no-cache' }
    ];
  }

  return { branch, version, targets };
}

function getCacheControl(cacheType) {
  if (cacheType === 'immutable') {
    return 'public, max-age=31536000, immutable';
  }
  return 'no-cache, no-store, must-revalidate';
}

// ============================================================================
// S3 Upload
// ============================================================================

async function uploadFile(s3Client, localPath, remotePath, contentType, cacheControl) {
  if (!existsSync(localPath)) {
    throw new Error(`Local file not found: ${localPath}`);
  }

  log(`  Uploading: ${localPath} -> ${remotePath}`);

  const command = new PutObjectCommand({
    Bucket: CONFIG.bucket,
    Key: remotePath,
    Body: createReadStream(localPath),
    ACL: 'public-read',
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  await s3Client.send(command);

  const url = `https://${CONFIG.bucket}.${CONFIG.endpoint}/${remotePath}`;
  log(`  ✓ ${url}`);

  return url;
}

// ============================================================================
// Main Deploy
// ============================================================================

async function deploy() {
  log('');
  log('================================================================================');
  log('CXone Expert Enhancements - Deployment v2');
  log('================================================================================');
  log('');

  // Validate credentials
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('Missing AWS credentials. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
  }

  log(`Bucket: ${CONFIG.bucket}`);
  log(`Endpoint: ${CONFIG.endpoint}`);
  log(`Base Path: ${CONFIG.basePrefix}`);
  log('');

  // Initialize S3 client
  const s3Client = new S3Client({
    region: CONFIG.region,
    endpoint: `https://${CONFIG.endpoint}`,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  // Get deployment configuration
  const { branch, version, targets } = getDeploymentConfig();
  log('');
  log('Deployment Targets:');
  targets.forEach(t => log(`  - ${CONFIG.basePrefix}/${t.path}/ (${t.desc})`));
  log('');

  // Deploy to each target
  const deployedUrls = [];

  for (const target of targets) {
    log(`Deploying to: ${target.desc}`);
    log('--------------------------------------------------------------------------------');

    const cacheControl = getCacheControl(target.cache);

    for (const file of CONFIG.files) {
      const remotePath = `${CONFIG.basePrefix}/${target.path}/${file.remote}`;

      try {
        const url = await uploadFile(
          s3Client,
          file.local,
          remotePath,
          file.contentType,
          cacheControl
        );

        if (file.remote === 'css-editor-embed.js') {
          deployedUrls.push({ desc: target.desc, url });
        }
      } catch (err) {
        error(`Upload failed for ${file.local}: ${err.message}`);
        throw err;
      }
    }

    log('');
  }

  // Summary
  log('================================================================================');
  log('Deployment Complete!');
  log('================================================================================');
  log('');
  log('Embed Script URLs:');
  deployedUrls.forEach(({ desc, url }) => {
    log(`  ${desc}:`);
    log(`    <script src="${url}"></script>`);
    log('');
  });

  // GitHub Actions output
  if (process.env.GITHUB_ACTIONS === 'true') {
    const primaryUrl = deployedUrls[0]?.url || '';
    log(`::set-output name=deploy_url::${primaryUrl}`);
    log(`::set-output name=branch::${branch}`);
    log(`::set-output name=version::${version}`);
  }
}

// ============================================================================
// Run
// ============================================================================

(async () => {
  try {
    await deploy();
    process.exit(0);
  } catch (err) {
    log('');
    log('================================================================================');
    error('Deployment Failed');
    log('================================================================================');
    error(err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
})();
