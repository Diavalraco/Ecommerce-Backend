const Review = require('../models/review.model');
const Order = require('../models/order.model');
const Products = require('../models/products.model');
const catchAsync = require('../utils/catchAsync');
const mongoose = require('mongoose');
const httpStatus = require('http-status');

const updateProductRating = async (productId) => {
  try {
    const reviews = await Review.find({ productId, status: 'active' });
    
    if (reviews.length === 0) {
      await Products.findByIdAndUpdate(productId, {
        ratingAvg: 0,
        ratingCount: 0,
      });
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = totalRating / reviews.length;

    await Products.findByIdAndUpdate(productId, {
      ratingAvg: Math.round(avgRating * 10) / 10,
      ratingCount: reviews.length,
    });

    console.log(`Updated product ${productId} rating: ${avgRating} (${reviews.length} reviews)`);
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
};

const createReview = catchAsync(async (req, res) => {
  const { productId, orderId, rating, message } = req.body;
  const userId = req.user.id;

  if (!productId || !orderId || !rating || !message) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Product ID, Order ID, rating, and message are required',
    });
  }

  if (rating < 1 || rating > 5) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Rating must be between 1 and 5',
    });
  }

  if (message.trim().length < 10) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Review message must be at least 10 characters long',
    });
  }

  const existingReview = await Review.findOne({ userId, productId });
  if (existingReview) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'You have already reviewed this product',
    });
  }

  const order = await Order.findOne({
    _id: orderId,
    userId: userId,
    status: 'delivered',
  }).populate('items.productId');

  if (!order) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Order not found, not delivered, or does not belong to you',
    });
  }

  const productInOrder = order.items.some(
    item => item.productId._id.toString() === productId
  );

  if (!productInOrder) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Product not found in the specified order',
    });
  }

  const product = await Products.findById(productId);
  if (!product) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Product not found',
    });
  }

  const review = new Review({
    userId,
    productId,
    orderId,
    rating: parseInt(rating),
    message: message.trim(),
  });

  await review.save();

  await updateProductRating(productId);

  const populatedReview = await Review.findById(review._id)
    .populate('userId', 'fullName name email')
    .populate('productId', 'name images')
    .populate('orderId', '_id razorpayOrderId');

  res.status(httpStatus.CREATED).json({
    status: true,
    data: populatedReview,
    message: 'Review created successfully',
  });
});

const getProductReviews = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const { page = 1, limit = 10, sort = 'newest' } = req.query;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Invalid product ID',
    });
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
  const skip = (pageNum - 1) * limitNum;
  let sortOption = { createdAt: -1 };
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'highest_rating') {
    sortOption = { rating: -1, createdAt: -1 };
  } else if (sort === 'lowest_rating') {
    sortOption = { rating: 1, createdAt: -1 };
  }

  const [reviews, totalCount, product] = await Promise.all([
    Review.find({ productId, status: 'active' })
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate('userId', 'fullName name email')
      .populate('orderId', '_id razorpayOrderId createdAt')
      .lean(),
    Review.countDocuments({ productId, status: 'active' }),
    Products.findById(productId, 'name ratingAvg ratingCount'),
  ]);

  if (!product) {
    return res.status(httpStatus.NOT_FOUND).json({
      status: false,
      message: 'Product not found',
    });
  }

  const ratingDistribution = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'active' } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);

  const distribution = {};
  for (let i = 1; i <= 5; i++) {
    distribution[i] = 0;
  }
  ratingDistribution.forEach(item => {
    distribution[item._id] = item.count;
  });

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      product: {
        _id: product._id,
        name: product.name,
        ratingAvg: product.ratingAvg,
        ratingCount: product.ratingCount,
      },
      page: pageNum,
      limit: limitNum,
      results: reviews,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
      ratingDistribution: distribution,
    },
    message: 'Product reviews fetched successfully',
  });
});

const getUserReviews = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, sort = 'newest' } = req.query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
  const skip = (pageNum - 1) * limitNum;

  let sortOption = { createdAt: -1 };
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'highest_rating') {
    sortOption = { rating: -1, createdAt: -1 };
  } else if (sort === 'lowest_rating') {
    sortOption = { rating: 1, createdAt: -1 };
  }

  const [reviews, totalCount] = await Promise.all([
    Review.find({ userId })
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate('productId', 'name images')
      .populate('orderId', '_id razorpayOrderId createdAt')
      .lean(),
    Review.countDocuments({ userId }),
  ]);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: reviews,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
    message: 'User reviews fetched successfully',
  });
});

const getAllReviews = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, sort = 'newest', status = 'all', rating } = req.query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (status !== 'all') {
    query.status = status;
  }
  if (rating && rating >= 1 && rating <= 5) {
    query.rating = parseInt(rating);
  }

  let sortOption = { createdAt: -1 };
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'highest_rating') {
    sortOption = { rating: -1, createdAt: -1 };
  } else if (sort === 'lowest_rating') {
    sortOption = { rating: 1, createdAt: -1 };
  }

  const [reviews, totalCount] = await Promise.all([
    Review.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate('userId', 'fullName name email')
      .populate('productId', 'name images')
      .populate('orderId', '_id razorpayOrderId createdAt')
      .lean(),
    Review.countDocuments(query),
  ]);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: reviews,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
    message: 'All reviews fetched successfully',
  });
});

const deleteReview = catchAsync(async (req, res) => {
  const { reviewId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: false,
      message: 'Invalid review ID',
    });
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    return res.status(httpStatus.NOT_FOUND).json({
      status: false,
      message: 'Review not found',
    });
  }

  const productId = review.productId;
  await Review.findByIdAndDelete(reviewId);
  await updateProductRating(productId);

  res.status(httpStatus.OK).json({
    status: true,
    message: 'Review deleted successfully',
  });
});

module.exports = {
  createReview,
  getProductReviews,
  getUserReviews,
  getAllReviews,
  deleteReview,
};