"use strict";
const { UnauthorizedError } = require("../errors/http-error");

/**
 * requireAuth
 *
 * PUBLIC ACCESS: Now allows public access with optional userId from header.
 *
 * If X-User-Id header is provided, uses that userId.
 * If not provided, uses a default test userId.
 *
 * This allows testing without authentication while still providing user context.
 */
const requireAuth = (req, res, next) => {
  try {
    const customUserId = req.headers['x-user-id'];

    if (customUserId) {
      req.user = {
        userId: customUserId,
        email: `user-${customUserId}@test.com`,
      };
    } else {
      req.user = {
        userId: 'test-user-123',
        email: 'test@example.com',
      };
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireAuth };
