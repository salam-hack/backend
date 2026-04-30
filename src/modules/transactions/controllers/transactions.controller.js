'use strict';

const { Router } = require('express');
const { prisma } = require('../../../prisma/client');
const { transactionsService } = require('../services/transactions.service');
const { getCategoryId, getCategoryName } = require('../constants/categories');

const transactionsRouter = Router();

// POST /api/transactions/add-manual
transactionsRouter.post('/add-manual', async (req, res) => {
  const { userId, title, amount, type, categoryId, date } = req.body;
  if (!userId || !title || !amount || !type || !categoryId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const data = await transactionsService.addManual(userId, req.body);
    
    // Handle assistant message
    let assistantMessage = null;
    const conversationId = req.body.conversationId;
    
    if (conversationId) {
      const { chatRepository } = require('../../chat/repositories/chat.repository');
      assistantMessage = await chatRepository.createMessage({
        conversationId,
        userId,
        role: 'assistant',
        content: `تمت إضافة ${data.type === 'expense' ? 'مصروف' : 'دخل'}: ${data.item} بمبلغ ${data.amount} ${data.currency}`,
        status: 'completed'
      });
    } else {
      assistantMessage = {
        id: require('crypto').randomUUID(),
        role: 'assistant',
        content: `تمت إضافة ${data.type === 'expense' ? 'مصروف' : 'دخل'}: ${data.item} بمبلغ ${data.amount} ${data.currency}`,
        status: 'completed'
      };
    }

    res.status(201).json({
      success: true,
      data: {
        id: data.id,
        title: data.item || data.notes || 'Transaction',
        amount: Number(data.amount),
        currency: data.currency,
        type: data.type,
        categoryId,
        date: data.transactionDate.toISOString().split('T')[0],
        transactionDate: data.transactionDate.toISOString(),
      },
      assistantMessage
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/transactions/parse-ai
transactionsRouter.post('/parse-ai', async (req, res) => {
  const message = req.body.message ?? req.body.text;
  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

  try {
    const data = await transactionsService.parseAi(message);
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: "AI_PARSER_UNAVAILABLE" });
  }
});

// GET /api/transactions/categories
transactionsRouter.get('/categories', async (req, res) => {
  try {
    const categories = transactionsService.getCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/all
transactionsRouter.get('/all', async (req, res) => {
  try {
    const { userId, limit = '50', offset = '0', type, category, categoryId, from, to } = req.query;
    const limitNum = parseInt(limit, 10) || 50;
    const offsetNum = parseInt(offset, 10) || 0;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Build where clause
    const where = { userId };
    if (type) where.type = type;
    if (category) where.category = category;
    if (categoryId) where.category = getCategoryName(categoryId) || categoryId;
    if (from || to) {
      where.transactionDate = {};
      if (from) where.transactionDate.gte = new Date(from);
      if (to) where.transactionDate.lte = new Date(to);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      take: limitNum,
      skip: offsetNum,
      select: {
        id: true,
        amount: true,
        currency: true,
        category: true,
        item: true,
        quantity: true,
        type: true,
        source: true,
        rawText: true,
        confidence: true,
        notes: true,
        transactionDate: true,
        createdAt: true,
        rawNote: {
          select: {
            content: true,
            status: true
          }
        }
      }
    });

    const total = await prisma.transaction.count({ where });

    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      title: tx.item || tx.notes || 'Transaction',
      amount: Number(tx.amount),
      currency: tx.currency,
      type: tx.type,
      categoryId: getCategoryId(tx.category) || 'EXP_OTHER',
      item: tx.item,
      quantity: tx.quantity,
      source: tx.source,
      rawText: tx.rawText,
      confidence: tx.confidence,
      notes: tx.notes,
      date: tx.transactionDate.toISOString().split('T')[0],
      time: tx.transactionDate.toISOString().split('T')[1].split('.')[0],
      transactionDate: tx.transactionDate.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      rawNote: tx.rawNote ? {
        content: tx.rawNote.content,
        status: tx.rawNote.status,
      } : null,
    }));

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < total,
        },
        filters: { type, category, categoryId, from, to },
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { transactionsRouter };
