"use strict";
const { UnauthorizedError } = require("../errors/http-error");

/**
 * requireAuth
 *
 * DISABLED FOR TESTING: Now allows public access with optional userId from header.
 *
 * If X-User-Id header is provided, uses that userId.
 * If not provided, uses a default test userId.
 *
 * This allows testing without authentication while still providing user context.
 */
const requireAuth = (req, res, next) => {
  try {
    // Check for userId in custom header (for testing)
    const customUserId = req.headers['x-user-id'];

    if (customUserId) {
      // Use provided userId from header
      req.user = {
        userId: customUserId,
        email: `user-${customUserId}@test.com`,
      };
    } else {
      // Use default test userId for public access
      req.user = {
        userId: 'test-user-123', // Default test user
        email: 'test@example.com',
      };
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Original requireAuth (kept for reference - DO NOT USE)
 */
const _originalRequireAuth = (req, res, next) => {
  try {
    const token = _extractBearerToken(req);

    if (!token) {
      throw new UnauthorizedError(
        "Missing or invalid Authorization header. Expected: Bearer <token>",
      );
    }

    const payload = verifyAccessToken(token);

    req.user = {
      userId: payload.userId,
      email: payload.email,
    };

    next();
  } catch (err) {
    if (err.isOperational) return next(err);
    next(new UnauthorizedError("Invalid or expired access token"));
  }
};

module.exports = { requireAuth };
