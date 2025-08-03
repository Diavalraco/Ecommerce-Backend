const httpStatus = require('http-status');
const Favorite = require('../models/favorite.model');
const ApiError = require('../utils/ApiError');
const Blog = require('../models/blog.model');
const addFavorite = async (userId, blogId) => {
  try {
    const fav = await Favorite.create({user: userId, blog: blogId});
    await Blog.findByIdAndUpdate(blogId, {$inc: {favorites: 1}});
    return fav;
  } catch (err) {
    if (err.code === 11000) return null;
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
};

const removeFavorite = async (userId, blogId) => {
  const fav = await Favorite.findOneAndDelete({user: userId, blog: blogId});
  if (!fav) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Favorite not found');
  }
  await Blog.findByIdAndUpdate(blogId, {$inc: {favorites: -1}});
  return fav;
};

const getFavoritesByUser = async (userId, {page = 1, limit = 10} = {}) => {
  const skip = (page - 1) * limit;
  const [results, total] = await Promise.all([
    Favorite.find({user: userId})
      .sort({createdAt: -1})
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'blog',
        populate: [
          {path: 'author', select: 'name profileImage instagramHandle'},
          {path: 'categories', select: 'name image'},
          {path: 'topics', select: 'name'},
        ],
      }),
    Favorite.countDocuments({user: userId}),
  ]);
  return {
    page,
    limit,
    results: results.map(f => f.blog),
    totalPages: Math.ceil(total / limit),
    totalResults: total,
  };
};

module.exports = {
  addFavorite,
  removeFavorite,
  getFavoritesByUser,
};
