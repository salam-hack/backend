'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../../../common/middleware/async-handler');
const { validateBody } = require('../../../common/middleware/validate');
const { successResponse } = require('../../../common/utils/response');
const { insightsService } = require('../services/insights.service');

const insightsRouter = Router();

const insightsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

// POST /api/insights
insightsRouter.post(
  '/',
  validateBody(insightsSchema),
  asyncHandler(async (req, res) => {
    const data = await insightsService.getInsights(req.body.userId);
    successResponse(res, data);
  }),
);

module.exports = { insightsRouter };
