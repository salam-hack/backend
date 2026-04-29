'use strict';

/**
 * Validate req.body against a Zod schema.
 * Passes ZodError to next() on failure.
 */
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(result.error);
  req.body = result.data;
  next();
};

/**
 * Validate req.params against a Zod schema.
 */
const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) return next(result.error);
  req.params = result.data;
  next();
};

/**
 * Validate req.query against a Zod schema.
 */
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) return next(result.error);
  req.query = result.data;
  next();
};

module.exports = { validateBody, validateParams, validateQuery };
