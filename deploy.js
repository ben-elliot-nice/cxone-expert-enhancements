#!/usr/bin/env node

import 'dotenv/config';
import { readdirSync, statSync, createReadStream } from "fs";
import { join } from "path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env.DO_SPACES_BUCKET || 'benelliot-nice';
const endpoint = process.env.DO_SPACES_ENDPOINT || 'sgp1.digitaloceanspaces.com';

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: `https://${endpoint}`,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const distFiles = [
  { local: 'dist/css-editor.css', remote: 'media/misc/expert-css/css-editor.css', contentType: 'text/css' },
  { local: 'dist/css-editor.js', remote: 'media/misc/expert-css/css-editor.js', contentType: 'application/javascript' },
];

async function uploadFile(localPath, s3Key, contentType) {
  const localSize = statSync(localPath).size;
  let upload = false;

  try {
    const headResp = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: s3Key }));
    if (headResp.ContentLength !== localSize) {
      upload = true;
    } else {
      console.log(`[SKIP] ${s3Key} (unchanged)`);
    }
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      upload = true;
    } else {
      throw err;
    }
  }

  if (upload) {
    console.log(`[UPLOAD] ${localPath} -> ${s3Key}`);
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: createReadStream(localPath),
      ACL: "public-read",
      ContentType: contentType,
      CacheControl: 'public, max-age=3600',
    }));
    console.log(`[SUCCESS] Uploaded: ${s3Key}`);
  }
}

async function deploy() {
  console.log('[DEPLOY] Starting deployment to Digital Ocean Spaces...');
  console.log(`[CONFIG] Bucket: ${bucket}`);
  console.log(`[CONFIG] Endpoint: ${endpoint}`);
  console.log('');

  for (const file of distFiles) {
    await uploadFile(file.local, file.remote, file.contentType);
  }

  console.log('');
  console.log('[DEPLOY] Deployment complete!');
  console.log('');
  console.log('Files available at:');
  distFiles.forEach(file => {
    const url = `https://${bucket}.${endpoint}/${file.remote}`;
    console.log(`  ${url}`);
  });
}

(async () => {
  try {
    await deploy();
  } catch (err) {
    console.error('[ERROR] Deployment failed:', err);
    process.exit(1);
  }
})();
