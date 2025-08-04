const catchAsync = require('../utils/catchAsync');
const httpStatus = require('http-status');
const path = require('path');
const {uploadImage, deleteImage} = require('../config/r2');

const uploadMedia = catchAsync(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'No file provided',
    });
  }

  const isVideo = req.file.mimetype.startsWith('video/');
  const folder = isVideo ? 'Website/videos' : 'website/images';

  const ext = path.extname(req.file.originalname);
  const key = `${folder}/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;

  let uploadedKey = null;
  try {
    const {url, key: newKey} = await uploadImage({
      buffer: req.file.buffer,
      key,
      contentType: req.file.mimetype,
    });
    uploadedKey = newKey;

    const data = {
      url,
      key: newKey,
      format: ext.replace(/^\./, ''),
      size: req.file.size,
    };

    return res.status(httpStatus.CREATED).json({
      success: true,
      message: isVideo ? 'Video uploaded successfully' : 'Image uploaded successfully',
      data,
    });
  } catch (err) {
    if (uploadedKey) {
      await deleteImage(uploadedKey);
    }
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error uploading file',
      error: err.message,
    });
  }
});

module.exports = {uploadMedia};
