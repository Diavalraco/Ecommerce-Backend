const admin = require('../microservices/firebase.service');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const authService = require('../services/auth.service');

const firebaseAuth = (requiredRole = 'any') => async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(httpStatus.BAD_REQUEST, 'Please authenticate'));
  }

  try {
    const payload = await admin.auth().verifyIdToken(token, true);
    const existing = await authService.getUserByFirebaseUId(payload.uid);

    if (!existing) {
      if (req.originalUrl.includes('/register') || req.originalUrl.includes('/admin-secretSignup')) {
        req.newUser = payload;
        req.defaultRole = requiredRole === 'admin' ? 'admin' : 'user';
      } else {
        throw new ApiError(httpStatus.NOT_FOUND, "User doesn't exist. Please register.");
      }
    } else {
      if (requiredRole !== 'any' && existing.role !== requiredRole && requiredRole !== 'both') {
        throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission");
      }
      if (existing.isBlocked) {
        throw new ApiError(httpStatus.FORBIDDEN, 'User is blocked');
      }
      if (existing.isDeleted) {
        throw new ApiError(httpStatus.GONE, "User doesn't exist anymore");
      }
      req.user = existing;
    }

    return next();
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    
    if (err.code === 'auth/id-token-expired') {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Session expired'));
    }
    
    console.error('FirebaseAuthError:', err);
    return next(new ApiError(httpStatus.UNAUTHORIZED, 'Failed to authenticate'));
  }
};

module.exports = firebaseAuth;
