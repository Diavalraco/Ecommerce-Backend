// controllers/productCategory.controller.js
const ProductCategory = require('../models/productCategory.model');
const catchAsync = require('../utils/catchAsync');
const httpStatus = require('http-status');
const {cloudinary, deleteImage, extractPublicId} = require('../config/cloudinary');

const getAllProductCategories = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', sort = 'new_to_old'} = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (search.trim()) {
    query.$text = {$search: search.trim()};
  }

  const sortObj = {order: 1};
  if (sort === 'old_to_new') {
    sortObj.createdAt = 1;
  } else {
    sortObj.createdAt = -1;
  }

  const [categories, totalCount] = await Promise.all([
    ProductCategory.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum),
    ProductCategory.countDocuments(query),
  ]);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: categories,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
  });
});

const getProductCategoryById = catchAsync(async (req, res) => {
  const category = await ProductCategory.findById(req.params.id);
  if (!category) {
    return res.status(httpStatus.NOT_FOUND).json({status: false, message: 'ProductCategory not found'});
  }
  res.status(httpStatus.OK).json({status: true, data: category});
});

const createProductCategory = catchAsync(async (req, res) => {
  let thumbnailUrl;
  try {
    if (req.file && req.file.buffer) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({folder: 'product-management/categories'}, (err, uploaded) =>
          err ? reject(err) : resolve(uploaded)
        );
        stream.end(req.file.buffer);
      });
      thumbnailUrl = result.secure_url;
    }

    const payload = {
      name: req.body.name.trim(),
      description: req.body.description.trim(),
      order: req.body.order ? parseInt(req.body.order, 10) : 0,
      thumbnail: thumbnailUrl,
    };

    const created = await ProductCategory.create(payload);

    return res.status(httpStatus.CREATED).json({
      status: true,
      message: 'ProductCategory created successfully',
      data: created,
    });
  } catch (err) {
    if (thumbnailUrl) {
      const publicId = extractPublicId(thumbnailUrl);
      if (publicId) await deleteImage(publicId);
    }
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Error creating ProductCategory',
      error: err.message,
    });
  }
});

const updateProductCategory = catchAsync(async (req, res) => {
  const category = await ProductCategory.findById(req.params.id);
  if (!category) {
    return res.status(httpStatus.NOT_FOUND).json({status: false, message: 'ProductCategory not found'});
  }

  let newThumbnailUrl;
  const oldThumbnail = category.thumbnail;

  try {
    if (req.body.name !== undefined) {
      category.name = req.body.name.trim();
    }
    if (req.body.description !== undefined) {
      category.description = req.body.description.trim();
    }
    if (req.body.order !== undefined) {
      category.order = parseInt(req.body.order, 10) || 0;
    }

    if (req.file && req.file.buffer) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({folder: 'product-management/categories'}, (err, uploaded) =>
          err ? reject(err) : resolve(uploaded)
        );
        stream.end(req.file.buffer);
      });
      newThumbnailUrl = result.secure_url;
      category.thumbnail = newThumbnailUrl;

      if (oldThumbnail) {
        const oldPubId = extractPublicId(oldThumbnail);
        if (oldPubId) await deleteImage(oldPubId);
      }
    }

    await category.save();

    return res.status(httpStatus.OK).json({
      status: true,
      message: 'ProductCategory updated successfully',
      data: category,
    });
  } catch (err) {
    if (newThumbnailUrl) {
      const pubId = extractPublicId(newThumbnailUrl);
      if (pubId) await deleteImage(pubId);
    }
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Error updating ProductCategory',
      error: err.message,
    });
  }
});

const deleteProductCategory = catchAsync(async (req, res) => {
  const category = await ProductCategory.findById(req.params.id);
  if (!category) {
    return res.status(httpStatus.NOT_FOUND).json({status: false, message: 'ProductCategory not found'});
  }

  if (category.thumbnail) {
    const publicId = extractPublicId(category.thumbnail);
    if (publicId) {
      await deleteImage(publicId);
    }
  }

  await category.deleteOne();

  return res.status(httpStatus.OK).json({
    status: true,
    message: 'ProductCategory deleted successfully',
    data: category,
  });
});

module.exports = {
  getAllProductCategories,
  getProductCategoryById,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
};
