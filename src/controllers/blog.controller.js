const Blog = require('../models/blog.model');
const Author = require('../models/author.model');
const Category = require('../models/category.model');
const Topic = require('../models/topic.model');
const catchAsync = require('../utils/catchAsync');
const httpStatus = require('http-status');
const {cloudinary, deleteImage, extractPublicId} = require('../config/cloudinary');

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
  let thumbnailUrl = null;

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

    if (req.file && req.file.buffer) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({folder: 'blog-management/thumbnails'}, (err, uploaded) =>
          err ? reject(err) : resolve(uploaded)
        );
        stream.end(req.file.buffer);
      });
      thumbnailUrl = result.secure_url;
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
      thumbnail: thumbnailUrl,
    };

    // 6) Create & then re-fetch with populate
    const created = await Blog.create(blogData);
    const blog = await Blog.findById(created._id)
      .populate('author', 'name profileImage instagramHandle')
      .populate('categories', 'name image')
      .populate('topics', 'name');

    // 7) Return
    return res.status(httpStatus.CREATED).json({
      status: true,
      message: 'Blog created successfully',
      data: blog,
    });
  } catch (error) {
    // Clean up the thumbnail if it was uploaded
    if (thumbnailUrl) {
      const publicId = extractPublicId(thumbnailUrl);
      if (publicId) await deleteImage(publicId);
    }
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Error creating blog',
      error: error.message,
    });
  }
});

const updateBlog = async (req, res) => {
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
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({success: false, message: 'Blog not found'});

    const oldThumbnail = blog.thumbnail;
    blog.title = title || blog.title;
    blog.description = description || blog.description;
    blog.content = content || blog.content;
    blog.videoLink = videoLink || blog.videoLink;
    blog.author = author || blog.author;
    blog.status = status || blog.status;
    blog.featured = featured !== undefined ? featured === 'true' : blog.featured;
    blog.popular = popular !== undefined ? popular === 'true' : blog.popular;
    blog.order = order !== undefined ? order : blog.order;
    if (categories) blog.categories = JSON.parse(categories);
    if (topics) blog.topics = JSON.parse(topics);
    if (req.file) {
      blog.thumbnail = req.file.path;
      if (oldThumbnail) {
        const publicId = extractPublicId(oldThumbnail);
        if (publicId) await deleteImage(publicId);
      }
    }

    await blog.save();
    await blog.populate('author categories topics');
    res.json({success: true, message: 'Blog updated successfully', data: blog});
  } catch (error) {
    if (req.file) {
      const publicId = extractPublicId(req.file.path);
      if (publicId) await deleteImage(publicId);
    }
    res.status(400).json({
      success: false,
      message: 'Error updating blog',
      error: error.message,
    });
  }
};

const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({success: false, message: 'Blog not found'});
    if (blog.thumbnail) {
      const publicId = extractPublicId(blog.thumbnail);
      if (publicId) await deleteImage(publicId);
    }
    await blog.deleteOne();
    res.json({success: true, message: 'Blog deleted successfully'});
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting blog',
      error: error.message,
    });
  }
};

const toggleBlogStatus = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({success: false, message: 'Blog not found'});
    blog.status = blog.status === 'published' ? 'draft' : 'published';
    if (blog.status === 'published' && !blog.publishedAt) {
      blog.publishedAt = new Date();
    }
    await blog.save();
    res.json({
      success: true,
      message: `Blog ${blog.status === 'published' ? 'published' : 'unpublished'} successfully`,
      data: blog,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating blog status',
      error: error.message,
    });
  }
};

const toggleFeatured = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({success: false, message: 'Blog not found'});
    blog.featured = !blog.featured;
    await blog.save();
    res.json({
      success: true,
      message: `Blog ${blog.featured ? 'featured' : 'unfeatured'} successfully`,
      data: blog,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating blog featured status',
      error: error.message,
    });
  }
};

const togglePopular = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({success: false, message: 'Blog not found'});
    blog.popular = !blog.popular;
    await blog.save();
    res.json({
      success: true,
      message: `Blog ${blog.popular ? 'marked as popular' : 'unmarked as popular'} successfully`,
      data: blog,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating blog popular status',
      error: error.message,
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
  togglePopular,
};
