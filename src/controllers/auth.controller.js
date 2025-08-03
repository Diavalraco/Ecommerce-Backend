const catchAsync = require('../utils/catchAsync');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const config = require('../config/config');
const authService = require('../services/auth.service');

const createNewUserObject = (newUser, defaultRole) => ({
  email: newUser.email || null,
  phoneNumber: newUser.phone_number || null,
  firebaseUid: newUser.uid,
  isEmailVerified: newUser.email_verified || false,
  firebaseSignInProvider: newUser.firebase.sign_in_provider,
  role: defaultRole,
});

const registerUser = catchAsync(async (req, res) => {
  if (req.user) {
    return res.status(httpStatus.CONFLICT).json({
      status: false,
      message: 'User already exists',
      data: req.user,
    });
  }

  const baseObj = createNewUserObject(req.newUser, req.defaultRole);
  const userObj = {...baseObj, ...req.body};

  const user = await authService.createUser(userObj);
  if (!user) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'User registration failed');
  }

  res.status(httpStatus.CREATED).json({
    status: true,
    message: 'User registered successfully',
    data: user,
  });
});

const loginUser = catchAsync(async (req, res) => {
  res.status(httpStatus.OK).json({
    status: true,
    message: 'User logged in successfully',
    data: req.user,
  });
});

const generateToken = catchAsync(async (req, res) => {
  const {uid} = req.body;
  if (!uid) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'uid is required');
  }

  const customToken = await admin.auth().createCustomToken(uid);
  const response = await fetch(
    `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyCustomToken?key=${config.firebase.apiKey}`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token: customToken, returnSecureToken: true}),
    }
  );

  if (!response.ok) {
    throw new ApiError(httpStatus.BAD_GATEWAY, 'Failed to exchange custom token');
  }

  const {idToken} = await response.json();
  res.status(httpStatus.OK).json({
    status: true,
    message: 'Token generated successfully',
    data: {customToken, idToken},
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const {email} = req.body;
  if (!email) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email is required');
  }

  try {
    await admin.auth().getUserByEmail(email);
  } catch {
    throw new ApiError(httpStatus.NOT_FOUND, 'Email not registered');
  }

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${config.firebase.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({requestType: 'PASSWORD_RESET', email}),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, data.error?.message || 'Failed to send reset email');
  }

  res.status(httpStatus.OK).json({
    status: true,
    message: 'Password reset email sent successfully',
  });
});

module.exports = {
  registerUser,
  loginUser,
  generateToken,
  forgotPassword,
};
