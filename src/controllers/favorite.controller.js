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


module.exports = {
  markFavorite,
  unmarkFavorite,
};
