const express = require('express');
const router = express.Router();
const couponController = require('../../controllers/coupon.controller');
const firebaseAuth = require('../../middlewares/firebaseAuth');

router.get('/coupons', couponController.getAllCoupons);
router.get('/coupons/:id', couponController.getCouponById);

router.post(
  '/coupons',
//   firebaseAuth('admin'),
  couponController.createCoupon
);
router.patch(
  '/coupons/:id',
//   firebaseAuth('admin'),
  couponController.updateCoupon
);
router.delete(
  '/coupons/:id',
//   firebaseAuth('admin'),
  couponController.deleteCoupon
);

router.patch(
  '/coupons/:id/toggle-status',
//   firebaseAuth('admin'),
  couponController.toggleCouponStatus
);

module.exports = router;
