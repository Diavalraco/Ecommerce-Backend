const express = require('express');

const validate = require('../../middlewares/validate');
const firebaseAuth = require('../../middlewares/firebaseAuth');
const {authValidation} = require('../../validations');
const upload = require('../../middlewares/upload');
const {authController} = require('../../controllers');

const router = express.Router();

router.post('/register', firebaseAuth('user'), authController.registerUser);

router.post('/admin-secretSignup', firebaseAuth('admin'), authController.registerUser);
router.post('/login', firebaseAuth('any'), authController.loginUser);
router.post('/token', authController.generateToken);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/profile', firebaseAuth('user'), upload.single('profileImage'), authController.updateProfile);

module.exports = router;
