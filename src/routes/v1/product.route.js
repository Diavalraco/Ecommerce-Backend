const express = require('express');
const router = express.Router();
const productCategoryController = require('../../controllers/productCategory.controller');
const firebaseAuth = require('../../middlewares/firebaseAuth');
const upload = require('../../middlewares/upload');

router.get('/product-categories', productCategoryController.getAllProductCategories);
router.get('/product-categories/:id', productCategoryController.getProductCategoryById);

router.post(
  '/product-categories',
  //   firebaseAuth('admin'),
  upload.single('thumbnail'),
  productCategoryController.createProductCategory
);
router.patch(
  '/product-categories/:id',
  //   firebaseAuth('admin'),
  upload.single('thumbnail'),
  productCategoryController.updateProductCategory
);
router.delete(
  '/product-categories/:id',
  //  firebaseAuth('admin'),
  productCategoryController.deleteProductCategory
);

module.exports = router;
