'use strict';
const { prisma } = require('../../../prisma/client');

// Category to icon mapping
const CATEGORY_ICONS = {
  'Food': '🍔',
  'Transport': '🚗',
  'Bills': '💡',
  'Shopping': '🛍️',
  'Entertainment': '🎬',
  'Health': '🏥',
  'Income': '💰',
  'Salary': '💼',
  'Other': '📦',
  // Add more mappings as needed
};

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
  'Income': 'INC_OTHER',
  'Salary': 'INC_SALARY',
  'Freelance': 'INC_FREELANCE',
  'Investments': 'INC_INVESTMENTS',
  'Other': 'EXP_OTHER',
  // Goal categories
  'Electronics': 'GOAL_ELECTRONICS',
  'Travel': 'GOAL_TRAVEL',
  'Car': 'GOAL_CAR',
  'Home': 'GOAL_HOME',
  'Personal': 'GOAL_PERSONAL',
};

class HomeService {
  async getDashboard(userId) {
    const [user, balance, transactions, goals] = await Promise.all([
      this._getUser(userId),
      this._getBalance(userId),
      this._getTransactions(userId),
      this._getGoals(userId),
    ]);

    const smartAnalysis = this._getSmartAnalysis();

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

    // Mock goals - no goals table in schema
    const goals = [
      {
        title: 'Emergency Fund',
        isActive: true,
        progress: 0.6,
        savedAmount: 6000,
        targetAmount: 10000,
        categoryId: 'GOAL_PERSONAL',
      },
      {
        title: 'Vacation to Europe',
        isActive: true,
        progress: 0.3,
        savedAmount: 1500,
        targetAmount: 5000,
        categoryId: 'GOAL_TRAVEL',
      },
      {
        title: 'New Laptop',
        isActive: true,
        progress: 0.0,
        savedAmount: 0,
        targetAmount: 800,
        categoryId: 'GOAL_ELECTRONICS',
      },
    ];

    // Calculate estimated dates and messages based on savings rate
    return goals.map(goal => {
      const remaining = goal.targetAmount - goal.savedAmount;
      const monthlySavings = savingsData.monthlySavings;

      let estimatedDate = null;
      let message = 'Start saving to reach your goal!';

      if (monthlySavings > 0 && remaining > 0) {
        const monthsNeeded = Math.ceil(remaining / monthlySavings);
        const estimatedDateObj = new Date();
        estimatedDateObj.setMonth(estimatedDateObj.getMonth() + monthsNeeded);
        estimatedDate = estimatedDateObj.toISOString().split('T')[0];

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
        ...goal,
        estimatedDate,
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

  _getSmartAnalysis() {
    // Mock smart analysis - simple rules or AI would generate this
    return [
      {
        title: 'High spending on food',
        description: 'Your food expenses are 25% higher than last month. Consider meal planning to save money.',
        type: 'warning',
      },
      {
        title: 'Consistent income',
        description: 'Great job maintaining steady income streams this month.',
        type: 'positive',
      },
      {
        title: 'Savings opportunity',
        description: 'You have room to save more. Aim to save 20% of your income.',
        type: 'suggestion',
      },
    ];
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
      category: tx.category,
      categoryId: CATEGORY_ID_MAP[tx.category] || 'EXP_OTHER',
      date: tx.transactionDate.toISOString().split('T')[0], // YYYY-MM-DD
      icon: CATEGORY_ICONS[tx.category] || '📦',
    }));
  }
}

const homeService = new HomeService();
module.exports = { homeService };