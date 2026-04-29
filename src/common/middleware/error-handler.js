'use strict';
const { ZodError } = require('zod');
const { AppError } = require('../errors/app-error');
const { env } = require('../../config/env');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Operational errors (HttpError subclasses)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.flatten(),
    });
  }

  // Unknown / programmer errors
  if (env.nodeEnv !== 'production') {
    console.error('[ERROR]', err);
  } else {
    console.error('[ERROR]', err.message);
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};

module.exports = { errorHandler };
