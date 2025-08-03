const mongoose = require('mongoose');
const Blog = require('../models/blog.model');
const Topic = require('../models/topic.model');
const Category = require('../models/category.model');

const getAllTopics = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, featured, popular, category } = req.query;
    const query = {};
    if (search)    query.name = { $regex: search, $options: 'i' };
    if (status)    query.status = status;
    if (featured === 'true') query.featured = true;
    if (popular === 'true')  query.popular = true;
    if (category)  query.categories = category;

    const topics = await Topic.find(query)
      .populate('categories', 'name image')
      .sort({ order: 1, createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Topic.countDocuments(query);

    res.json({
      success: true,
      data: topics,
      pagination: {
        current: Number(page),
        total: Math.ceil(total / Number(limit)),
        count: topics.length,
        totalRecords: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching topics',
      error: error.message
    });
  }
};

const getTopicById = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id)
      .populate('categories', 'name image');

    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    res.json({ success: true, data: topic });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching topic',
      error: error.message
    });
  }
};

const createTopic = async (req, res) => {
  try {
    const { name, categories, status, featured, popular, order } = req.body;
    const topic = new Topic({
      name,
      categories: Array.isArray(categories) ? categories : JSON.parse(categories || '[]'),
      status: status || 'active',
      featured: featured === 'true',
      popular: popular === 'true',
      order: order || 0
    });
    await topic.save();
    await topic.populate('categories', 'name image');

    res.status(201).json({
      success: true,
      message: 'Topic created successfully',
      data: topic
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating topic',
      error: error.message
    });
  }
};

const updateTopic = async (req, res) => {
  try {
    const { name, categories, status, featured, popular, order } = req.body;
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    topic.name     = name     || topic.name;
    topic.status   = status   || topic.status;
    topic.featured = featured !== undefined ? featured === 'true' : topic.featured;
    topic.popular  = popular  !== undefined ? popular === 'true' : topic.popular;
    topic.order    = order    !== undefined ? order : topic.order;
    if (categories) topic.categories = Array.isArray(categories) ? categories : JSON.parse(categories);

    await topic.save();
    await topic.populate('categories', 'name image');

    res.json({
      success: true,
      message: 'Topic updated successfully',
      data: topic
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating topic',
      error: error.message
    });
  }
};

const deleteTopic = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    const blogCount = await Blog.countDocuments({ topics: req.params.id });
    if (blogCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete topic. Topic has associated blogs.'
      });
    }

    await topic.deleteOne();

    res.json({ success: true, message: 'Topic deleted successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting topic',
      error: error.message
    });
  }
};

const toggleTopicStatus = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    topic.status = topic.status === 'active' ? 'inactive' : 'active';
    await topic.save();

    res.json({
      success: true,
      message: `Topic ${topic.status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: topic
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating topic status',
      error: error.message
    });
  }
};

const toggleTopicFeatured = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    topic.featured = !topic.featured;
    await topic.save();

    res.json({
      success: true,
      message: `Topic ${topic.featured ? 'featured' : 'unfeatured'} successfully`,
      data: topic
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating topic featured status',
      error: error.message
    });
  }
};

const toggleTopicPopular = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    topic.popular = !topic.popular;
    await topic.save();

    res.json({
      success: true,
      message: `Topic ${topic.popular ? 'marked as popular' : 'unmarked as popular'} successfully`,
      data: topic
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating topic popular status',
      error: error.message
    });
  }
};

module.exports = {
  getAllTopics,
  getTopicById,
  createTopic,
  updateTopic,
  deleteTopic,
  toggleTopicStatus,
  toggleTopicFeatured,
  toggleTopicPopular
};
