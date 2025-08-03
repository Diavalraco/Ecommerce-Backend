const Blog = require('../models/blog.model');
const Author = require('../models/author.model');
const Category = require('../models/category.model');
const Topic = require('../models/topic.model');
const { deleteImage, extractPublicId } = require('../config/cloudinary');

const getAllBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, featured, popular, category, topic, author } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (status)    query.status = status;
    if (featured === 'true') query.featured = true;
    if (popular === 'true')  query.popular = true;
    if (category)  query.categories = category;
    if (topic)     query.topics = topic;
    if (author)    query.author = author;

    const blogs = await Blog.find(query)
      .populate('author', 'name profileImage instagramHandle')
      .populate('categories', 'name image')
      .populate('topics', 'name')
      .sort({ order: 1, createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Blog.countDocuments(query);

    res.json({
      success: true,
      data: blogs,
      pagination: {
        current: Number(page),
        total: Math.ceil(total / Number(limit)),
        count: blogs.length,
        totalRecords: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching blogs',
      error: error.message
    });
  }
};

const getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate('author', 'name profileImage instagramHandle description')
      .populate('categories', 'name image')
      .populate('topics', 'name');
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    res.json({ success: true, data: blog });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching blog',
      error: error.message
    });
  }
};

const createBlog = async (req, res) => {
  try {
    const { title, description, content, videoLink, author, categories, topics, status, featured, popular, order } = req.body;
    const blogData = {
      title,
      description,
      content,
      author,
      status: status || 'draft',
      featured: featured === 'true',
      popular: popular === 'true',
      order: order || 0,
      thumbnail: req.file ? req.file.path : undefined,
      videoLink: videoLink || undefined,
      categories: categories ? JSON.parse(categories) : [],
      topics: topics ? JSON.parse(topics) : []
    };
    const blog = new Blog(blogData);
    await blog.save();
    await blog.populate('author categories topics');
    res.status(201).json({ success: true, message: 'Blog created successfully', data: blog });
  } catch (error) {
    if (req.file) {
      const publicId = extractPublicId(req.file.path);
      if (publicId) await deleteImage(publicId);
    }
    res.status(400).json({
      success: false,
      message: 'Error creating blog',
      error: error.message
    });
  }
};

const updateBlog = async (req, res) => {
  try {
    const { title, description, content, videoLink, author, categories, topics, status, featured, popular, order } = req.body;
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    const oldThumbnail = blog.thumbnail;
    blog.title       = title       || blog.title;
    blog.description = description || blog.description;
    blog.content     = content     || blog.content;
    blog.videoLink   = videoLink   || blog.videoLink;
    blog.author      = author      || blog.author;
    blog.status      = status      || blog.status;
    blog.featured    = featured !== undefined ? featured === 'true' : blog.featured;
    blog.popular     = popular  !== undefined ? popular === 'true' : blog.popular;
    blog.order       = order       !== undefined ? order : blog.order;
    if (categories) blog.categories = JSON.parse(categories);
    if (topics)     blog.topics     = JSON.parse(topics);
    if (req.file) {
      blog.thumbnail = req.file.path;
      if (oldThumbnail) {
        const publicId = extractPublicId(oldThumbnail);
        if (publicId) await deleteImage(publicId);
      }
    }

    await blog.save();
    await blog.populate('author categories topics');
    res.json({ success: true, message: 'Blog updated successfully', data: blog });
  } catch (error) {
    if (req.file) {
      const publicId = extractPublicId(req.file.path);
      if (publicId) await deleteImage(publicId);
    }
    res.status(400).json({
      success: false,
      message: 'Error updating blog',
      error: error.message
    });
  }
};

const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    if (blog.thumbnail) {
      const publicId = extractPublicId(blog.thumbnail);
      if (publicId) await deleteImage(publicId);
    }
    await blog.deleteOne();
    res.json({ success: true, message: 'Blog deleted successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting blog',
      error: error.message
    });
  }
};

const toggleBlogStatus = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    blog.status = blog.status === 'published' ? 'draft' : 'published';
    if (blog.status === 'published' && !blog.publishedAt) {
      blog.publishedAt = new Date();
    }
    await blog.save();
    res.json({
      success: true,
      message: `Blog ${blog.status === 'published' ? 'published' : 'unpublished'} successfully`,
      data: blog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating blog status',
      error: error.message
    });
  }
};

const toggleFeatured = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    blog.featured = !blog.featured;
    await blog.save();
    res.json({
      success: true,
      message: `Blog ${blog.featured ? 'featured' : 'unfeatured'} successfully`,
      data: blog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating blog featured status',
      error: error.message
    });
  }
};

const togglePopular = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    blog.popular = !blog.popular;
    await blog.save();
    res.json({
      success: true,
      message: `Blog ${blog.popular ? 'marked as popular' : 'unmarked as popular'} successfully`,
      data: blog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating blog popular status',
      error: error.message
    });
  }
};

module.exports = {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  toggleBlogStatus,
  toggleFeatured,
  togglePopular
};
