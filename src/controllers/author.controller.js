const Author = require('../models/author.model');
const path = require('path');
const Blog = require('../models/blog.model');
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
// const {cloudinary, deleteImage, extractPublicId} = require('../config/cloudinary');
const {uploadImage, deleteImage, extractKey} = require('../config/r2');

const getAllAuthors = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', status} = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const query = {isDeleted: false};
  if (search.trim() !== '') {
    query.name = {$regex: search.trim(), $options: 'i'};
  }
  if (status) {
    query.status = status;
  }

  const authors = await Author.find(query)
    .sort({order: 1, createdAt: -1})
    .skip(skip)
    .limit(limitNum);

  const totalCount = await Author.countDocuments(query);

  res.status(httpStatus.OK).json({
    status: true,
    data: {
      page: pageNum,
      limit: limitNum,
      results: authors,
      totalPages: Math.ceil(totalCount / limitNum),
      totalResults: totalCount,
    },
  });
});

const getAuthorById = async (req, res) => {
  try {
    const author = await Author.findById(req.params.id);
    if (!author) return res.status(404).json({success: false, message: 'Author not found'});
    res.json({success: true, data: author});
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching author',
      error: error.message,
    });
  }
};

const createAuthor = async (req, res) => {
  let newKey = null;
  let signedUrl = null;
  try {
    const {name, instagramHandle, description, status, order} = req.body;

    if (req.file && req.file.buffer) {
      const ext = path.extname(req.file.originalname);
      newKey = `blog-management/authors/${Date.now()}${ext}`;

      const result = await uploadImage({
        buffer: req.file.buffer,
        key: newKey,
        contentType: req.file.mimetype,
      });
      signedUrl = result.url;
    }

    const author = new Author({
      name,
      instagramHandle,
      description,
      status: status || 'active',
      order: order || 0,
      profileImage: signedUrl,
    });
    await author.save();

    res.status(201).json({
      success: true,
      message: 'Author created successfully',
      data: author,
    });
  } catch (error) {
    if (newKey) {
      await deleteImage(newKey);
    }
    res.status(400).json({
      success: false,
      message: 'Error creating author',
      error: error.message,
    });
  }
};

const updateAuthor = catchAsync(async (req, res) => {
  try {
    const {name, instagramHandle, description, status, order} = req.body;
    const author = await Author.findById(req.params.id);
    if (!author) {
      return res.status(httpStatus.NOT_FOUND).json({success: false, message: 'Author not found'});
    }

    const oldImageUrl = author.profileImage;
    let newKey = null,
      signedUrl = null;

    author.name = name || author.name;
    author.instagramHandle = instagramHandle || author.instagramHandle;
    author.description = description || author.description;
    author.status = status || author.status;
    author.order = order ?? author.order;

    if (req.file && req.file.buffer) {
      const ext = path.extname(req.file.originalname);
      newKey = `blog-management/authors/${Date.now()}${ext}`;

      const result = await uploadImage({
        buffer: req.file.buffer,
        key: newKey,
        contentType: req.file.mimetype,
      });
      signedUrl = result.url;

      author.profileImage = signedUrl;

      if (oldImageUrl) {
        const oldKey = extractKey(oldImageUrl);
        if (oldKey) await deleteImage(oldKey);
      }
    }

    await author.save();
    res.json({
      success: true,
      message: 'Author updated successfully',
      data: author,
    });
  } catch (error) {
    if (newKey) {
      await deleteImage(newKey);
    }
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Error updating author',
      error: error.message,
    });
  }
});
const deleteAuthor = catchAsync(async (req, res) => {
  try {
    const author = await Author.findById(req.params.id);
    if (!author) {
      return res.status(404).json({success: false, message: 'Author not found'});
    }
    if (author.isDeleted) {
      return res.status(400).json({success: false, message: 'Author already deleted'});
    }

    const blogCount = await Blog.countDocuments({author: req.params.id});

    if (blogCount > 0) {
      author.isDeleted = true;
      author.status = 'inactive';
      await author.save();

      return res.json({
        success: true,
        message: 'Author soft-deleted because they have associated blogs',
        data: author,
      });
    }

    if (author.profileImage) {
      const key = extractKey(author.profileImage);
      if (key) {
        try {
          await deleteImage(key);
        } catch (err) {
          console.warn('Failed to delete author image for key:', key, err);
        }
      }
    }

    await author.deleteOne();

    return res.json({success: true, message: 'Author deleted successfully'});
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error deleting author',
      error: error.message,
    });
  }
});

module.exports = {
  getAllAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,
};
