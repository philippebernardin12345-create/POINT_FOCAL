// src/modules/storage/s3.service.js
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET;
const DEFAULT_EXPIRES = Number(process.env.S3_PRESIGN_EXPIRES || 300); // secondes
const UPLOAD_PREFIX = process.env.S3_UPLOAD_PREFIX || '';

if (!REGION || !BUCKET) {
  console.warn('[s3.service] AWS_REGION or S3_BUCKET not configured. S3 operations will fail if used.');
}

const s3 = new S3Client({ region: REGION });

async function getUploadSignedUrl({ Key, ContentType, expiresIn = DEFAULT_EXPIRES }) {
  if (!Key || !ContentType) throw new Error('Key et ContentType requis pour presign.');
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key,
    ContentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn });
}

async function getDownloadSignedUrl({ Key, expiresIn = DEFAULT_EXPIRES }) {
  if (!Key) throw new Error('Key requis pour presign GET.');
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

async function uploadBuffer({ Key, Body, ContentType }) {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key,
    Body,
    ContentType,
  });
  await s3.send(cmd);
  return { Bucket: BUCKET, Key };
}

function makeKey({ target = '', resourceId = 'misc', filename = '' }) {
  const safeTarget = String(target || '').replace(/^\/+|\/+$$/g, '');
  const safeFile = String(filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `$${UPLOAD_PREFIX}$${safeTarget ? `$${safeTarget}/` : ''}$${resourceId}/$${Date.now()}-${safeFile}`;
}

module.exports = {
  getUploadSignedUrl,
  getDownloadSignedUrl,
  uploadBuffer,
  makeKey,
};