'use strict';
const { NotFoundError, BadRequestError } = require('../../../common/errors/http-error');
const { transactionsRepository } = require('../repositories/transactions.repository');
const { aiService } = require('../../ai/services/ai.service');
const { prisma } = require('../../../prisma/client');
const { env } = require('../../../config/env');

// Category to ID mapping (matching classification system)
const CATEGORY_ID_MAP = {
  'Food': 'EXP_FOOD',
  'Transport': 'EXP_TRANSPORT',
  'Bills': 'EXP_BILLS',
  'Shopping': 'EXP_SHOPPING',
  'Entertainment': 'EXP_ENTERTAINMENT',
  'Health': 'EXP_HEALTH',
  'Education': 'EXP_EDUCATION',
  'Gifts': 'EXP_GIFTS',
  'Other': 'EXP_OTHER',
  'Salary': 'INC_SALARY',
  'Freelance': 'INC_FREELANCE',
  'Investments': 'INC_INVESTMENTS',
  'Income': 'INC_OTHER', // General income
  // Goal categories
  'Electronics': 'GOAL_ELECTRONICS',
  'Travel': 'GOAL_TRAVEL',
  'Car': 'GOAL_CAR',
  'Home': 'GOAL_HOME',
  'Personal': 'GOAL_PERSONAL',
};

// Reverse mapping: ID to category name
const ID_TO_CATEGORY_MAP = {
  'EXP_FOOD': 'Food',
  'EXP_TRANSPORT': 'Transport',
  'EXP_BILLS': 'Bills',
  'EXP_SHOPPING': 'Shopping',
  'EXP_ENTERTAINMENT': 'Entertainment',
  'EXP_HEALTH': 'Health',
  'EXP_EDUCATION': 'Education',
  'EXP_GIFTS': 'Gifts',
  'EXP_OTHER': 'Other',
  'INC_SALARY': 'Salary',
  'INC_FREELANCE': 'Freelance',
  'INC_INVESTMENTS': 'Investments',
  'INC_GIFTS': 'Gifts',
  'INC_OTHER': 'Income',
  // Goal categories
  'GOAL_ELECTRONICS': 'Electronics',
  'GOAL_TRAVEL': 'Travel',
  'GOAL_CAR': 'Car',
  'GOAL_HOME': 'Home',
  'GOAL_PERSONAL': 'Personal',
};

class TransactionsService {
  list(userId, filters) {
    return transactionsRepository.listByUser(userId, filters);
  }

  listAll(filters = {}) {
    return transactionsRepository.listAll(filters);
  }

  async getOne(userId, id) {
    const tx = await transactionsRepository.findOwned(id, userId);
    if (!tx) throw new NotFoundError('Transaction not found');
    return tx;
  }

  create(userId, data) {
    return transactionsRepository.create({
      userId,
      amount: data.amount,
      currency: (data.currency || env.defaultCurrency).toUpperCase(),
      category: data.category,
      item: data.item || null,
      quantity: data.quantity || null,
      type: data.type,
      source: 'manual',
      notes: data.notes || null,
      transactionDate: data.transactionDate ? new Date(data.transactionDate) : new Date(),
    });
  }

  async update(userId, id, data) {
    const tx = await transactionsRepository.findOwned(id, userId);
    if (!tx) throw new NotFoundError('Transaction not found');
    return transactionsRepository.update(id, data);
  }

  async delete(userId, id) {
    const tx = await transactionsRepository.findOwned(id, userId);
    if (!tx) throw new NotFoundError('Transaction not found');
    await transactionsRepository.delete(id);
    return { deleted: true, id };
  }

  async summary(userId) {
    const rows = await transactionsRepository.summary(userId);
    const result = { expense: {}, income: {}, totals: { expense: 0, income: 0 } };
    for (const row of rows) {
      const sum = Number(row._sum.amount || 0);
      result[row.type][row.category] = (result[row.type][row.category] || 0) + sum;
      result.totals[row.type] = (result.totals[row.type] || 0) + sum;
    }
    return result;
  }

