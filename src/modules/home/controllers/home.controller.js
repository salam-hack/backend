'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../../../common/middleware/async-handler');
const { validateQuery } = require('../../../common/middleware/validate');
const { successResponse } = require('../../../common/utils/response');
const { homeService } = require('../services/home.service');

const homeRouter = Router();

const dashboardQuerySchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
});

// GET /api/home?user_id=1
homeRouter.get(
  '/',
  validateQuery(dashboardQuerySchema),
  asyncHandler(async (req, res) => {
    const data = await homeService.getDashboard(req.query.user_id);
    successResponse(res, data);
  }),
);

module.exports = { homeRouter };