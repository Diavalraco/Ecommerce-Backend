const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Products',
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'hidden', 'reported'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({userId: 1, productId: 1}, {unique: true});

reviewSchema.index({productId: 1, status: 1});
reviewSchema.index({userId: 1});
reviewSchema.index({orderId: 1});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
