'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../../../common/middleware/async-handler');
const { validateBody } = require('../../../common/middleware/validate');
const { chatService } = require('../services/chat.service');

const chatRouter = Router();

const sendMessageSchema = z.object({
  userId: z.string(),
  conversationId: z.string().uuid(),
  message: z.string().min(1)
});

const createConversationSchema = z.object({
  userId: z.string(),
  title: z.string().optional()
});

const listConversationsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

const getTurnsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  limit: z.number().int().positive().optional(),
});

/**
 * POST /api/chat/new
 * Create a new conversation.
 */
chatRouter.post('/new', validateBody(createConversationSchema), asyncHandler(async (req, res) => {
  const { userId, title } = req.body;
  const conversation = await chatService.createConversation(userId, title);
  res.status(201).json({
    success: true,
    data: conversation
  });
}));

/**
 * POST /api/chat/send
 * Main entry point for user messages.
 * Flow: Save user message -> Call AI -> Save AI response -> Return both.
 */
chatRouter.post('/send', validateBody(sendMessageSchema), asyncHandler(async (req, res) => {
  const { userId, conversationId, message } = req.body;

  const result = await chatService.sendMessage(userId, conversationId, message);

  res.status(200).json({
    assistantMessage: result.assistantMessage
  });
}));

/**
 * POST /api/chat/list
 * List all conversations for a user. Title = AI-generated summary.
 */
chatRouter.post('/list', validateBody(listConversationsSchema), asyncHandler(async (req, res) => {
  const { userId } = req.body;

  const conversations = await chatService.getUserConversations(userId);

  res.status(200).json({
    success: true,
    data: conversations
  });
}));

/**
 * POST /api/chat/:conversationId/turns
 * Get conversation history as turns.
 */
chatRouter.post('/:conversationId/turns', validateBody(getTurnsSchema), asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { userId, limit = 50 } = req.body;

  const turns = await chatService.getConversationTurns(userId, conversationId, limit);

  res.status(200).json({
    success: true,
    data: turns
  });
}));

module.exports = { chatRouter };
