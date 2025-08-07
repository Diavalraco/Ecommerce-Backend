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

module.exports = {
  getPublicBlogs,
};
