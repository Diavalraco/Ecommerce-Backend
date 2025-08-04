const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    discountType: {
      type: String,
      required: true,
     num: ['percent', 'flat'],
    },
    maxDiscount: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      required: true,
      min: 0,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {timestamps: true}
);

couponSchema.index({code: 'text'});

module.exports = mongoose.model('Coupon', couponSchema);
