const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB Seed...');

  // Check if main user already exists — skip seed if so
  const existingUser = await prisma.user.findUnique({
    where: { id: '550e8400-e29b-41d4-a716-446655440001' }
  });

  if (existingUser) {
    console.log('Database already seeded. Skipping to protect existing data.');
    return;
  }

  console.log('No existing data found. Seeding fresh database...');

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
      title: 'شراء حاسوب محمول (MacBook Pro)',
      targetAmount: 85000,
      currentAmount: 25000,
      status: 'active'
    }
  });

  // 5. Create Transactions for Amir to match calculations
  const amirTransactions = [
    // --- الشهر الحالي ---
    {
      userId: amirId,
      amount: 25000,
      currency: 'EGP',
      category: 'Salary',
      item: 'الراتب الشهري',
      type: 'income',
      transactionDate: currentMonth25th,
      source: 'manual'
    },
    {
      userId: amirId,
      amount: 200,
      currency: 'EGP',
      category: 'Entertainment',
      item: 'اشتراك نتفليكس',
      type: 'expense',
      transactionDate: today,
      source: 'manual'
    },
    {
      userId: amirId,
      amount: 1200,
      currency: 'EGP',
      category: 'Groceries',
      item: 'مشتريات من كارفور',
      type: 'expense',
      transactionDate: yesterday,
      source: 'manual'
    },
    {
      userId: amirId,
      amount: 5500,
      currency: 'EGP',
      category: 'Housing',
      item: 'إيجار الشقة',
      type: 'expense',
      transactionDate: new Date(now.getFullYear(), now.getMonth(), 5),
      source: 'manual'
    },
    {
      userId: amirId,
      amount: 450,
      currency: 'EGP',
      category: 'Utilities',
      item: 'فاتورة الكهرباء والغاز',
      type: 'expense',
      transactionDate: new Date(now.getFullYear(), now.getMonth(), 10),
      source: 'manual'
    },
    // --- الشهر الماضي ---
    {
      userId: amirId,
      amount: 25000,
      currency: 'EGP',
      category: 'Salary',
      item: 'الراتب الشهري',
      type: 'income',
      transactionDate: lastMonth,
      source: 'manual'
    },
    {
      userId: amirId,
      amount: 15000,
      currency: 'EGP',
      category: 'Personal',
      item: 'مصاريف متنوعة وتسوق',
      type: 'expense',
      transactionDate: lastMonth,
      source: 'manual'
    },
    // --- قبل شهرين ---
    {
      userId: amirId,
      amount: 25000,
      currency: 'EGP',
      category: 'Salary',
      item: 'الراتب الشهري',
      type: 'income',
      transactionDate: twoMonthsAgo,
      source: 'manual'
    },
    {
      userId: amirId,
      amount: 16000,
      currency: 'EGP',
      category: 'Housing',
      item: 'تكاليف المعيشة والإيجار',
      type: 'expense',
      transactionDate: twoMonthsAgo,
      source: 'manual'
    }
  ];

  await prisma.transaction.createMany({ data: amirTransactions });
  console.log('Seeded Amir Yousry perfectly!');

  // 6. Create Judge User (Fresh account for testing)
  const judgeId = '00000000-0000-0000-0000-000000000000';
  await prisma.user.create({
    data: {
      id: judgeId,
      name: 'المستخدم التجريبي (لجنة التحكيم)',
      email: 'judge@salamhack.com',
      passwordHash: 'judge_access_only',
      defaultCurrency: 'EGP',
    }
  });
  console.log('Seeded Judge User (Empty Account)!');

  // 7. Generate 9 random users
  const firstNames = ['أحمد', 'محمد', 'سارة', 'ياسين', 'عمر', 'خالد', 'مريم', 'ليلى', 'يوسف'];
  const lastNames = ['محمود', 'حسن', 'عبد العزيز', 'إبراهيم', 'مصطفى', 'رمضان', 'سليمان', 'عادل', 'بكر'];

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
        title: i % 2 === 0 ? 'توفير لشراء سيارة' : 'رحلة سياحية صيفية',
        targetAmount: 150000 + (Math.random() * 100000),
        currentAmount: 20000 + (Math.random() * 30000),
        status: 'active'
      }
    });

    // Random Transactions (Current Month)
    const randomIncome = 12000 + (Math.random() * 18000);
    const randomExpense1 = 3000 + (Math.random() * 4000);
    const randomExpense2 = 800 + (Math.random() * 1500);

    await prisma.transaction.createMany({
      data: [
        {
          userId: userId,
          amount: randomIncome,
          currency: 'EGP',
          category: 'Salary',
          item: 'راتب الوظيفة',
          type: 'income',
          transactionDate: new Date(now.getFullYear(), now.getMonth(), 1),
          source: 'manual'
        },
        {
          userId: userId,
          amount: randomExpense1,
          currency: 'EGP',
          category: 'Housing',
          item: 'إيجار سكن',
          type: 'expense',
          transactionDate: new Date(now.getFullYear(), now.getMonth(), 5),
          source: 'manual'
        },
        {
          userId: userId,
          amount: randomExpense2,
          currency: 'EGP',
          category: 'Food',
          item: 'مشتريات بقالة',
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
