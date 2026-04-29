'use strict';
const { AppError } = require('./app-error');

class BadRequestError extends AppError {
  constructor(message = 'Bad request') { super(message, 400); }
}
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401); }
}
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403); }
}
class NotFoundError extends AppError {
  constructor(message = 'Resource not found') { super(message, 404); }
}
class ConflictError extends AppError {
  constructor(message = 'Conflict') { super(message, 409); }
}
class UnprocessableError extends AppError {
  constructor(message = 'Unprocessable entity') { super(message, 422); }
}
class InternalError extends AppError {
  constructor(message = 'Internal server error') { super(message, 500); }
}

module.exports = {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableError,
  InternalError,
};
