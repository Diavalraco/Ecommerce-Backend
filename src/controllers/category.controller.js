const Category = require('../models/category.model');
const Blog = require('../models/blog.model');
const Topic = require('../models/topic.model');
const path = require('path');
// const {cloudinary, deleteImage, extractPublicId} = require('../config/cloudinary');
const {uploadImage, deleteImage, extractKey} = require('../config/r2');
const catchAsync = require('../utils/catchAsync');
const httpStatus = require('http-status');

const getAllCategories = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', status, featured, popular} = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (search.trim() !== '') {
    query.name = {$regex: search.trim(), $options: 'i'};
  }
  if (status) {
    query.status = status;
  }
  if (featured === 'true') {
    query.featured = true;
  }
  if (popular === 'true') {
    query.popular = true;
  }

  const categories = await Category.find(query)
    .sort({order: 1, createdAt: -1})
    .skip(skip)
    .limit(limitNum);

  const totalCount = await Category.countDocuments(query);

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

const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({success: false, message: 'Category not found'});
    res.json({success: true, data: category});
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message,
    });
  }
};

const createCategory = catchAsync(async (req, res) => {
  let newKey = null;

  try {
    const {name, status, featured, popular, order} = req.body;

    let signedUrl = null;

    if (req.file && req.file.buffer) {
      const ext = path.extname(req.file.originalname);
      newKey = `blog-management/categories/${Date.now()}${ext}`;
      const result = await uploadImage({
        buffer: req.file.buffer,
        key: newKey,
        contentType: req.file.mimetype,
      });
      signedUrl = result.url;
    }

    const category = new Category({
      name,
      status: status || 'active',
      featured: featured === 'true',
      popular: popular === 'true',
      order: parseInt(order, 10) || 0,
      image: signedUrl,
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (error) {
    if (newKey) {
      await deleteImage(newKey);
    }
    res.status(400).json({
      success: false,
      message: 'Error creating category',
      error: error.message,
    });
  }
});

const updateCategory = catchAsync(async (req, res) => {
  let newKey = null;

  try {
    const {name, status, featured, popular, order} = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(httpStatus.NOT_FOUND).json({success: false, message: 'Category not found'});
    }

    const oldImageUrl = category.image;

    category.name = name || category.name;
    category.status = status || category.status;
    category.featured = featured !== undefined ? featured === 'true' : category.featured;
    category.popular = popular !== undefined ? popular === 'true' : category.popular;
    category.order = order !== undefined ? parseInt(order, 10) : category.order;

    if (req.file && req.file.buffer) {
      const ext = path.extname(req.file.originalname);
      newKey = `blog-management/categories/${Date.now()}${ext}`;

      const result = await uploadImage({
        buffer: req.file.buffer,
        key: newKey,
        contentType: req.file.mimetype,
      });
      category.image = result.url;

      if (oldImageUrl) {
        const oldKey = extractKey(oldImageUrl);
        if (oldKey) await deleteImage(oldKey);
      }
    }

    await category.save();

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  } catch (error) {
    if (newKey) {
      await deleteImage(newKey);
    }
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Error updating category',
      error: error.message,
    });
  }
});

const deleteCategory = catchAsync(async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(httpStatus.NOT_FOUND).json({success: false, message: 'Category not found'});
    }

    const blogCount = await Blog.countDocuments({categories: req.params.id});
    const topicCount = await Topic.countDocuments({categories: req.params.id});
    if (blogCount > 0 || topicCount > 0) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Cannot delete category. Category has associated blogs or topics.',
      });
    }

    if (category.image) {
      const key = extractKey(category.image);
      if (key) await deleteImage(key);
    }

    await category.deleteOne();
    res.json({success: true, message: 'Category deleted successfully'});
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error deleting category',
      error: error.message,
    });
  }
});

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
