const {URL} = require('url');
const {S3Client, PutObjectCommand, DeleteObjectCommand} = require('@aws-sdk/client-s3');
const {GetObjectCommand} = require('@aws-sdk/client-s3');
const {getSignedUrl} = require('@aws-sdk/s3-request-presigner');
const config = require('./config');

const {bucketName, endpoint, accessKeyId, secretAccessKey, publicBaseUrl} = config.cloudflare.r2;

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {accessKeyId, secretAccessKey},
  forcePathStyle: true,
});

async function uploadImage({buffer, key, contentType}) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    })
  );

  const getCmd = new GetObjectCommand({Bucket: bucketName, Key: key});
  const url = await getSignedUrl(s3, getCmd, {expiresIn: 3600});
  // return {url, key};
  const publicUrl = `${publicBaseUrl}/${key}`;
  return {url: publicUrl, key};
}

async function deleteImage(key) {
  if (!key) {
    return;
  }
  try {
    await s3.send(new DeleteObjectCommand({Bucket: bucketName, Key: key}));
  } catch (err) {
    console.error('R2 deletion error:', err);
    throw err;
  }
}
function extractKey(fullUrl, bucketName) {
  if (!fullUrl) return null;

  try {
    const url = new URL(fullUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    if (bucketName) {
      if (url.hostname.includes(bucketName)) {
        const key = segments.join('/');
        console.log('Hostname matched bucketName; extracted key:', key);
        return key || null;
      }
      const idx = segments.indexOf(bucketName);
      if (idx !== -1) {
        const key = segments.slice(idx + 1).join('/');
        console.log('Found bucketName in path; extracted key:', key);
        return key || null;
      }
      console.warn(`Bucket "${bucketName}" not found in hostname or path — returning full path as key.`);
      return segments.join('/') || null;
    }
    const key = segments.join('/');
    console.log('Extracted key (no bucketName provided):', key);
    return key || null;
  } catch (e) {
    console.warn('Invalid URL passed to extractKey:', fullUrl, e);
    return null;
  }
}

module.exports = {uploadImage, deleteImage, extractKey};
