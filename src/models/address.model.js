const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    zipcode: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Other',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

addressSchema.index({userId: 1, address: 1}, {unique: true});

addressSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany({userId: this.userId, _id: {$ne: this._id}}, {isDefault: false});
  }
  next();
});

addressSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update.isDefault === true) {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      await this.model.updateMany({userId: docToUpdate.userId, _id: {$ne: docToUpdate._id}}, {isDefault: false});
    }
  }
  next();
});

const Address = mongoose.model('Address', addressSchema);

module.exports = Address;
