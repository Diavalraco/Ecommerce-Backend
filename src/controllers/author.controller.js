const Author = require('../models/author.model');
const Blog = require('../models/blog.model');
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {cloudinary, deleteImage, extractPublicId} = require('../config/cloudinary');

const getAllAuthors = catchAsync(async (req, res) => {
  const {page = 1, limit = 10, search = '', status} = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
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
  let uploadedUrl = null;
  try {
    const {name, instagramHandle, description, status, order} = req.body;

    if (req.file && req.file.buffer) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({folder: 'blog-management'}, (error, result) =>
          error ? reject(error) : resolve(result)
        );
        stream.end(req.file.buffer);
      });
      uploadedUrl = uploadResult.secure_url;
    }

    const author = new Author({
      name,
      instagramHandle,
      description,
      status: status || 'active',
      order: order || 0,
      profileImage: uploadedUrl,
    });
    await author.save();

    res.status(201).json({
      success: true,
      message: 'Author created successfully',
      data: author,
    });
  } catch (error) {
    if (uploadedUrl) {
      const publicId = extractPublicId(uploadedUrl);
      if (publicId) await deleteImage(publicId);
    }
    res.status(400).json({
      success: false,
      message: 'Error creating author',
      error: error.message,
    });
  }
};

const updateAuthor = async (req, res) => {
  try {
    const {name, instagramHandle, description, status, order} = req.body;
    const author = await Author.findById(req.params.id);
    if (!author) return res.status(404).json({success: false, message: 'Author not found'});

    const oldImage = author.profileImage;
    author.name = name || author.name;
    author.instagramHandle = instagramHandle || author.instagramHandle;
    author.description = description || author.description;
    author.status = status || author.status;
    author.order = order !== undefined ? order : author.order;
    if (req.file) {
      author.profileImage = req.file.path;
      if (oldImage) {
        const publicId = extractPublicId(oldImage);
        if (publicId) await deleteImage(publicId);
      }
    }

    await author.save();
    res.json({success: true, message: 'Author updated successfully', data: author});
  } catch (error) {
    if (req.file) {
      const publicId = extractPublicId(req.file.path);
      if (publicId) await deleteImage(publicId);
    }
    res.status(400).json({
      success: false,
      message: 'Error updating author',
      error: error.message,
    });
  }
};

const deleteAuthor = async (req, res) => {
  try {
    const author = await Author.findById(req.params.id);
    if (!author) return res.status(404).json({success: false, message: 'Author not found'});

    const blogCount = await Blog.countDocuments({author: req.params.id});
    if (blogCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete author. Author has associated blogs.',
      });
    }

    if (author.profileImage) {
      const publicId = extractPublicId(author.profileImage);
      if (publicId) await deleteImage(publicId);
    }

    await author.deleteOne();
    res.json({success: true, message: 'Author deleted successfully'});
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting author',
      error: error.message,
    });
  }
};

const toggleAuthorStatus = async (req, res) => {
  try {
    const author = await Author.findById(req.params.id);
    if (!author) return res.status(404).json({success: false, message: 'Author not found'});

    author.status = author.status === 'active' ? 'inactive' : 'active';
    await author.save();

    res.json({
      success: true,
      message: `Author ${author.status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: author,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating author status',
      error: error.message,
    });
  }
};

module.exports = {
  getAllAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  toggleAuthorStatus,
};
