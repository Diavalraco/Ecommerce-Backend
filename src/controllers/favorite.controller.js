const httpStatus    = require('http-status');
const catchAsync    = require('../utils/catchAsync');
const favoriteSvc   = require('../services/favorite.service');

const markFavorite = catchAsync(async (req, res) => {
  await favoriteSvc.addFavorite(req.user._id, req.params.id);
  res.status(httpStatus.OK).json({
    status:  true,
    message: 'Blog marked as favorite',
  });
});

const unmarkFavorite = catchAsync(async (req, res) => {
  await favoriteSvc.removeFavorite(req.user._id, req.params.id);
  res.status(httpStatus.OK).json({
    status:  true,
    message: 'Blog removed from favorites',
  });
});

const getMyFavorites = catchAsync(async (req, res) => {
  const data = await favoriteSvc.getFavoritesByUser(req.user._id, {
    page: req.query.page, 
    limit: req.query.limit,
  });
  res.status(httpStatus.OK).json({
    status: true,
    data,
  });
});

module.exports = {
  markFavorite,
  unmarkFavorite,
  getMyFavorites,
};
