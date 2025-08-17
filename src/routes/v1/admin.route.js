const express = require('express');
const router = express.Router();
const blogController = require('../../controllers/blog.controller');
const authorController = require('../../controllers/author.controller');
const CategoryController = require('../../controllers/category.controller');
const UserController = require('../../controllers/user.controller');
const firebaseAuth = require('../../middlewares/firebaseAuth');
const TopicController = require('../../controllers/topic.controller');
const contactController = require('../../controllers/contact.controller');
const upload = require('../../middlewares/upload');
const {uploadMedia: uploadCtrl} = require('../../controllers/video.controller');
const statsController = require('../../controllers/stats.controller');

router.get('/blogs', blogController.getAllBlogs);
router.get('/blogs/:id', blogController.getBlogById);
router.post('/blogs', upload.single('thumbnail'), blogController.createBlog);
router.patch('/blogs/:id', upload.single('thumbnail'), blogController.updateBlog);
router.delete('/blogs/:id', blogController.deleteBlog);

router.get('/authors', authorController.getAllAuthors);
router.get('/authors/:id', authorController.getAuthorById);
router.post('/authors', upload.single('profileImage'), authorController.createAuthor);
router.patch('/authors/:id', upload.single('profileImage'), authorController.updateAuthor);
router.delete('/authors/:id', authorController.deleteAuthor);

router.get('/categories', CategoryController.getAllCategories);
router.get('/categories/:id', CategoryController.getCategoryById);
router.post('/categories', upload.single('image'), CategoryController.createCategory);
router.patch('/categories/:id', upload.single('image'), CategoryController.updateCategory);
router.delete('/categories/:id', CategoryController.deleteCategory);

router.get('/topics', TopicController.getAllTopics);
router.get('/topics/:id', TopicController.getTopicById);
router.post('/topics', TopicController.createTopic);
router.patch('/topics/:id', TopicController.updateTopic);
router.delete('/topics/:id', TopicController.deleteTopic);

router.post('/media', upload.single('file'), uploadCtrl);
router.get('/users', UserController.getAllUsers);

router.get('/users/:userId', UserController.getUserById);
router.put('/users/:userId/block-status', UserController.toggleUserBlockStatus);

router.get('/contacts', contactController.getAllContactQueries);

router.get('/stats', statsController.getAdminStats);
router.get('/stats/revenue', firebaseAuth('admin'), statsController.getRevenueStats);
router.get('/stats/orders', firebaseAuth('admin'), statsController.getOrderStatusStats);

module.exports = router;
