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
      let message = 'ابدأ بالادخار لتحقيق هدفك!';

      if (monthlySavings > 0 && remaining > 0) {
        const monthsNeeded = Math.ceil(remaining / monthlySavings);
        const estimatedDateObj = new Date();
        estimatedDateObj.setMonth(estimatedDateObj.getMonth() + monthsNeeded);
        estimatedDate = estimatedDateObj;

        if (monthsNeeded <= 3) {
          message = `اقتربت جداً! يمكنك تحقيق هذا الهدف خلال ${monthsNeeded} شهر.`;
        } else if (monthsNeeded <= 6) {
          message = `تقدم جيد! ستصل إلى هدفك خلال ${monthsNeeded} أشهر تقريباً.`;
        } else if (monthsNeeded <= 12) {
          message = `استمر في الادخار! سيستغرق هذا الهدف حوالي ${monthsNeeded} أشهر.`;
        } else {
          message = `هذا هدف طويل الأمد. بمعدل ادخارك الحالي، سيستغرق ${monthsNeeded} شهر.`;
        }
      } else if (monthlySavings <= 0) {
        message = 'مصروفاتك تتجاوز دخلك. ركز على زيادة التوفير أولاً.';
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
        title: `إنفاق مرتفع على ${topCategory.category}`,
        description: `تعتبر فئة ${topCategory.category} هي أعلى فئة إنفاق لديك هذا الشهر.`,
        type: 'warning',
      });
    }

    if (balance.incomeThisMonth > 0) {
      const savings = balance.incomeThisMonth - balance.expensesThisMonth;
      const savingsRate = (savings / balance.incomeThisMonth) * 100;

      analysis.push({
        title: savingsRate >= 20 ? 'معدل ادخار صحي' : 'فرصة للادخار',
        description: savingsRate >= 20
          ? 'أنت توفر ما لا يقل عن 20% من دخلك هذا الشهر.'
          : 'لديك مساحة للتوفير أكثر. اهدف لتوفير 20% من دخلك.',
        type: savingsRate >= 20 ? 'positive' : 'suggestion',
      });
    }

    return analysis;
  }

  async _getTransactions(userId) {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { transactionDate: 'desc' },
      take: 3,
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
      title: tx.item || tx.notes || 'معاملة',
      amount: Number(tx.amount),
      type: tx.type,
      categoryId: getCategoryId(tx.category) || 'EXP_OTHER',
      date: tx.transactionDate.toISOString().split('T')[0], // YYYY-MM-DD
    }));
  }
}

const homeService = new HomeService();
module.exports = { homeService };
