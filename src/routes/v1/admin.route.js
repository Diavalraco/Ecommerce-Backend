const express = require('express');
const router = express.Router();
const blogController = require('../../controllers/blog.controller');
const authorController = require('../../controllers/author.controller');
const CategoryController = require('../../controllers/category.controller');
const firebaseAuth = require('../../middlewares/firebaseAuth');
const TopicController = require('../../controllers/topic.controller');
const upload = require('../../middlewares/upload');
const {uploadMedia: uploadCtrl} = require('../../controllers/video.controller');

router.get('/blogs', blogController.getAllBlogs);
router.get('/blogs/:id', blogController.getBlogById);
router.post('/blogs', upload.single('thumbnail'), blogController.createBlog);
router.put('/blogs/:id', firebaseAuth('admin'), upload.single('thumbnail'), blogController.updateBlog);
router.delete('/blogs/:id', firebaseAuth('admin'), blogController.deleteBlog);
router.patch('/blogs/:id/toggle-status', firebaseAuth('admin'), blogController.toggleBlogStatus);
router.patch('/blogs/:id/toggle-featured', firebaseAuth('admin'), blogController.toggleFeatured);
router.patch('/blogs/:id/toggle-popular', firebaseAuth('admin'), blogController.togglePopular);

router.get('/authors', authorController.getAllAuthors);
router.get('/authors/:id', authorController.getAuthorById);
router.post('/authors', upload.single('profileImage'), authorController.createAuthor);
router.put('/authors/:id', firebaseAuth('admin'), upload.single('profileImage'), authorController.updateAuthor);
router.delete('/authors/:id', firebaseAuth('admin'), authorController.deleteAuthor);
router.patch('/authors/:id/toggle-status', firebaseAuth('admin'), authorController.toggleAuthorStatus);

router.get('/categories', CategoryController.getAllCategories);
router.get('/categories/:id', CategoryController.getCategoryById);
router.post('/categories', upload.single('image'), CategoryController.createCategory);
router.put('/categories/:id', firebaseAuth('admin'), upload.single('categoryImage'), CategoryController.updateCategory);
router.delete('/categories/:id', firebaseAuth('admin'), CategoryController.deleteCategory);
router.patch('/categories/:id/toggle-status', firebaseAuth('admin'), CategoryController.toggleCategoryStatus);
router.patch('/categories/:id/toggle-featured', firebaseAuth('admin'), CategoryController.toggleCategoryFeatured);
router.patch('/categories/:id/toggle-popular', firebaseAuth('admin'), CategoryController.toggleCategoryPopular);

router.get('/topics', TopicController.getAllTopics);
router.get('/topics/:id', TopicController.getTopicById);
router.post('/topics', TopicController.createTopic);
router.put('/topics/:id', firebaseAuth('admin'), TopicController.updateTopic);
router.delete('/topics/:id', firebaseAuth('admin'), TopicController.deleteTopic);
router.patch('/topics/:id/toggle-status', firebaseAuth('admin'), TopicController.toggleTopicStatus);
router.patch('/topics/:id/toggle-featured', firebaseAuth('admin'), TopicController.toggleTopicFeatured);
router.patch('/topics/:id/toggle-popular', firebaseAuth('admin'), TopicController.toggleTopicPopular);


router.post('/media', upload.single('file'), uploadCtrl);

module.exports = router;
