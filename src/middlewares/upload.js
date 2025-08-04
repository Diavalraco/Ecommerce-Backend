const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    if (!isImage && !isVideo) {
      return cb(new Error('Only image and video files are allowed'), false);
    }
    cb(null, true);
  },
  limits: {fileSize: 100 * 1024 * 1024},
});

module.exports = upload;
