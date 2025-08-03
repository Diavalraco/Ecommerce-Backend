const express = require('express');

const userRoute = require('./user.route');
const authRoute = require('./auth.route');
const adminRoute = require('./admin.route');

const router = express.Router();

router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/admin', adminRoute);

module.exports = router;
