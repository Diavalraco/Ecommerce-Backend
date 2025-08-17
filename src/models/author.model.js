const mongoose = require('mongoose');
const { paginate } = require('./plugins/paginate');

const authorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  profileImage: {
    type: String,
    default: null
  },
  instagramHandle: {
    type: String,
    trim: true,
    default: null
  },
  description: {
    type: String,
    trim: true,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  order: {
    type: Number,
    default: 0
  },
    isDeleted: { type: Boolean, default: false },
}, {
  timestamps: true
});

authorSchema.plugin(paginate);

const Author = mongoose.model('Author', authorSchema);

module.exports = Author;
