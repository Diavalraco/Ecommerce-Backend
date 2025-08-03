const admin = require('../microservices/firebase.service');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const authService = require('../services/auth.service');

const firebaseAuth = (requiredRole = 'any') => async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return next(new ApiError('Please authenticate', httpStatus.BAD_REQUEST));
  }

  try {
    const payload = await admin.auth().verifyIdToken(token, true);
    const existing = await authService.getUserByFirebaseUId(payload.uid);

    if (!existing) {
      if (req.originalUrl.includes('/register') || req.originalUrl.includes('/admin-secretSignup')) {
        req.newUser = payload;
        req.defaultRole = requiredRole === 'admin' ? 'admin' : 'user';
      } else {
        throw new ApiError("User doesn't exist. Please register.", httpStatus.NOT_FOUND);
      }
    } else {
      if (requiredRole !== 'any' && existing.role !== requiredRole && requiredRole !== 'both') {
        throw new ApiError("You don't have permission", httpStatus.FORBIDDEN);
      }
      if (existing.isBlocked) {
        throw new ApiError('User is blocked', httpStatus.FORBIDDEN);
      }
      if (existing.isDeleted) {
        throw new ApiError("User doesn't exist anymore", httpStatus.GONE);
      }
      req.user = existing;
    }

    return next();
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      return next(new ApiError('Session expired', httpStatus.UNAUTHORIZED));
    }
    console.error('FirebaseAuthError:', err);
    return next(new ApiError('Failed to authenticate', httpStatus.UNAUTHORIZED));
  }
};

module.exports = firebaseAuth;
