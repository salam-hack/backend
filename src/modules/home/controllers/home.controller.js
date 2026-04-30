'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../../../common/middleware/async-handler');
const { validateBody } = require('../../../common/middleware/validate');
const { successResponse } = require('../../../common/utils/response');
const { homeService } = require('../services/home.service');

const homeRouter = Router();

const dashboardSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

// POST /api/home
homeRouter.post(
  '/',
  validateBody(dashboardSchema),
  asyncHandler(async (req, res) => {
    const data = await homeService.getDashboard(req.body.userId);
    successResponse(res, data);
  }),
);

module.exports = { homeRouter };
