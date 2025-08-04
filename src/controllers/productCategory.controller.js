const ProductCategory = require('../models/productCategory.model');
const path = require('path');
const catchAsync = require('../utils/catchAsync');
const httpStatus = require('http-status');
// const {cloudinary, deleteImage, extractPublicId} = require('../config/cloudinary');
const { uploadImage, deleteImage, extractKey } = require('../config/r2');

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
  let newKey = null;

  try {
    const {name, description, order} = req.body;

    let thumbnailUrl = null;
    if (req.file && req.file.buffer) {
      const ext = path.extname(req.file.originalname);
      newKey = `product-management/categories/${Date.now()}${ext}`;
      const result = await uploadImage({
        buffer: req.file.buffer,
        key: newKey,
        contentType: req.file.mimetype,
      });
      thumbnailUrl = result.url;
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      order: order ? parseInt(order, 10) : 0,
      thumbnail: thumbnailUrl,
    };

    const created = await ProductCategory.create(payload);

    return res.status(httpStatus.CREATED).json({
      status: true,
      message: 'ProductCategory created successfully',
      data: created,
    });
  } catch (err) {
    if (newKey) {
      await deleteImage(newKey);
    }
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Error creating ProductCategory',
      error: err.message,
    });
  }
});

const updateProductCategory = catchAsync(async (req, res) => {
  let newKey = null;
  const category = await ProductCategory.findById(req.params.id);

  if (!category) {
    return res.status(httpStatus.NOT_FOUND).json({
      status: false,
      message: 'ProductCategory not found',
    });
  }

  const oldThumbnail = category.thumbnail;

  try {
    const {name, description, order} = req.body;

    if (name !== undefined) category.name = name.trim();
    if (description !== undefined) category.description = description.trim();
    if (order !== undefined) category.order = parseInt(order, 10) || 0;

    if (req.file && req.file.buffer) {
      const ext = path.extname(req.file.originalname);
      newKey = `product-management/categories/${Date.now()}${ext}`;

      const result = await uploadImage({
        buffer: req.file.buffer,
        key: newKey,
        contentType: req.file.mimetype,
      });

      category.thumbnail = result.url;

      if (oldThumbnail) {
        const oldKey = extractKey(oldThumbnail);
        if (oldKey) await deleteImage(oldKey);
      }
    }

    await category.save();

    return res.status(httpStatus.OK).json({
      status: true,
      message: 'ProductCategory updated successfully',
      data: category,
    });
  } catch (err) {
    if (newKey) {
      await deleteImage(newKey);
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
    return res.status(httpStatus.NOT_FOUND).json({
      status: false,
      message: 'ProductCategory not found',
    });
  }

  if (category.thumbnail) {
    const key = extractKey(category.thumbnail);
    if (key) await deleteImage(key);
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
