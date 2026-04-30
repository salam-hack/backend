'use strict';
const { prisma } = require('../../../prisma/client');
const { getCategoryId, inferGoalCategoryId } = require('../../transactions/constants/categories');

class HomeService {
  async getDashboard(userId) {
    const [user, balance, transactions, goals] = await Promise.all([
      this._getUser(userId),
      this._getBalance(userId),
      this._getTransactions(userId),
      this._getGoals(userId),
    ]);
    const smartAnalysis = await this._getSmartAnalysis(userId, balance);

    return {
      user,
      balance,
      goals,
      smartAnalysis,
      transactions,
    };
  }

  async _getUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      name: user.name,
      profileImage: null, // No profile image in schema
      hasNotification: false, // Mock - no notifications table
    };
  }

  async _getBalance(userId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total income and expense
    const [totalIncome, totalExpense] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'income' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: 'expense' },
        _sum: { amount: true },
      }),
    ]);

    const currentBalance = Number(totalIncome._sum.amount || 0) - Number(totalExpense._sum.amount || 0);

    // This month's income and expense
    const [incomeThisMonth, expensesThisMonth] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'income',
          transactionDate: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'expense',
          transactionDate: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      currentBalance,
      incomeThisMonth: Number(incomeThisMonth._sum.amount || 0),
      expensesThisMonth: Number(expensesThisMonth._sum.amount || 0),
    };
  }

  async _getGoals(userId) {
    const savingsData = await this._getSavingsData(userId);

    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        title: true,
        description: true,
        targetAmount: true,
        currentAmount: true,
        status: true,
        userExpectedDate: true,
        systemCalculatedDate: true,
      },
    });

    // Calculate estimated dates and messages based on savings rate
    return goals.map(goal => {
      const savedAmount = Number(goal.currentAmount || 0);
      const targetAmount = Number(goal.targetAmount || 0);
      const remaining = targetAmount - savedAmount;
      const monthlySavings = savingsData.monthlySavings;

      let estimatedDate = goal.systemCalculatedDate || goal.userExpectedDate || null;
      let message = 'Start saving to reach your goal!';

      if (monthlySavings > 0 && remaining > 0) {
        const monthsNeeded = Math.ceil(remaining / monthlySavings);
        const estimatedDateObj = new Date();
        estimatedDateObj.setMonth(estimatedDateObj.getMonth() + monthsNeeded);
        estimatedDate = estimatedDateObj;

        if (monthsNeeded <= 3) {
          message = `Almost there! You can reach this goal in ${monthsNeeded} month${monthsNeeded > 1 ? 's' : ''}.`;
        } else if (monthsNeeded <= 6) {
          message = `Good progress! You'll reach this in about ${monthsNeeded} months.`;
        } else if (monthsNeeded <= 12) {
          message = `Keep saving! This goal will take about ${monthsNeeded} months.`;
        } else {
          message = `This is a long-term goal. At your current savings rate, it will take ${monthsNeeded} months.`;
        }
      } else if (monthlySavings <= 0) {
        message = 'Your expenses exceed income. Focus on increasing savings first.';
        estimatedDate = null;
      }

      return {
        title: goal.title,
        isActive: goal.status === 'active',
        progress: targetAmount > 0 ? Math.min(savedAmount / targetAmount, 1) : 0,
        savedAmount,
        targetAmount,
        categoryId: inferGoalCategoryId(goal),
        estimatedDate: estimatedDate ? estimatedDate.toISOString().split('T')[0] : null,
        message,
      };
    });
  }

  async _getSavingsData(userId) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    // Get income and expenses for the last 3 months
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

    return {
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate: Math.round(savingsRate * 100) / 100,
      monthlyIncome: Math.round(totalIncome / 3),
      monthlyExpense: Math.round(totalExpense / 3),
      monthlySavings: Math.round(netSavings / 3),
      periodMonths: 3,
      hasEnoughData: incomeData._count > 0 || expenseData._count > 0,
    };
  }

  async _getSmartAnalysis(userId, balance) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const categoryRows = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId,
        type: 'expense',
        transactionDate: { gte: startOfMonth },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 1,
    });

    const analysis = [];
    const topCategory = categoryRows[0];
    if (topCategory) {
      analysis.push({
        title: `High spending on ${topCategory.category}`,
        description: `${topCategory.category} is your highest spending category this month.`,
        type: 'warning',
      });
    }

    if (balance.incomeThisMonth > 0) {
      const savings = balance.incomeThisMonth - balance.expensesThisMonth;
      const savingsRate = (savings / balance.incomeThisMonth) * 100;

      analysis.push({
        title: savingsRate >= 20 ? 'Healthy savings rate' : 'Savings opportunity',
        description: savingsRate >= 20
          ? 'You are saving at least 20% of your income this month.'
          : 'You have room to save more. Aim to save 20% of your income.',
        type: savingsRate >= 20 ? 'positive' : 'suggestion',
      });
    }

    return analysis;
  }

  async _getTransactions(userId) {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { transactionDate: 'desc' },
      take: 10,
      select: {
        id: true,
        item: true,
        notes: true,
        amount: true,
        type: true,
        category: true,
        transactionDate: true,
      },
    });

    return transactions.map(tx => ({
      id: tx.id,
      title: tx.item || tx.notes || 'Transaction',
      amount: Number(tx.amount),
      type: tx.type,
      categoryId: getCategoryId(tx.category) || 'EXP_OTHER',
      date: tx.transactionDate.toISOString().split('T')[0], // YYYY-MM-DD
    }));
  }
}

const homeService = new HomeService();
module.exports = { homeService };
