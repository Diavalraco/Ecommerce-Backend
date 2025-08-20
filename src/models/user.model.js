const mongoose = require('mongoose');
const {paginate} = require('./plugins/paginate');
const userSchema = new mongoose.Schema(
  {
    email: {type: String},
    firebaseUid: {type: String, required: true, unique: true},
    phoneNumber: {type: String},
    firebaseSignInProvider: String,
    role: {type: String, enum: ['user', 'admin'], default: 'user'},
    isBlocked: {type: Boolean, default: false},
    isDeleted: {type: Boolean, default: false},
    fullName: {type: String, trim: true, default: null},
    gender: {type: String, default: null},
    dateOfBirth: {type: Date, default: null},
    profileImage: {type: String, default: null},
  },
  {timestamps: true}
);

userSchema.plugin(paginate);

const User = mongoose.model('User', userSchema);

module.exports = {
  User,
};
