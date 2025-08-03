const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const deleteImage = async publicId => {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary deletion error:', err);
    throw err;
  }
};

const extractPublicId = url => {
  if (!url) return null;
  const parts = url.split('/');
  const fileName = parts.pop();
  const publicId = fileName.split('.').shift();
  const folderIdx = parts.indexOf('blog-management');
  if (folderIdx >= 0) {
    return parts
      .slice(folderIdx)
      .concat(publicId)
      .join('/');
  }
  return publicId;
};

module.exports = {cloudinary, deleteImage, extractPublicId};
