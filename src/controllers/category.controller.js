const Category = require('../models/category.model');
const Blog = require('../models/blog.model');
const Topic = require('../models/topic.model');
const {cloudinary, deleteImage, extractPublicId} = require('../config/cloudinary');
const catchAsync = require('../utils/catchAsync');
const httpStatus = require('http-status');

const getAllCategories = catchAsync(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      featured,
      popular,
    } = req.query;
  
    const pageNum  = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip     = (pageNum - 1) * limitNum;
  
    const query = {};
    if (search.trim() !== '') {
      query.name = { $regex: search.trim(), $options: 'i' };
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
      .sort({ order: 1, createdAt: -1 })
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
  let uploadedUrl = null;

  try {
    const {name, status, featured, popular, order} = req.body;

    if (req.file && req.file.buffer) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({folder: 'blog-management/categories'}, (err, uploaded) =>
          err ? reject(err) : resolve(uploaded)
        );
        stream.end(req.file.buffer);
      });
      uploadedUrl = result.secure_url;
    }

    const category = new Category({
      name,
      status: status || 'active',
      featured: featured === 'true',
      popular: popular === 'true',
      order: parseInt(order, 10) || 0,
      image: uploadedUrl,
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (error) {
    if (uploadedUrl) {
      const publicId = extractPublicId(uploadedUrl);
      if (publicId) await deleteImage(publicId);
    }
    res.status(400).json({
      success: false,
      message: 'Error creating category',
      error: error.message,
    });
  }
});

const updateCategory = async (req, res) => {
  try {
    const {name, status, featured, popular, order} = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({success: false, message: 'Category not found'});

    const oldImage = category.image;
    category.name = name || category.name;
    category.status = status || category.status;
    category.featured = featured !== undefined ? featured === 'true' : category.featured;
    category.popular = popular !== undefined ? popular === 'true' : category.popular;
    category.order = order !== undefined ? order : category.order;
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
      data: category,
    });
  } catch (error) {
    if (req.file) {
      const publicId = extractPublicId(req.file.path);
      if (publicId) await deleteImage(publicId);
    }
    res.status(400).json({
      success: false,
      message: 'Error updating category',
      error: error.message,
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({success: false, message: 'Category not found'});

    const blogCount = await Blog.countDocuments({categories: req.params.id});
    const topicCount = await Topic.countDocuments({categories: req.params.id});
    if (blogCount > 0 || topicCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category. Category has associated blogs or topics.',
      });
    }

    if (category.image) {
      const publicId = extractPublicId(category.image);
      if (publicId) await deleteImage(publicId);
    }

    await category.deleteOne();
    res.json({success: true, message: 'Category deleted successfully'});
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message,
    });
  }
};

const toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({success: false, message: 'Category not found'});
    category.status = category.status === 'active' ? 'inactive' : 'active';
    await category.save();
    res.json({
      success: true,
      message: `Category ${category.status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating category status',
      error: error.message,
    });
  }
};

const toggleCategoryFeatured = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({success: false, message: 'Category not found'});
    category.featured = !category.featured;
    await category.save();
    res.json({
      success: true,
      message: `Category ${category.featured ? 'featured' : 'unfeatured'} successfully`,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating category featured status',
      error: error.message,
    });
  }
};

const toggleCategoryPopular = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({success: false, message: 'Category not found'});
    category.popular = !category.popular;
    await category.save();
    res.json({
      success: true,
      message: `Category ${category.popular ? 'marked as popular' : 'unmarked as popular'} successfully`,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating category popular status',
      error: error.message,
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
  toggleCategoryPopular,
};
