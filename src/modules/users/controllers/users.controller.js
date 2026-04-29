'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../../../common/middleware/async-handler');
const { requireAuth } = require('../../../common/middleware/auth-middleware');
const { validateBody } = require('../../../common/middleware/validate');
const { successResponse } = require('../../../common/utils/response');
const { usersService } = require('../services/users.service');

const usersRouter = Router();

const updateMeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  defaultCurrency: z.string().length(3).toUpperCase().optional(),
  locale: z.string().min(2).max(10).optional(),
  timezone: z.string().min(1).max(80).optional(),
}).strict();

// All user routes require authentication
usersRouter.use(requireAuth);

// GET /api/v1/users/me
usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await usersService.getMe(req.user.userId);
    successResponse(res, user);
  }),
);

// PATCH /api/v1/users/me
usersRouter.patch(
  '/me',
  validateBody(updateMeSchema),
  asyncHandler(async (req, res) => {
    const user = await usersService.updateMe(req.user.userId, req.body);
    successResponse(res, user);
  }),
);

module.exports = { usersRouter };