  async parse(description) {
    return aiService.classifyTransaction(description);
  }

  async addManual(userId, data) {
    const category = ID_TO_CATEGORY_MAP[data.categoryId] || 'Other';

    return transactionsRepository.create({
      userId,
      amount: Math.abs(data.amount), // Ensure positive, type determines sign
      currency: 'EGP', // Default currency is Egyptian Pound
      category,
      item: data.title,
      quantity: null,
      type: data.type,
      source: 'manual',
      notes: null,
      transactionDate: data.date ? new Date(data.date) : new Date(),
    });
  }

  async parseAi(userId, text) {
    const parsed = await aiService.parseTransaction({
      text,
      defaultCurrency: 'USD', // Could get from user
      memoryHints: [],
    });

    // Return suggested transaction data for frontend confirmation
    return {
      title: parsed.item || 'Parsed Transaction',
      amount: parsed.type === 'expense' ? -Math.abs(parsed.amount || 0) : Math.abs(parsed.amount || 0),
      type: parsed.type || 'expense',
      categoryId: CATEGORY_ID_MAP[parsed.category] || 'EXP_OTHER',
      date: new Date().toISOString(),
      icon: '📦', // Default icon, could map from category
      confidence: parsed.confidence || 0.5,
    };
  }

  getCategories() {
    return {
      expense: [
        { id: 'EXP_FOOD', name: 'Food & Drinks', icon: '🍔' },
        { id: 'EXP_TRANSPORT', name: 'Transportation', icon: '🚗' },
        { id: 'EXP_BILLS', name: 'Bills & Subscriptions', icon: '💡' },
        { id: 'EXP_SHOPPING', name: 'Shopping', icon: '🛍️' },
        { id: 'EXP_ENTERTAINMENT', name: 'Entertainment', icon: '🎬' },
        { id: 'EXP_HEALTH', name: 'Healthcare', icon: '🏥' },
        { id: 'EXP_EDUCATION', name: 'Education', icon: '📚' },
        { id: 'EXP_GIFTS', name: 'Gifts & Donations', icon: '🎁' },
        { id: 'EXP_OTHER', name: 'Other', icon: '📦' },
      ],
      income: [
        { id: 'INC_SALARY', name: 'Salary', icon: '💼' },
        { id: 'INC_FREELANCE', name: 'Freelance', icon: '💻' },
        { id: 'INC_INVESTMENTS', name: 'Investments', icon: '📈' },
        { id: 'INC_GIFTS', name: 'Gifts', icon: '🎁' },
        { id: 'INC_OTHER', name: 'Other Income', icon: '💰' },
      ],
      goals: [
        { id: 'GOAL_ELECTRONICS', name: 'Electronics', icon: '💻' },
        { id: 'GOAL_TRAVEL', name: 'Travel', icon: '✈️' },
        { id: 'GOAL_CAR', name: 'Car', icon: '🚗' },
        { id: 'GOAL_HOME', name: 'Home', icon: '🏠' },
        { id: 'GOAL_PERSONAL', name: 'Personal', icon: '💍' },
      ],
    };
  }

  async calculateSavingsRate(userId, months = 3) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

    // Get income and expenses for the last X months
    const [incomeData, expenseData] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'income',
          transactionDate: { gte: startDate },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'expense',
          transactionDate: { gte: startDate },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalIncome = Number(incomeData._sum.amount || 0);
    const totalExpense = Number(expenseData._sum.amount || 0);
    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    // Monthly averages
    const monthlyIncome = totalIncome / months;
    const monthlyExpense = totalExpense / months;
    const monthlySavings = netSavings / months;

    return {
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate: Math.round(savingsRate * 100) / 100, // Round to 2 decimal places
      monthlyIncome: Math.round(monthlyIncome),
      monthlyExpense: Math.round(monthlyExpense),
      monthlySavings: Math.round(monthlySavings),
      periodMonths: months,
      hasEnoughData: incomeData._count > 0 || expenseData._count > 0,
    };
  }
}

const transactionsService = new TransactionsService();
module.exports = { transactionsService };
