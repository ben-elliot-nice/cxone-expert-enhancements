#!/usr/bin/env node

import 'dotenv/config';
import { execSync } from 'child_process';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  bucket: process.env.DO_SPACES_BUCKET || 'benelliot-nice',
  endpoint: process.env.DO_SPACES_ENDPOINT || 'syd1.digitaloceanspaces.com',
  region: 'us-east-1',
  basePrefix: 'cxone-expert-enhancements',
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

function sanitizeBranchName(branch) {
  return branch
    .replace(/^feature\//, '')
    .replace(/[^a-zA-Z0-9-_\/]/g, '-')
    .toLowerCase();
}

function getFeaturePath() {
  // Get branch from environment (GitHub Actions provides GITHUB_HEAD_REF for PRs)
  const branch = process.env.GITHUB_HEAD_REF || process.argv[2];

  if (!branch) {
    throw new Error('No branch specified. Set GITHUB_HEAD_REF or pass branch name as argument.');
  }

  if (!branch.startsWith('feature/')) {
    throw new Error(`Branch "${branch}" is not a feature branch. Only feature/* branches can be cleaned up.`);
  }

  const featureName = sanitizeBranchName(branch);
  const path = `${CONFIG.basePrefix}/feature/${featureName}/`;

  return { branch, featureName, path };
}

// ============================================================================
// S3 Cleanup
// ============================================================================

async function listObjects(s3Client, prefix) {
  const command = new ListObjectsV2Command({
    Bucket: CONFIG.bucket,
    Prefix: prefix,
  });

  const response = await s3Client.send(command);
  return response.Contents || [];
}

async function deleteObjects(s3Client, keys) {
  if (keys.length === 0) {
    log('No objects to delete');
    return;
  }

  const command = new DeleteObjectsCommand({
    Bucket: CONFIG.bucket,
    Delete: {
      Objects: keys.map(key => ({ Key: key })),
    },
  });

  const response = await s3Client.send(command);
  return response.Deleted || [];
}

// ============================================================================
// Main Cleanup
// ============================================================================

async function cleanup() {
  log('');
  log('================================================================================');
  log('Feature Deployment Cleanup');
  log('================================================================================');
  log('');

  // Validate credentials
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('Missing AWS credentials. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
  }

  log(`Bucket: ${CONFIG.bucket}`);
  log(`Endpoint: ${CONFIG.endpoint}`);
  log('');

  // Get feature path
  const { branch, featureName, path } = getFeaturePath();

  log(`Branch: ${branch}`);
  log(`Feature: ${featureName}`);
  log(`Path to clean: ${path}`);
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

  // List objects
  log('Listing objects...');
  const objects = await listObjects(s3Client, path);

  if (objects.length === 0) {
    log('No objects found - path may already be clean or never existed');
    log('');
    log('================================================================================');
    log('Cleanup Complete (nothing to delete)');
    log('================================================================================');
    return;
  }

  log(`Found ${objects.length} objects to delete:`);
  objects.forEach(obj => log(`  - ${obj.Key}`));
  log('');

  // Delete objects
  log('Deleting objects...');
  const keys = objects.map(obj => obj.Key);
  const deleted = await deleteObjects(s3Client, keys);

  log(`Successfully deleted ${deleted.length} objects`);
  log('');

  // Summary
  log('================================================================================');
  log('Cleanup Complete!');
  log('================================================================================');
  log('');
  log(`Removed deployment path: ${path}`);
  log('');

  // GitHub Actions output
  if (process.env.GITHUB_ACTIONS === 'true') {
    log(`::set-output name=cleaned_path::${path}`);
    log(`::set-output name=branch::${branch}`);
    log(`::set-output name=deleted_count::${deleted.length}`);
  }
}

// ============================================================================
// Run
// ============================================================================

(async () => {
  try {
    await cleanup();
    process.exit(0);
  } catch (err) {
    log('');
    log('================================================================================');
    error('Cleanup Failed');
    log('================================================================================');
    error(err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
})();
