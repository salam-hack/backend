'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../../../common/middleware/async-handler');
const { validateBody } = require('../../../common/middleware/validate');
const { goalService } = require('../services/goal.service');

const goalsRouter = Router();

// ─── Validation Schemas ──────────────────────────────────────────────────────

const userIdSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

const goalIdSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  id: z.string().uuid('Invalid goal ID'),
});

const createGoalSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  targetAmount: z.number().positive('Target amount must be positive'),
  currentAmount: z.number().nonnegative().optional(),
  userExpectedDate: z.string().datetime().optional().nullable(),
});

const updateGoalSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  id: z.string().uuid('Invalid goal ID'),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  targetAmount: z.number().positive().optional(),
  currentAmount: z.number().nonnegative().optional(),
  status: z.enum(['active', 'completed', 'canceled']).optional(),
  userExpectedDate: z.string().datetime().optional().nullable(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/goals/list
 * List all goals for a user.
 */
goalsRouter.post('/list', validateBody(userIdSchema), asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const goals = await goalService.getUserGoals(userId);
  res.json({ success: true, data: goals });
}));

/**
 * POST /api/goals/detail
 * Get a single goal.
 */
goalsRouter.post('/detail', validateBody(goalIdSchema), asyncHandler(async (req, res) => {
  const { id, userId } = req.body;
  const goal = await goalService.getGoal(id, userId);
  res.json({ success: true, data: goal });
}));

/**
 * POST /api/goals/create
 * Create a new goal.
 */
goalsRouter.post('/create', validateBody(createGoalSchema), asyncHandler(async (req, res) => {
  const goal = await goalService.createGoal(req.body);
  res.status(201).json({ success: true, data: goal });
}));

/**
 * POST /api/goals/update
 * Update a goal.
 */
goalsRouter.post('/update', validateBody(updateGoalSchema), asyncHandler(async (req, res) => {
  const { id, userId, ...data } = req.body;
  const goal = await goalService.updateGoal(id, userId, data);
  res.json({ success: true, data: goal });
}));

/**
 * POST /api/goals/delete
 * Delete a goal.
 */
goalsRouter.post('/delete', validateBody(goalIdSchema), asyncHandler(async (req, res) => {
  const { id, userId } = req.body;
  await goalService.deleteGoal(id, userId);
  res.json({ success: true, message: 'Goal deleted successfully' });
}));

module.exports = { goalsRouter };
