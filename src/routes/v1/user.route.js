const express = require('express');

const validate = require('../../middlewares/validate');
const firebaseAuth = require('../../middlewares/firebaseAuth');
const userValidation = require('../../validations/user.validation');
const publicblogController = require('../../controllers/publicblog.controller');
const {userController} = require('../../controllers');
const blogController = require('../../controllers/blog.controller');
const CategoryController = require('../../controllers/category.controller');
const favController = require('../../controllers/favorite.controller');
const {fileUploadService} = require('../../microservices');
const UserController = require('../../controllers/user.controller');
const OrderController = require('../../controllers/order.controller');
const  cartCtrl =require('../../controllers/cart.controller')
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

router.get('/public/blogs', userController.getPublicBlogs);
router.get('/public/categories', CategoryController.getAllCategories);
router.get('/public/blogs/:id', userController.getBlogById);

router.post('/blogs/:id/favorite', firebaseAuth('user'), favController.markFavorite);

router.delete('/blogs/:id/favorite', firebaseAuth('user'), favController.unmarkFavorite);
router.get('/products', UserController.getAllProducts);
router.get('/products/:id', UserController.getProductById);

router.post('/create', firebaseAuth('user'), OrderController.createOrder);

router.post('/apply-coupon', firebaseAuth('user'), OrderController.applyCoupon);
router.post('/item',firebaseAuth('user'), cartCtrl.upsertCartItem);
router.get('/cartel',firebaseAuth('user'), cartCtrl.getCart);
router.post('/verify-payment', OrderController.verifyPayment);

router.get('/admin-route', OrderController.getAllOrders);

router.get('/getuserorders',firebaseAuth('user'),  OrderController.getOrdersByUser);

router.get('/order/:id',  OrderController.getOrderById);

router.patch('/admin/orders/:orderId/status', OrderController.updateOrder);

module.exports = router;
