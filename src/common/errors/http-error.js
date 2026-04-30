'use strict';
const { AppError } = require('./app-error');

class BadRequestError extends AppError {
  constructor(message = 'Bad request') { super(message, 400); }
}
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401); }
}
class NotFoundError extends AppError {
  constructor(message = 'Resource not found') { super(message, 404); }
}
class InternalError extends AppError {
  constructor(message = 'Internal server error') { super(message, 500); }
}

module.exports = {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  InternalError,
};
