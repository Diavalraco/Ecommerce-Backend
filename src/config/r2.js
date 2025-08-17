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
function extractKey(fullUrl) {
  if (!fullUrl) return null;
  let pathname;
  try {
    pathname = new URL(fullUrl).pathname;
  } catch (e) {
    console.warn('Invalid URL passed to extractKey:', fullUrl);
    return null;
  }
  const segments = pathname.split('/');
  if (segments[1] !== bucketName) {
    console.warn(`URL bucket mismatch (expected "${bucketName}", got "${segments[1]}")`);
    return null;
  }
  const key = segments.slice(2).join('/');
  console.log(`Extracted key from URL: ${key}`);
  return key;
}

module.exports = {uploadImage, deleteImage, extractKey};
