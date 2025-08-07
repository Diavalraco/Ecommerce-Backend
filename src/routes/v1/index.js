const express = require('express');

const userRoute = require('./user.route');
const authRoute = require('./auth.route');
const adminRoute = require('./admin.route');
const productRoute = require('./product.route');
const couponRoute = require('./coupon.routes');
const addressRoute = require('./address.route');

const router = express.Router();

router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/admin', adminRoute);
router.use('/adminproduct', productRoute);
router.use('/adminCoupon', couponRoute);
router.use('/addresses', addressRoute);

module.exports = router;
