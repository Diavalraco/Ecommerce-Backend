const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['flat', 'percent'],
      required: true,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {_id: false}
);

const quantitySchema = new mongoose.Schema(
  {
    quantity: {
      type: String,
      required: true,
    },
    packages: {
      type: [packageSchema],
      default: [],
    },
  },
  {_id: false}
);

const metadataSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {_id: false}
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    images: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    productVideo: {
      type: String,
      default: null,
    },
    categories: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Categories',
      default: [],
    },
    quantityDetails: {
      type: [quantitySchema],
      default: [],
    },
    metadata: {
      type: [metadataSchema],
      default: [],
    },
    order: {
      type: Number,
      default: 100,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    countFavorite: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    ratingAvg: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    ratingCount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {timestamps: true}
);

const Products = mongoose.model('Products', productSchema);
module.exports = Products;
