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

module.exports = { chatRouter };
