const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const Blog = require('../models/blog.model');
const Category = require('../models/category.model');

const getPublicBlogs = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', category, topic, author} = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {
    status: {$in: ['draft', 'published']},
  };

  if (search.trim() !== '') {
    query.$or = [
      {title: {$regex: search.trim(), $options: 'i'}},
      {description: {$regex: search.trim(), $options: 'i'}},
    ];
  }
  if (category) query.categories = category;
  if (topic) query.topics = topic;
  if (author) query.author = author;

  const [blogs, totalCount] = await Promise.all([
    Blog.find(query)
      .populate('author', 'name profileImage instagramHandle')
      .populate('categories', 'name image')
      .populate('topics', 'name')
      .sort({publishedAt: -1})
      .skip(skip)
      .limit(limitNum)
      .select('-content'),
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

const getFeaturedBlogs = catchAsync(async (req, res) => {
  const {limit = 5} = req.query;
  const limitNum = parseInt(limit, 10);

  const blogs = await Blog.find({status: 'published', featured: true})
    .populate('author', 'name profileImage')
    .populate('categories', 'name image')
    .sort({publishedAt: -1})
    .limit(limitNum)
    .select('-content');

  res.status(httpStatus.OK).json({
    status: true,
    data: blogs,
  });
});

const getPopularBlogs = catchAsync(async (req, res) => {
  const {limit = 5} = req.query;
  const limitNum = parseInt(limit, 10);

  const blogs = await Blog.find({status: 'published', popular: true})
    .populate('author', 'name profileImage')
    .populate('categories', 'name image')
    .sort({views: -1, publishedAt: -1})
    .limit(limitNum)
    .select('-content');

  res.status(httpStatus.OK).json({
    status: true,
    data: blogs,
  });
});

const getBlogsByCategory = catchAsync(async (req, res) => {
  const {page = 1, limit = 10} = req.query;
  const {categoryId} = req.params;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {
    status: {$in: ['draft', 'published']},
    categories: categoryId,
  };

  const [blogs, totalCount] = await Promise.all([
    Blog.find(query)
      .populate('author', 'name profileImage')
      .populate('categories', 'name image')
      .populate('topics', 'name')
      .sort({publishedAt: -1})
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
const getBlogsByTopic = catchAsync(async (req, res) => {
  const {page = 1, limit = 10} = req.query;
  const {topicId} = req.params;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {status: 'published', topics: topicId};

  const [blogs, totalCount] = await Promise.all([
    Blog.find(query)
      .populate('author', 'name profileImage')
      .populate('categories', 'name image')
      .populate('topics', 'name')
      .sort({publishedAt: -1})
      .skip(skip)
      .limit(limitNum)
      .select('-content'),
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

const getBlogsByAuthor = catchAsync(async (req, res) => {
  const {page = 1, limit = 10} = req.query;
  const {authorId} = req.params;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {status: 'published', author: authorId};

  const [blogs, totalCount] = await Promise.all([
    Blog.find(query)
      .populate('author', 'name profileImage instagramHandle description')
      .populate('categories', 'name image')
      .populate('topics', 'name')
      .sort({publishedAt: -1})
      .skip(skip)
      .limit(limitNum)
      .select('-content'),
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

const getFeaturedCategories = catchAsync(async (req, res) => {
  const {limit = 10} = req.query;
  const limitNum = parseInt(limit, 10);

  const categories = await Category.find({status: 'active', featured: true})
    .sort({order: 1, usedCount: -1})
    .limit(limitNum);

  res.status(httpStatus.OK).json({
    status: true,
    data: categories,
  });
});

const getPopularCategories = catchAsync(async (req, res) => {
  const {limit = 10} = req.query;
  const limitNum = parseInt(limit, 10);

  const categories = await Category.find({status: 'active', popular: true})
    .sort({usedCount: -1, order: 1})
    .limit(limitNum);

  res.status(httpStatus.OK).json({
    status: true,
    data: categories,
  });
});

module.exports = {
  getPublicBlogs,
  getFeaturedBlogs,
  getPopularBlogs,
  getBlogsByCategory,
  getBlogsByTopic,
  getBlogsByAuthor,
  getFeaturedCategories,
  getPopularCategories,
};
