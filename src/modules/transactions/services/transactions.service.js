'use strict';
const { NotFoundError, BadRequestError } = require('../../../common/errors/http-error');
const { transactionsRepository } = require('../repositories/transactions.repository');
const { aiService } = require('../../ai/services/ai.service');
const { prisma } = require('../../../prisma/client');
const { env } = require('../../../config/env');
const { getCategoryName, getCategories } = require('../constants/categories');

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
      amount: Math.abs(data.amount), // Ensure positive, type determines sign
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

  async addManual(userId, data) {
    const category = getCategoryName(data.categoryId);
    if (!category) throw new BadRequestError('Invalid categoryId');

    return transactionsRepository.create({
      userId,
      amount: Math.abs(data.amount), // Ensure positive, type determines sign
      currency: (data.currency || env.defaultCurrency).toUpperCase(),
      category,
      item: data.title,
      quantity: null,
      type: data.type,
      source: 'manual',
      notes: null,
      transactionDate: data.date ? new Date(data.date) : new Date(),
    });
  }

  async parseAi(text) {
    return aiService.parseTransactionRaw({ text });
  }

  getCategories() {
    return getCategories();
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
