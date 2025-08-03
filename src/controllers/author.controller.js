const Author = require('../models/author.model');
const Blog = require('../models/blog.model');
const { deleteImage, extractPublicId } = require('../config/cloudinary');

const getAllAuthors = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const query = {};
    if (search)    query.name = { $regex: search, $options: 'i' };
    if (status)    query.status = status;

    const authors = await Author.find(query)
      .sort({ order: 1, createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Author.countDocuments(query);

    res.json({
      success: true,
      data: authors,
      pagination: {
        current: Number(page),
        total: Math.ceil(total / Number(limit)),
        count: authors.length,
        totalRecords: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching authors',
      error: error.message
    });
  }
};

const getAuthorById = async (req, res) => {
  try {
    const author = await Author.findById(req.params.id);
    if (!author) return res.status(404).json({ success: false, message: 'Author not found' });
    res.json({ success: true, data: author });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching author',
      error: error.message
    });
  }
};


const createAuthor = async (req, res) => {
  try {
    const { name, instagramHandle, description, status, order } = req.body;
    const author = new Author({
      name,
      instagramHandle,
      description,
      status: status || 'active',
      order: order || 0,
      profileImage: req.file ? req.file.path : undefined
    });
    await author.save();
    res.status(201).json({
      success: true,
      message: 'Author created successfully',
      data: author
    });
  } catch (error) {
    if (req.file) {
      const publicId = extractPublicId(req.file.path);
      if (publicId) await deleteImage(publicId);
    }
    res.status(400).json({
      success: false,
      message: 'Error creating author',
      error: error.message
    });
  }
};


const updateAuthor = async (req, res) => {
  try {
    const { name, instagramHandle, description, status, order } = req.body;
    const author = await Author.findById(req.params.id);
    if (!author) return res.status(404).json({ success: false, message: 'Author not found' });

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
    res.json({ success: true, message: 'Author updated successfully', data: author });
  } catch (error) {
    if (req.file) {
      const publicId = extractPublicId(req.file.path);
      if (publicId) await deleteImage(publicId);
    }
    res.status(400).json({
      success: false,
      message: 'Error updating author',
      error: error.message
    });
  }
};

const deleteAuthor = async (req, res) => {
  try {
    const author = await Author.findById(req.params.id);
    if (!author) return res.status(404).json({ success: false, message: 'Author not found' });

    const blogCount = await Blog.countDocuments({ author: req.params.id });
    if (blogCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete author. Author has associated blogs.'
      });
    }

    if (author.profileImage) {
      const publicId = extractPublicId(author.profileImage);
      if (publicId) await deleteImage(publicId);
    }

    await author.deleteOne();
    res.json({ success: true, message: 'Author deleted successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting author',
      error: error.message
    });
  }
};

const toggleAuthorStatus = async (req, res) => {
  try {
    const author = await Author.findById(req.params.id);
    if (!author) return res.status(404).json({ success: false, message: 'Author not found' });

    author.status = author.status === 'active' ? 'inactive' : 'active';
    await author.save();

    res.json({
      success: true,
      message: `Author ${author.status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: author
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating author status',
      error: error.message
    });
  }
};

module.exports = {
  getAllAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  toggleAuthorStatus
};
