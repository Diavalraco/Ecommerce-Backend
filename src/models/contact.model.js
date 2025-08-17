const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phonenumber: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  isDeleted: { 
    type: Boolean, 
    default: false 
  },
}, {
  timestamps: true
});

const Contact = mongoose.model('Contact', contactSchema);
module.exports = Contact;