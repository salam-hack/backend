'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  try {
    const [users, goals, conversations, messages, transactions] = await Promise.all([
      prisma.user.count(),
      prisma.goal.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.transaction.count()
    ]);

    console.log('📊 Current Database Status:');
    console.log(`   👥 Users: ${users}`);
    console.log(`   🎯 Goals: ${goals}`);
    console.log(`   💬 Conversations: ${conversations}`);
    console.log(`   💬 Messages: ${messages}`);
    console.log(`   💰 Transactions: ${transactions}`);

    if (users === 0) {
      console.log('\n❌ No data found. Running seed script...');
      // Import and run seed
      const { seedDatabase } = require('./seed-test-data');
      await seedDatabase();
    } else {
      console.log('\n✅ Database already has data!');
    }

  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();