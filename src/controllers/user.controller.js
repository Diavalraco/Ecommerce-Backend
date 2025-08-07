const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const {userService} = require('../services');
const Blog = require('../models/blog.model');
const Products = require('../models/products.model');
const {User} = require('../models/user.model');
const mongoose = require('mongoose');

const updateUser = catchAsync(async (req, res) => {
  const updatedUser = await userService.updateUserById(req.user._id, req.body, req.file);
  res.status(200).send({data: updatedUser, message: 'Your details are updated'});
});

const updatePreferences = catchAsync(async (req, res) => {
  const updatedUser = await userService.updatePreferencesById(req.user._id, req.body);
  res.status(200).send({data: updatedUser, message: 'Your preferences are updated'});
});

const softDeleteUser = catchAsync(async (req, res) => {
  const {userId} = req.params;
  if (req.user.__t !== 'Admin' && userId !== req.user._id.toString()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Sorry, you are not authorized to do this');
  }
  await userService.markUserAsDeletedById(req.params.userId);
  res.status(200).send({
    message: 'User has been removed successfully.',
  });
});

const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUserById(req.params.userId);
  res.status(200).send({message: 'The user deletion process has been completed successfully.'});
});

const getPublicBlogs = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', category, topic, author, featured, popular, favorites} = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {status: 'published'};

  if (search.trim() !== '') {
    query.$or = [
      {title: {$regex: search.trim(), $options: 'i'}},
      {description: {$regex: search.trim(), $options: 'i'}},
    ];
  }
  if (category) query.categories = new mongoose.Types.ObjectId(category);
  if (topic) query.topics = new mongoose.Types.ObjectId(topic);
  if (author) query.author = new mongoose.Types.ObjectId(author);
  if (featured === 'true') query.featured = true;
  if (popular === 'true') query.popular = true;

  // if (favorites === 'true') {
  //   if (!req.user || !req.user._id) {
  //     return res.status(httpStatus.UNAUTHORIZED).json({
  //       status: false,
  //       message: 'Authentication required to filter by favorites',
  //     });
  //   }
  //   const favs = await Favorite.find({user: req.user._id}).select('blog');
  //   const blogIds = favs.map(f => f.blog);
  //   query._id = {$in: blogIds};
  // }

  const [blogs, totalCount] = await Promise.all([
    Blog.find(query)
      .populate('author', 'name profileImage instagramHandle')
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

const getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndUpdate(req.params.id, {$inc: {views: 1}}, {new: true})
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

const getAllUsers = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', sort = 'new_to_old', blocked} = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (search.trim()) {
    query.fullName = {$regex: search.trim(), $options: 'i'};
  }

  if (blocked !== undefined) {
    query.isBlocked = blocked === 'true';
  }

  const sortObj = {order: 1};
  if (sort === 'old_to_new') {
    sortObj.createdAt = 1;
  } else {
    sortObj.createdAt = -1;
  }

  const [users, totalCount] = await Promise.all([
    User.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum),
    User.countDocuments(query),
  ]);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: users,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
  });
});

const getUserById = catchAsync(async (req, res) => {
  const {userId} = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  res.status(httpStatus.OK).json({
    status: true,
    data: user,
  });
});

const toggleUserBlockStatus = catchAsync(async (req, res) => {
  const {userId} = req.params;
  const {isBlocked} = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID');
  }

  if (typeof isBlocked !== 'boolean') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'isBlocked must be a boolean value');
  }

  const user = await User.findByIdAndUpdate(userId, {isBlocked}, {new: true});

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const message = isBlocked ? 'User has been blocked successfully' : 'User has been unblocked successfully';

  res.status(httpStatus.OK).json({
    status: true,
    message,
    data: user,
  });
});

const getAllProducts = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    status,
    sort = 'new_to_old',
    category,
    published,
    popular,
    featured,
  } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {status: 'active'};
  if (search.trim()) {
    const s = search.trim();
    query.$or = [{name: {$regex: s, $options: 'i'}}, {description: {$regex: s, $options: 'i'}}];
  }
  if (status && status !== 'all') query.status = status;
  if (category) query.categories = category;
  if (published === 'true') query.isPublished = true;
  if (popular === 'true') query.isPopular = true;
  if (featured === 'true') query.isFeatured = true;

  const sortOption = sort === 'old_to_new' ? {createdAt: 1} : {createdAt: -1};

  const [products, totalCount] = await Promise.all([
    Products.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum),
    Products.countDocuments(query),
  ]);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: products,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
  });
});

const getProductById = catchAsync(async (req, res) => {
  const product = await Products.findById(req.params.id).populate({
    path: 'categories',
    select: 'name',
  });

  if (!product) {
    return res.status(httpStatus.NOT_FOUND).json({status: false, message: 'Product not found'});
  }

  res.status(httpStatus.OK).json({status: true, data: product});
});

module.exports = {
  deleteUser,
  updateUser,
  softDeleteUser,
  updatePreferences,
  getPublicBlogs,
  getBlogById,
  getAllUsers,
  getUserById,
  toggleUserBlockStatus,
  getAllProducts,
  getProductById,
};
