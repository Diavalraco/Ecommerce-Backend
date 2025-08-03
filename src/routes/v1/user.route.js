const express = require('express');

const validate = require('../../middlewares/validate');
const firebaseAuth = require('../../middlewares/firebaseAuth');
const userValidation = require('../../validations/user.validation');
const publicblogController = require('../../controllers/publicblog.controller');
const {userController} = require('../../controllers');
const blogController = require('../../controllers/blog.controller');
const CategoryController = require('../../controllers/category.controller');
const  favController  = require('../../controllers/favorite.controller');
const {fileUploadService} = require('../../microservices');

const router = express.Router();

// for updating userDetails
router.patch(
  '/updateDetails',
  fileUploadService.multerUpload.single('profilePic'),
  firebaseAuth('All'),
  validate(userValidation.updateDetails),
  userController.updateUser
);

// for updating specific user preferences
router.patch(
  '/updatePreferences',
  validate(userValidation.updateUserPreferences),
  firebaseAuth('All'),
  userController.updatePreferences
);

// for deleting a user
router.delete('/:userId', validate(userValidation.deleteUser), firebaseAuth('Admin'), userController.deleteUser);

// to soft delete a user
router.post('/delete/:userId', validate(userValidation.deleteUser), firebaseAuth('All'), userController.softDeleteUser);

router.get('/public/blogs',firebaseAuth('user'), userController.getPublicBlogs);
router.get('/public/blogs/category/:categoryId', publicblogController.getBlogsByCategory);
router.get('/public/categories', CategoryController.getAllCategories);
router.get('/public/blogs/:id', blogController.getBlogById);


router.post(
  '/blogs/:id/favorite',
  firebaseAuth('user'),
  favController.markFavorite
);

router.delete(
  '/blogs/:id/favorite',
  firebaseAuth('user'),
  favController.unmarkFavorite
);

router.get(
  '/users/favorites',
  firebaseAuth('user'),
  favController.getMyFavorites
);

module.exports = router;
