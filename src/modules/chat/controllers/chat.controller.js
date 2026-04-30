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

/**
 * POST /api/chat/send
 * Main entry point for user messages.
 * Flow: Save user message -> Call AI -> Save AI response -> Return both.
 */
chatRouter.post('/send', validateBody(sendMessageSchema), asyncHandler(async (req, res) => {
  const { userId, conversationId, message } = req.body;

  const result = await chatService.sendMessage(userId, conversationId, message);

  res.status(200).json({
    success: true,
    data: {
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage
    }
  });
}));

/**
 * GET /api/chat/conversations
 * List conversations for a user.
 */
chatRouter.get('/conversations', asyncHandler(async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId query param is required' });

  const conversations = await chatService.listConversations(userId);
  res.json({ success: true, data: conversations });
}));

/**
 * GET /api/chat/messages/:conversationId
 * List messages in a conversation.
 */
chatRouter.get('/messages/:conversationId', asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId query param is required' });

  const messages = await chatService.listMessages(userId, conversationId);
  res.json({ success: true, data: messages });
}));

module.exports = { chatRouter };
