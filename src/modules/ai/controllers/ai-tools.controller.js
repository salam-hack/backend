'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../../../common/middleware/async-handler');
const { validateBody } = require('../../../common/middleware/validate');
const { env } = require('../../../config/env');
const { prisma } = require('../../../prisma/client');
const { chatService } = require('../../chat/services/chat.service');
const { aiChatService } = require('../services/ai-chat.service');

const aiToolsRouter = Router();

// Internal endpoints for AI, not for frontend
aiToolsRouter.get('/user-profile/:user_id', asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user_id,
      transactionDate: { gte: startOfMonth, lte: endOfMonth }
    },
    select: { amount: true, type: true }
  });

  let income = 0;
  let expenses = 0;

  transactions.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') income += amt;
    else if (tx.type === 'expense') expenses += amt;
  });

  const savings = income - expenses;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  const goalsData = await prisma.goal.findMany({
    where: { userId: user_id },
    select: { id: true, title: true, targetAmount: true, currentAmount: true, status: true }
  });

  const goals = {
    active: goalsData.filter(g => g.status === 'active'),
    completed: goalsData.filter(g => g.status === 'completed'),
    cancelled: goalsData.filter(g => g.status === 'cancelled')
  };

  const behaviorSummary = {
    is_disciplined: savingsRate > 20,
    is_overspending: expenses > income * 0.8,
    is_goal_oriented: goals.active.length > 0
  };

  const user = await prisma.user.findUnique({
    where: { id: user_id },
    select: { name: true, email: true }
  });

  const response = {
    financial_profile: { income, expenses, savings, savings_rate: savingsRate },
    goals,
    behavior_summary: behaviorSummary,
    personal_info: { name: user?.name || '', email: user?.email || '' }
  };

  res.status(200).json(response);
}));

// Get current date
aiToolsRouter.get('/current-date', asyncHandler(async (req, res) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  res.status(200).send(`${yyyy}-${mm}-${dd}`);
}));

// Get conversation summary
aiToolsRouter.get('/conversation-summary/:conversation_id', asyncHandler(async (req, res) => {
  const { conversation_id } = req.params;
  const userId = req.query.userId;

  if (!userId) return res.status(400).json({ error: 'userId required' });

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversation_id, userId, status: 'active' },
    select: { summary: true }
  });

  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  res.status(200).json({ summary: conversation.summary || '' });
}));

const patchSummarySchema = z.object({
  summary: z.string().min(1).max(2000)
});

// Patch conversation summary
aiToolsRouter.patch('/conversation-summary/:conversation_id', validateBody(patchSummarySchema), asyncHandler(async (req, res) => {
  const { conversation_id } = req.params;
  const { summary } = req.body;
  const userId = req.query.userId;

  if (!userId) return res.status(400).json({ error: 'userId required' });

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversation_id, userId, status: 'active' }
  });

  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  await prisma.conversation.update({
    where: { id: conversation_id },
    data: { summary }
  });

  res.status(200).json({
    success: true,
    message: 'Summary updated successfully',
    conversationId: conversation_id
  });
}));

// Get last turns of a conversation
aiToolsRouter.get('/conversation-turns/:conversation_id', asyncHandler(async (req, res) => {
  const { conversation_id } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  const userId = req.query.userId;

  if (!userId) return res.status(400).json({ error: 'userId required' });

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversation_id, userId, status: 'active' }
  });

  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const messages = await prisma.message.findMany({
    where: {
      conversationId: conversation_id,
      status: 'completed',
      role: { in: ['user', 'assistant'] }
    },
    orderBy: { createdAt: 'desc' },
    take: limit * 2,
    select: { role: true, content: true }
  });

  const reversedMessages = messages.reverse();
  const turns = [];
  let currentTurn = null;

  for (const msg of reversedMessages) {
    if (msg.role === 'user') {
      if (currentTurn) turns.push(currentTurn);
      currentTurn = { user: msg.content, assistant: null };
    } else if (msg.role === 'assistant' && currentTurn) {
      currentTurn.assistant = msg.content;
    }
  }

  if (currentTurn) turns.push(currentTurn);

  const lastTurns = turns.slice(-limit);

  res.status(200).json({ turns: lastTurns });
}));

// Get all turns of a conversation
aiToolsRouter.get('/conversation-all-turns/:conversation_id', asyncHandler(async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const { conversation_id } = req.params;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversation_id, userId, status: 'active' }
  });

  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const messages = await prisma.message.findMany({
    where: {
      conversationId: conversation_id,
      status: 'completed',
      role: { in: ['user', 'assistant'] }
    },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true }
  });

  const turns = [];
  let currentTurn = null;

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (currentTurn) turns.push(currentTurn);
      currentTurn = { user: msg.content, assistant: null };
    } else if (msg.role === 'assistant' && currentTurn) {
      currentTurn.assistant = msg.content;
    }
  }

  if (currentTurn) turns.push(currentTurn);

  res.status(200).json({ turns });
}));

aiToolsRouter.get('/current-date', asyncHandler(async (req, res) => {
  res.json(new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }));
}));

module.exports = { aiToolsRouter };
