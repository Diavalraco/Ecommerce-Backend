const Blog = require('../models/blog.model');
const Author = require('../models/author.model');
const Category = require('../models/category.model');
const Topic = require('../models/topic.model');
const path = require('path');
const catchAsync = require('../utils/catchAsync');
const httpStatus = require('http-status');
// const {cloudinary, deleteImage, extractPublicId} = require('../config/cloudinary');
const {uploadImage, deleteImage, extractKey} = require('../config/r2');

const getAllBlogs = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', status, featured, popular, category, topic, author} = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (search.trim() !== '') {
    query.$or = [
      {title: {$regex: search.trim(), $options: 'i'}},
      {description: {$regex: search.trim(), $options: 'i'}},
    ];
  }
  if (status) query.status = status;
  if (featured === 'true') query.featured = true;
  if (popular === 'true') query.popular = true;
  if (category) query.categories = category;
  if (topic) query.topics = topic;
  if (author) query.author = author;

  const [blogs, totalCount] = await Promise.all([
    Blog.find(query)
      .populate('author', 'name profileImage instagramHandle')
      .populate('categories', 'name image')
      .populate('topics', 'name')
      .sort({order: 1, createdAt: -1})
      .skip(skip)
      .limit(limitNum),
    Blog.countDocuments(query),
  ]);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: blogs,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
  });
});

const getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate('author')
      .populate('categories')
      .populate('topics');
    if (!blog) return res.status(404).json({success: false, message: 'Blog not found'});
    res.json({success: true, data: blog});
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching blog',
      error: error.message,
    });
  }
};

const createBlog = catchAsync(async (req, res) => {
  let newKey = null;

  try {
    const {
      title,
      description,
      content,
      videoLink,
      author,
      categories,
      topics,
      status,
      featured,
      popular,
      order,
    } = req.body;

    let categoryIds = [];
    if (categories) {
      if (Array.isArray(categories)) {
        categoryIds = categories;
      } else if (typeof categories === 'string' && categories.trim() !== '') {
        try {
          const parsed = JSON.parse(categories);
          categoryIds = Array.isArray(parsed) ? parsed : categories.split(',').map(id => id.trim());
        } catch {
          categoryIds = categories.split(',').map(id => id.trim());
        }
      }
    }

    let topicIds = [];
    if (topics) {
      if (Array.isArray(topics)) {
        topicIds = topics;
      } else if (typeof topics === 'string' && topics.trim() !== '') {
        try {
          const parsed = JSON.parse(topics);
          topicIds = Array.isArray(parsed) ? parsed : topics.split(',').map(id => id.trim());
        } catch {
          topicIds = topics.split(',').map(id => id.trim());
        }
      }
    }
    let signedUrl = null;
    if (req.file && req.file.buffer) {
      const ext = path.extname(req.file.originalname);
      newKey = `blog-management/thumbnails/${Date.now()}${ext}`;
      const result = await uploadImage({
        buffer: req.file.buffer,
        key: newKey,
        contentType: req.file.mimetype,
      });
      signedUrl = result.url;
    }

    const blogData = {
      title: title.trim(),
      description: description.trim(),
      content,
      videoLink: videoLink || undefined,
      author,
      categories: categoryIds,
      topics: topicIds,
      status: status || 'draft',
      featured: featured === 'true',
      popular: popular === 'true',
      order: parseInt(order, 10) || 0,
      thumbnail: signedUrl,
    };

    const created = await Blog.create(blogData);
    const blog = await Blog.findById(created._id)
      .populate('author', 'name profileImage instagramHandle')
      .populate('categories', 'name image')
      .populate('topics', 'name');

    return res.status(httpStatus.CREATED).json({
      status: true,
      message: 'Blog created successfully',
      data: blog,
    });
  } catch (error) {
    if (newKey) {
      await deleteImage(newKey);
    }
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Error creating blog',
      error: error.message,
    });
  }
});

const updateBlog = catchAsync(async (req, res) => {
  let newKey = null;
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    return res.status(httpStatus.NOT_FOUND).json({
      status: false,
      message: 'Blog not found',
    });
  }

  const oldThumbnail = blog.thumbnail;

  try {
    const {
      title,
      description,
      content,
      videoLink,
      author,
      categories,
      topics,
      status,
      featured,
      popular,
      order,
    } = req.body;

    if (title !== undefined) blog.title = title.trim();
    if (description !== undefined) blog.description = description.trim();
    if (content !== undefined) blog.content = content;
    if (videoLink !== undefined) blog.videoLink = videoLink || undefined;
    if (author !== undefined) blog.author = author;
    if (status !== undefined) blog.status = status;
    if (featured !== undefined) blog.featured = featured === 'true';
    if (popular !== undefined) blog.popular = popular === 'true';
    if (order !== undefined) blog.order = parseInt(order, 10) || 0;

    const parseIds = field => {
      if (!field) return null;
      if (Array.isArray(field)) return field;
      if (typeof field === 'string' && field.trim()) {
        try {
          const parsed = JSON.parse(field);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
        return field.split(',').map(id => id.trim());
      }
      return [];
    };
    const catIds = parseIds(categories);
    if (catIds) blog.categories = catIds;
    const topIds = parseIds(topics);
    if (topIds) blog.topics = topIds;

    if (req.file && req.file.buffer) {
      const ext = path.extname(req.file.originalname);
      newKey = `blog-management/thumbnails/${Date.now()}${ext}`;

      const result = await uploadImage({
        buffer: req.file.buffer,
        key: newKey,
        contentType: req.file.mimetype,
      });
      blog.thumbnail = result.url;
      if (oldThumbnail) {
        const oldKey = extractKey(oldThumbnail);
        if (oldKey) await deleteImage(oldKey);
      }
    }

    await blog.save();
    const updated = await Blog.findById(blog._id)
      .populate('author', 'name profileImage instagramHandle')
      .populate('categories', 'name image')
      .populate('topics', 'name');

    return res.status(httpStatus.OK).json({
      status: true,
      message: 'Blog updated successfully',
      data: updated,
    });
  } catch (err) {
    if (newKey) {
      await deleteImage(newKey);
    }
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Error updating blog',
      error: err.message,
    });
  }
});

const deleteBlog = catchAsync(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    return res.status(httpStatus.NOT_FOUND).json({
      status: false,
      message: 'Blog not found',
    });
  }

  if (blog.image) {
    const key = extractKey(blog.image);
    if (key) await deleteImage(key);
  }

  await blog.deleteOne();
  return res.status(httpStatus.OK).json({
    status: true,
    message: 'Blog deleted successfully',
    data: blog,
  });
});

module.exports = {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
};
