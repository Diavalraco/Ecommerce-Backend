const express = require('express');
const router = express.Router();
const productCategoryController = require('../../controllers/productCategory.controller');
const firebaseAuth = require('../../middlewares/firebaseAuth');
const upload = require('../../middlewares/upload');
const productCtrl = require('../../controllers/product.controller');

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

router.get('/products', productCtrl.getAllProducts);
router.get('/products/:id', productCtrl.getProductById);

router.post(
  '/products',
  //   firebaseAuth('admin'),
  upload.fields([
    {name: 'images', maxCount: 10},
    {name: 'productVideo', maxCount: 1},
  ]),
  productCtrl.createProduct
);
router.patch(
  '/products/:id',
  //   firebaseAuth('admin'),
  upload.fields([
    {name: 'images', maxCount: 10},
    {name: 'productVideo', maxCount: 1},
  ]),
  productCtrl.updateProduct
);
router.delete(
  '/products/:id',
  //   firebaseAuth('admin'),
  productCtrl.deleteProduct
);

module.exports = router;
