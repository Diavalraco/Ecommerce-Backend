const Blog = require('../models/blog.model');
const Topic = require('../models/topic.model');
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');

const getAllTopics = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', status, featured, popular, category} = req.query;

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
  if (category) {
    query.categories = category;
  }

  const topics = await Topic.find(query)
    .populate('categories', 'name image')
    .sort({order: 1, createdAt: -1})
    .skip(skip)
    .limit(limitNum);

  const totalCount = await Topic.countDocuments(query);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: topics,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
  });
});

const getTopicById = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id).populate('categories', 'name image');

    if (!topic) return res.status(404).json({success: false, message: 'Topic not found'});

    res.json({success: true, data: topic});
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching topic',
      error: error.message,
    });
  }
};

const createTopic = async (req, res) => {
  try {
    const {name, categories, status, featured, popular, order} = req.body;
    const topic = new Topic({
      name,
      categories: Array.isArray(categories) ? categories : JSON.parse(categories || '[]'),
      status: status || 'active',
      featured: featured === 'true',
      popular: popular === 'true',
      order: order || 0,
    });
    await topic.save();
    await topic.populate('categories', 'name image');

    res.status(201).json({
      success: true,
      message: 'Topic created successfully',
      data: topic,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating topic',
      error: error.message,
    });
  }
};

const updateTopic = async (req, res) => {
  try {
    const {name, categories, status, featured, popular, order} = req.body;
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({success: false, message: 'Topic not found'});

    topic.name = name || topic.name;
    topic.status = status || topic.status;
    topic.featured = featured !== undefined ? featured === 'true' : topic.featured;
    topic.popular = popular !== undefined ? popular === 'true' : topic.popular;
    topic.order = order !== undefined ? order : topic.order;
    if (categories) topic.categories = Array.isArray(categories) ? categories : JSON.parse(categories);

    await topic.save();
    await topic.populate('categories', 'name image');

    res.json({
      success: true,
      message: 'Topic updated successfully',
      data: topic,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating topic',
      error: error.message,
    });
  }
};

const deleteTopic = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({success: false, message: 'Topic not found'});

    const blogCount = await Blog.countDocuments({topics: req.params.id});
    if (blogCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete topic. Topic has associated blogs.',
      });
    }

    await topic.deleteOne();

    res.json({success: true, message: 'Topic deleted successfully'});
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting topic',
      error: error.message,
    });
  }
};

module.exports = {
  getAllTopics,
  getTopicById,
  createTopic,
  updateTopic,
  deleteTopic,
};
