const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const deleteImage = async publicId => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
};

const extractPublicId = url => {
  if (!url) return null;

  const parts = url.split('/');
  const fileName = parts[parts.length - 1];
  const publicId = fileName.split('.')[0];

  const folderIndex = parts.findIndex(part => part === 'blog-management');
  if (folderIndex !== -1) {
    const folderPath = parts.slice(folderIndex, -1).join('/');
    return `${folderPath}/${publicId}`;
  }

  return publicId;
};

module.exports = cloudinary;
module.exports.deleteImage = deleteImage;
module.exports.extractPublicId = extractPublicId;
