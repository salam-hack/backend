const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB Seed...');

  // 1. Clean existing data
  await prisma.transaction.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.user.deleteMany();

  // 2. Setup dates
  const now = new Date();
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const currentMonth25th = new Date(now.getFullYear(), now.getMonth(), 25);
  if (currentMonth25th > now) {
    currentMonth25th.setMonth(currentMonth25th.getMonth() - 1);
  }

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15);

  // 3. Create Main User (Amir Yousry)
  const amirId = '550e8400-e29b-41d4-a716-446655440001';
  await prisma.user.create({
    data: {
      id: amirId,
      name: 'أمير يسري',
      email: 'amir@example.com',
      passwordHash: 'hashed_password_123',
      defaultCurrency: 'EGP',
    }
  });

  // 4. Create Main Goal
  await prisma.goal.create({
    data: {
      userId: amirId,
      title: 'شراء MacBook Pro',
      targetAmount: 80000,
      currentAmount: 20000,
      status: 'active'
    }
  });

  // 5. Create Transactions for Amir to match calculations
  // Target: Income = 20000, Expense = 4600 this month.
  // Average Savings over 3 months = 6000 (so 60k remaining / 6k = 10 months).
  // Total savings needed = 18000. This month savings = 15400. Need 2600 from previous 2 months.
  
  const amirTransactions = [
    // --- Current Month ---
    {
      userId: amirId,
      amount: 20000,
      currency: 'EGP',
      category: 'Salary',
      item: 'الراتب الشهري',
      type: 'income',
      transactionDate: currentMonth25th,
      source: 'manual'
    },
    {
      userId: amirId,
      amount: 150,
      currency: 'EGP',
      category: 'Entertainment',
      item: 'نتفليكس',
      type: 'expense',
      transactionDate: today,
      source: 'manual'
    },
    {
      userId: amirId,
      amount: 450,
      currency: 'EGP',
      category: 'Groceries',
      item: 'كارفور',
      type: 'expense',
      transactionDate: yesterday,
      source: 'manual'
    },
    {
      userId: amirId,
      amount: 4000,
      currency: 'EGP',
      category: 'Housing',
      item: 'إيجار السكن',
      type: 'expense',
      transactionDate: new Date(now.getFullYear(), now.getMonth(), 5),
      source: 'manual'
    },
    // --- Last Month (Income: 10000, Expense: 8700 -> Savings: 1300) ---
    {
      userId: amirId,
      amount: 10000,
      currency: 'EGP',
      category: 'Salary',
      item: 'الراتب الشهري',
      type: 'income',
      transactionDate: lastMonth,
      source: 'manual'
    },
    {
      userId: amirId,
      amount: 8700,
      currency: 'EGP',
      category: 'Housing',
      item: 'مصروفات ومشتريات',
      type: 'expense',
      transactionDate: lastMonth,
      source: 'manual'
    },
    // --- Two Months Ago (Income: 10000, Expense: 8700 -> Savings: 1300) ---
    {
      userId: amirId,
      amount: 10000,
      currency: 'EGP',
      category: 'Salary',
      item: 'الراتب الشهري',
      type: 'income',
      transactionDate: twoMonthsAgo,
      source: 'manual'
    },
    {
      userId: amirId,
      amount: 8700,
      currency: 'EGP',
      category: 'Housing',
      item: 'مصروفات ومشتريات',
      type: 'expense',
      transactionDate: twoMonthsAgo,
      source: 'manual'
    }
  ];

  await prisma.transaction.createMany({ data: amirTransactions });
  console.log('Seeded Amir Yousry perfectly!');

  // 6. Generate 9 random users
  const firstNames = ['أحمد', 'محمد', 'سارة', 'فاطمة', 'عمر', 'خالد', 'نورة', 'مريم', 'يوسف'];
  const lastNames = ['علي', 'حسن', 'عبدالله', 'إبراهيم', 'سعيد', 'محمود', 'طارق', 'عادل', 'سامي'];

  for (let i = 0; i < 9; i++) {
    const userId = uuidv4();
    const name = `${firstNames[i]} ${lastNames[i]}`;
    
    await prisma.user.create({
      data: {
        id: userId,
        name: name,
        email: `user${i}@example.com`,
        passwordHash: 'hashed_password_123',
        defaultCurrency: 'EGP',
      }
    });

    // Random Goal
    await prisma.goal.create({
      data: {
        userId: userId,
        title: i % 2 === 0 ? 'سيارة جديدة' : 'عطلة صيفية',
        targetAmount: 50000 + (Math.random() * 50000),
        currentAmount: 10000 + (Math.random() * 20000),
        status: 'active'
      }
    });

    // Random Transactions (Current Month)
    const randomIncome = 10000 + (Math.random() * 15000);
    const randomExpense1 = 2000 + (Math.random() * 3000);
    const randomExpense2 = 500 + (Math.random() * 1000);

    await prisma.transaction.createMany({
      data: [
        {
          userId: userId,
          amount: randomIncome,
          currency: 'EGP',
          category: 'Salary',
          item: 'راتب',
          type: 'income',
          transactionDate: new Date(now.getFullYear(), now.getMonth(), 1),
          source: 'manual'
        },
        {
          userId: userId,
          amount: randomExpense1,
          currency: 'EGP',
          category: 'Housing',
          item: 'إيجار',
          type: 'expense',
          transactionDate: new Date(now.getFullYear(), now.getMonth(), 5),
          source: 'manual'
        },
        {
          userId: userId,
          amount: randomExpense2,
          currency: 'EGP',
          category: 'Food',
          item: 'مطعم',
          type: 'expense',
          transactionDate: new Date(now.getFullYear(), now.getMonth(), 10),
          source: 'manual'
        }
      ]
    });
  }

  console.log('Seeded 9 random users!');
  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
