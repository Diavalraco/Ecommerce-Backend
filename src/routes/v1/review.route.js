const express = require('express');
const reviewController = require('../../controllers/review.controller');
const firebaseAuth = require('../../middlewares/firebaseAuth');

const router = express.Router();

router.get('/product/:productId', reviewController.getProductReviews);

router.post('/', firebaseAuth('user'), reviewController.createReview);
router.get('/my-reviews',firebaseAuth('user'), reviewController.getUserReviews);

router.get('/admin/all', reviewController.getAllReviews);
router.delete('/admin/:reviewId', reviewController.deleteReview);
router.patch('/admin-review/:reviewId', reviewController.updateReviewStatus);

module.exports = router;