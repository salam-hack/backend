'use strict';

const { prisma } = require('../../../prisma/client');

class InsightsService {
  async getInsights(userId) {
    const alerts = [];
    const now = new Date();
    
    // Timeframes using native JS Date
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Fetch Monthly Data
    const monthlyTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        transactionDate: { gte: currentMonthStart },
      },
    });

    let monthlyIncome = 0;
    let monthlyExpense = 0;

    for (const tx of monthlyTransactions) {
      if (tx.type === 'income') monthlyIncome += Number(tx.amount);
      if (tx.type === 'expense') monthlyExpense += Number(tx.amount);
    }

    // 2. Fetch Weekly Data
    const weeklyTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        transactionDate: { gte: weekStart },
        type: 'expense'
      },
    });

    let weeklyExpense = 0;
    let weeklySecondaryExpense = 0;
    const secondaryCategories = ['Food', 'Shopping', 'Entertainment', 'Food & Drinks'];

    for (const tx of weeklyTransactions) {
      const amount = Number(tx.amount);
      weeklyExpense += amount;
      if (secondaryCategories.includes(tx.category)) {
        weeklySecondaryExpense += amount;
      }
    }

    // 3. Fetch Daily Data
    const dailyTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        transactionDate: { gte: todayStart, lte: todayEnd },
        type: 'expense'
      },
    });

    let dailyExpense = 0;
    for (const tx of dailyTransactions) {
      dailyExpense += Number(tx.amount);
    }

    // Mathematical calculations
    const currentDayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    // Prevent division by zero if it's the first moment of the 1st day, though currentDayOfMonth is at least 1
    const dailyAverage = currentDayOfMonth > 0 ? (monthlyExpense / currentDayOfMonth) : 0;
    const projectedMonthlyExpense = dailyAverage * daysInMonth;

    const expenseToIncomeRatio = monthlyIncome > 0 ? (monthlyExpense / monthlyIncome) : 0;
    const weeklyToMonthlyIncomeRatio = monthlyIncome > 0 ? (weeklyExpense / monthlyIncome) : 0;
    const secondaryToWeeklyRatio = weeklyExpense > 0 ? (weeklySecondaryExpense / weeklyExpense) : 0;

    // --- GENERATE ALERTS ---

    // Monthly Alerts
    if (monthlyIncome > 0) {
      if (expenseToIncomeRatio < 0.5) {
        alerts.push({
          type: 'positive',
          timeframe: 'month',
          title: 'ذكاء مالي ممتاز 🌟',
          message: 'أنت تدير أموالك بذكاء! صرفك هذا الشهر أقل من 50% من دخلك، مما يترك مساحة ممتازة للادخار.',
        });
      } else if (expenseToIncomeRatio > 0.8) {
        alerts.push({
          type: 'negative',
          timeframe: 'month',
          title: 'تحذير: إنفاق مرتفع ⚠️',
          message: 'لقد تجاوزت مصروفاتك 80% من دخلك لهذا الشهر. حاول تقليل النفقات غير الضرورية.',
        });
      }
      
      if (projectedMonthlyExpense > monthlyIncome && expenseToIncomeRatio <= 0.8) {
        alerts.push({
          type: 'negative',
          timeframe: 'month',
          title: 'خطر نفاذ الرصيد 📉',
          message: 'بناءً على معدل صرفك اليومي، من المتوقع أن تتجاوز مصروفاتك دخلك بنهاية الشهر.',
        });
      }
    }

    // Weekly Alerts
    if (weeklyExpense > 0) {
      if (secondaryToWeeklyRatio > 0.3) {
        alerts.push({
          type: 'negative',
          timeframe: 'week',
          title: 'إنفاق عالي على الكماليات 🛍️',
          message: 'أكثر من 30% من صرفك في آخر 7 أيام كان على الكماليات والمطاعم. حاول التركيز على الأساسيات لتحقيق أهدافك.',
        });
      }
      
      if (monthlyIncome > 0 && weeklyToMonthlyIncomeRatio < 0.2) {
        alerts.push({
          type: 'positive',
          timeframe: 'week',
          title: 'تحكم رائع بالميزانية الأسبوعية 🎯',
          message: 'مصروفاتك خلال الأسبوع الماضي كانت ممتازة ولم تتجاوز 20% من دخلك الشهري. استمر هكذا!',
        });
      }
    }

    // Daily Alerts
    if (dailyExpense === 0) {
      alerts.push({
        type: 'positive',
        timeframe: 'day',
        title: 'يوم بدون مصاريف 🏆',
        message: 'عمل رائع! لم تقم بأي مصروفات اليوم، هذا سيساعدك جداً في تحقيق أهدافك التوفيرية.',
      });
    } else if (dailyAverage > 0 && dailyExpense > (dailyAverage * 2)) {
      alerts.push({
        type: 'negative',
        timeframe: 'day',
        title: 'ارتفاع مفاجئ في الصرف اليوم 📈',
        message: 'لقد صرفت اليوم ضعف معدلك اليومي المعتاد. تأكد من أن هذه المصروفات ضرورية.',
      });
    }

    return { alerts };
  }
}

const insightsService = new InsightsService();
module.exports = { insightsService };
