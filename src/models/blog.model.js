const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    videoLink: {
      type: String,
      default: null,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Author',
      required: true,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    topics: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    featured: {
      type: Boolean,
      default: false,
    },
    popular: {
      type: Boolean,
      default: false,
    },
    favorites: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

blogSchema.pre('save', function(next) {
  if (this.isModified('title') || this.isNew) {
    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') +
      '-' +
      Date.now();
  }

  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  next();
});

blogSchema.pre('save', async function(next) {
  if (this.isModified('categories')) {
    if (!this.isNew) {
      const original = await this.constructor.findById(this._id);
      if (original && original.categories.length) {
        await mongoose.model('Category').updateMany(
          {
            _id: {$in: original.categories},
            usedCount: {$gt: 0},
          },
          {$inc: {usedCount: -1}}
        );
      }
    }
    if (this.categories && this.categories.length) {
      await mongoose.model('Category').updateMany({_id: {$in: this.categories}}, {$inc: {usedCount: 1}});
    }
  }
  next();
});

blogSchema.pre('deleteOne', {document: true, query: false}, async function(next) {
  if (this.categories && this.categories.length) {
    await mongoose.model('Category').updateMany(
      {
        _id: {$in: this.categories},
        usedCount: {$gt: 0},
      },
      {$inc: {usedCount: -1}}
    );
  }
  next();
});

blogSchema.pre('findOneAndDelete', async function(next) {
  const doc = await this.model.findOne(this.getFilter());
  if (doc && doc.categories && doc.categories.length) {
    await mongoose.model('Category').updateMany(
      {
        _id: {$in: doc.categories},
        usedCount: {$gt: 0},
      },
      {$inc: {usedCount: -1}}
    );
  }
  next();
});
const Blog = mongoose.model('Blog', blogSchema);
module.exports = Blog;
