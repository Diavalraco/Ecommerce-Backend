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

module.exports = {
  addFavorite,
  removeFavorite,
};
