const catchAsync = require('../utils/catchAsync');
const httpStatus = require('http-status');
const {cloudinary, extractPublicId, deleteImage} = require('../config/cloudinary');

const uploadMedia = catchAsync(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'No file provided',
    });
  }

  const isVideo = req.file.mimetype.startsWith('video/');
  const resourceType = isVideo ? 'video' : 'image';
  const folder = isVideo ? 'blog-management/videos' : 'blog-management/images';

  let publicId;

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({resource_type: resourceType, folder}, (err, uploaded) =>
        err ? reject(err) : resolve(uploaded)
      );
      stream.end(req.file.buffer);
    });

    publicId = result.public_id;
    const data = {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      size: result.bytes,
    };
    if (isVideo) data.duration = result.duration;
    else Object.assign(data, {width: result.width, height: result.height});

    return res.status(httpStatus.CREATED).json({
      success: true,
      message: isVideo ? 'Video uploaded successfully' : 'Image uploaded successfully',
      data,
    });
  } catch (err) {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, {resource_type});
    }
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error uploading file',
      error: err.message,
    });
  }
});

module.exports = {uploadMedia};
