const Category = require('../models/category.model');
const Blog = require('../models/blog.model');
const Topic = require('../models/topic.model');
const { deleteImage, extractPublicId } = require('../config/cloudinary');

const getAllCategories = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, featured, popular } = req.query;
    const query = {};
    if (search)    query.name = { $regex: search, $options: 'i' };
    if (status)    query.status = status;
    if (featured === 'true') query.featured = true;
    if (popular === 'true')  query.popular = true;

    const categories = await Category.find(query)
      .sort({ order: 1, createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Category.countDocuments(query);

    res.json({
      success: true,
      data: categories,
      pagination: {
        current: Number(page),
        total: Math.ceil(total / Number(limit)),
        count: categories.length,
        totalRecords: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message
    });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, status, featured, popular, order } = req.body;
    const category = new Category({
      name,
      status: status || 'active',
      featured: featured === 'true',
      popular: popular === 'true',
      order: order || 0,
      image: req.file ? req.file.path : undefined
    });
    await category.save();
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    if (req.file) {
      const publicId = extractPublicId(req.file.path);
      if (publicId) await deleteImage(publicId);
    }
    res.status(400).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { name, status, featured, popular, order } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    const oldImage = category.image;
    category.name     = name     || category.name;
    category.status   = status   || category.status;
    category.featured = featured !== undefined ? featured === 'true' : category.featured;
    category.popular  = popular  !== undefined ? popular === 'true' : category.popular;
    category.order    = order    !== undefined ? order : category.order;
    if (req.file) {
      category.image = req.file.path;
      if (oldImage) {
        const publicId = extractPublicId(oldImage);
        if (publicId) await deleteImage(publicId);
      }
    }

    await category.save();
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    if (req.file) {
      const publicId = extractPublicId(req.file.path);
      if (publicId) await deleteImage(publicId);
    }
    res.status(400).json({
      success: false,
      message: 'Error updating category',
      error: error.message
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    const blogCount = await Blog.countDocuments({ categories: req.params.id });
    const topicCount = await Topic.countDocuments({ categories: req.params.id });
    if (blogCount > 0 || topicCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category. Category has associated blogs or topics.'
      });
    }

    if (category.image) {
      const publicId = extractPublicId(category.image);
      if (publicId) await deleteImage(publicId);
    }

    await category.deleteOne();
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message
    });
  }
};

const toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    category.status = category.status === 'active' ? 'inactive' : 'active';
    await category.save();
    res.json({
      success: true,
      message: `Category ${category.status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating category status',
      error: error.message
    });
  }
};

const toggleCategoryFeatured = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    category.featured = !category.featured;
    await category.save();
    res.json({
      success: true,
      message: `Category ${category.featured ? 'featured' : 'unfeatured'} successfully`,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating category featured status',
      error: error.message
    });
  }
};

const toggleCategoryPopular = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    category.popular = !category.popular;
    await category.save();
    res.json({
      success: true,
      message: `Category ${category.popular ? 'marked as popular' : 'unmarked as popular'} successfully`,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating category popular status',
      error: error.message
    });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  toggleCategoryFeatured,
  toggleCategoryPopular
};
