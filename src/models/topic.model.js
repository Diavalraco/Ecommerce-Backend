const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  featured: {
    type: Boolean,
    default: false
  },
  popular: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
    isDeleted: { type: Boolean, default: false },
}, {
  timestamps: true
});

const Topic = mongoose.model('Topic', topicSchema);
module.exports = Topic;
