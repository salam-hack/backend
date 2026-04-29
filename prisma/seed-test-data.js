'use strict';

/**
 * Seed Script - Add Test Data to Database
 * Inserts 5 records into each table for testing endpoints
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // ──────────────────────────────────────────────────────────────────────────────
    // 1. USERS (5 users)
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('📝 Creating users...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    const users = await Promise.all([
      prisma.user.create({
        data: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          email: 'ahmed@example.com',
          passwordHash: hashedPassword,
          name: 'أحمد محمد',
          defaultCurrency: 'SAR',
          locale: 'ar',
          timezone: 'Asia/Riyadh',
          status: 'active'
        }
      }),
      prisma.user.create({
        data: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          email: 'fatima@example.com',
          passwordHash: hashedPassword,
          name: 'فاطمة علي',
          defaultCurrency: 'AED',
          locale: 'ar',
          timezone: 'Asia/Dubai',
          status: 'active'
        }
      }),
      prisma.user.create({
        data: {
          id: '550e8400-e29b-41d4-a716-446655440003',
          email: 'omar@example.com',
          passwordHash: hashedPassword,
          name: 'عمر حسن',
          defaultCurrency: 'EGP',
          locale: 'ar',
          timezone: 'Africa/Cairo',
          status: 'active'
        }
      }),
      prisma.user.create({
        data: {
          id: '550e8400-e29b-41d4-a716-446655440004',
          email: 'layla@example.com',
          passwordHash: hashedPassword,
          name: 'ليلى أحمد',
          defaultCurrency: 'USD',
          locale: 'en',
          timezone: 'America/New_York',
          status: 'active'
        }
      }),
      prisma.user.create({
        data: {
          id: '550e8400-e29b-41d4-a716-446655440005',
          email: 'khaled@example.com',
          passwordHash: hashedPassword,
          name: 'خالد إبراهيم',
          defaultCurrency: 'EUR',
          locale: 'ar',
          timezone: 'Europe/Paris',
          status: 'active'
        }
      })
    ]);

    console.log('✅ Created 5 users');

    // ──────────────────────────────────────────────────────────────────────────────
    // 2. GOALS (5 goals - distributed among users)
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('🎯 Creating goals...');

    const goals = await Promise.all([
      prisma.goal.create({
        data: {
          userId: users[0].id,
          title: 'شراء آيفون جديد',
          description: 'توفير لشراء آيفون 15 برو',
          targetAmount: 4500.00,
          currentAmount: 1200.00,
          status: 'active',
          userExpectedDate: new Date('2026-08-01'),
          systemCalculatedDate: new Date('2026-07-15')
        }
      }),
      prisma.goal.create({
        data: {
          userId: users[0].id,
          title: 'عطلة عائلية',
          description: 'رحلة إلى تركيا',
          targetAmount: 8000.00,
          currentAmount: 2500.00,
          status: 'active',
          userExpectedDate: new Date('2026-12-01'),
          systemCalculatedDate: new Date('2026-11-20')
        }
      }),
      prisma.goal.create({
        data: {
          userId: users[1].id,
          title: 'تعليم الأطفال',
          description: 'رسوم مدرسية للسنة الدراسية',
          targetAmount: 15000.00,
          currentAmount: 5000.00,
          status: 'active',
          userExpectedDate: new Date('2026-09-01'),
          systemCalculatedDate: new Date('2026-08-25')
        }
      }),
      prisma.goal.create({
        data: {
          userId: users[2].id,
          title: 'سيارة جديدة',
          description: 'توفير لشراء تويوتا كورولا',
          targetAmount: 25000.00,
          currentAmount: 8500.00,
          status: 'active',
          userExpectedDate: new Date('2027-03-01'),
          systemCalculatedDate: new Date('2027-01-15')
        }
      }),
      prisma.goal.create({
        data: {
          userId: users[3].id,
          title: 'منزل أحلام',
          description: 'دفعة أولى لشراء منزل',
          targetAmount: 150000.00,
          currentAmount: 25000.00,
          status: 'active',
          userExpectedDate: new Date('2027-12-01'),
          systemCalculatedDate: new Date('2027-08-20')
        }
      })
    ]);

    console.log('✅ Created 5 goals');

    // ──────────────────────────────────────────────────────────────────────────────
    // 3. CONVERSATIONS (5 conversations)
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('💬 Creating conversations...');

    const conversations = await Promise.all([
      prisma.conversation.create({
        data: {
          userId: users[0].id,
          title: 'مساعدة في إدارة الميزانية',
          status: 'active',
          summary: 'المستخدم يريد مساعدة في تتبع مصروفاته اليومية وتحقيق أهداف التوفير',
          lastMessageAt: new Date()
        }
      }),
      prisma.conversation.create({
        data: {
          userId: users[0].id,
          title: 'تحليل المصروفات الشهرية',
          status: 'active',
          summary: 'مراجعة تفصيلية للمصروفات الشهرية مع اقتراحات لتوفير المال',
          lastMessageAt: new Date()
        }
      }),
      prisma.conversation.create({
        data: {
          userId: users[1].id,
          title: 'تخطيط للعام الجديد',
          status: 'active',
          summary: 'مناقشة الأهداف المالية للعام القادم وكيفية تحقيقها',
          lastMessageAt: new Date()
        }
      }),
      prisma.conversation.create({
        data: {
          userId: users[2].id,
          title: 'مشكلة في الميزانية',
          status: 'active',
          summary: 'المستخدم يواجه صعوبة في الالتزام بالميزانية المحددة',
          lastMessageAt: new Date()
        }
      }),
      prisma.conversation.create({
        data: {
          userId: users[3].id,
          title: 'استثمارات آمنة',
          status: 'archived',
          summary: 'بحث عن خيارات استثمار آمنة ومنخفضة المخاطر',
          lastMessageAt: new Date('2026-04-20')
        }
      })
    ]);

    console.log('✅ Created 5 conversations');

    // ──────────────────────────────────────────────────────────────────────────────
    // 4. MESSAGES (5 messages per conversation = 25 total)
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('💬 Creating messages...');

    const messages = [];

    for (const conv of conversations) {
      // 5 messages per conversation (alternating user/assistant)
      const convMessages = await Promise.all([
        prisma.message.create({
          data: {
            conversationId: conv.id,
            userId: conv.userId,
            role: 'user',
            content: 'مرحبا، أحتاج مساعدة في إدارة أموالي',
            status: 'completed'
          }
        }),
        prisma.message.create({
          data: {
            conversationId: conv.id,
            userId: conv.userId,
            role: 'assistant',
            content: 'مرحبا! سأساعدك في إدارة أموالك. ما هي أهدافك المالية؟',
            status: 'completed'
          }
        }),
        prisma.message.create({
          data: {
            conversationId: conv.id,
            userId: conv.userId,
            role: 'user',
            content: 'أريد توفير 5000 ريال هذا العام',
            status: 'completed'
          }
        }),
        prisma.message.create({
          data: {
            conversationId: conv.id,
            userId: conv.userId,
            role: 'assistant',
            content: 'هدف رائع! كم مدخراتك الحالية وما هي مصروفاتك الشهرية؟',
            status: 'completed'
          }
        }),
        prisma.message.create({
          data: {
            conversationId: conv.id,
            userId: conv.userId,
            role: 'user',
            content: 'مدخراتي 2000 ومصروفاتي 3000 شهرياً',
            status: 'completed'
          }
        })
      ]);
      messages.push(...convMessages);
    }

    console.log('✅ Created 25 messages');

    // ──────────────────────────────────────────────────────────────────────────────
    // 5. TRANSACTIONS (5 transactions per user = 25 total)
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('💰 Creating transactions...');

    const transactions = [];

    for (const user of users) {
      const userTransactions = await Promise.all([
        prisma.transaction.create({
          data: {
            userId: user.id,
            amount: 150.00,
            currency: user.defaultCurrency,
            category: 'Food',
            item: 'مشتريات سوبر ماركت',
            type: 'expense',
            source: 'manual',
            transactionDate: new Date('2026-04-25'),
            notes: 'مشتريات أسبوعية'
          }
        }),
        prisma.transaction.create({
          data: {
            userId: user.id,
            amount: 5000.00,
            currency: user.defaultCurrency,
            category: 'Salary',
            item: 'راتب شهري',
            type: 'income',
            source: 'manual',
            transactionDate: new Date('2026-04-01'),
            notes: 'راتب الشركة'
          }
        }),
        prisma.transaction.create({
          data: {
            userId: user.id,
            amount: 200.00,
            currency: user.defaultCurrency,
            category: 'Transport',
            item: 'وقود السيارة',
            type: 'expense',
            source: 'manual',
            transactionDate: new Date('2026-04-20'),
            notes: 'تعبئة الوقود'
          }
        }),
        prisma.transaction.create({
          data: {
            userId: user.id,
            amount: 300.00,
            currency: user.defaultCurrency,
            category: 'Bills',
            item: 'فاتورة الكهرباء',
            type: 'expense',
            source: 'manual',
            transactionDate: new Date('2026-04-15'),
            notes: 'فاتورة شهر أبريل'
          }
        }),
        prisma.transaction.create({
          data: {
            userId: user.id,
            amount: 100.00,
            currency: user.defaultCurrency,
            category: 'Entertainment',
            item: 'اشتراك نتفليكس',
            type: 'expense',
            source: 'manual',
            transactionDate: new Date('2026-04-10'),
            notes: 'اشتراك شهري'
          }
        })
      ]);
      transactions.push(...userTransactions);
    }

    console.log('✅ Created 25 transactions');

    // ──────────────────────────────────────────────────────────────────────────────
    // 6. RAW NOTES (5 raw notes)
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('📝 Creating raw notes...');

    const rawNotes = await Promise.all([
      prisma.rawNote.create({
        data: {
          userId: users[0].id,
          conversationId: conversations[0].id,
          content: 'اشتريت شوكولاتة بـ50 ريال وقهوة بـ25 ريال',
          status: 'parsed',
          parsedResult: {
            transactions: [
              { amount: 50, category: 'Food', item: 'شوكولاتة' },
              { amount: 25, category: 'Food', item: 'قهوة' }
            ]
          },
          confidence: 0.95
        }
      }),
      prisma.rawNote.create({
        data: {
          userId: users[1].id,
          conversationId: conversations[2].id,
          content: 'دفعت 500 درهم للجامعة و300 درهم للفواتير',
          status: 'parsed',
          parsedResult: {
            transactions: [
              { amount: 500, category: 'Education', item: 'رسوم جامعة' },
              { amount: 300, category: 'Bills', item: 'فواتير' }
            ]
          },
          confidence: 0.88
        }
      }),
      prisma.rawNote.create({
        data: {
          userId: users[2].id,
          conversationId: conversations[3].id,
          content: 'ركبت تاكسي بـ100 جنيه واشتريت هدايا بـ200 جنيه',
          status: 'parsed',
          parsedResult: {
            transactions: [
              { amount: 100, category: 'Transport', item: 'تاكسي' },
              { amount: 200, category: 'Gifts', item: 'هدايا' }
            ]
          },
          confidence: 0.92
        }
      }),
      prisma.rawNote.create({
        data: {
          userId: users[3].id,
          conversationId: conversations[4].id,
          content: 'استثمرت 1000 دولار في الصندوق المشترك',
          status: 'parsed',
          parsedResult: {
            transactions: [
              { amount: 1000, category: 'Investments', item: 'صندوق مشترك' }
            ]
          },
          confidence: 0.85
        }
      }),
      prisma.rawNote.create({
        data: {
          userId: users[4].id,
          content: 'حصلت على عمولة 500 يورو من المشروع',
          status: 'pending',
          confidence: null
        }
      })
    ]);

    console.log('✅ Created 5 raw notes');

    // ──────────────────────────────────────────────────────────────────────────────
    // 7. GLOBAL MEMORY (5 global memory entries)
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('🧠 Creating global memory...');

    const globalMemories = await Promise.all([
      prisma.globalMemory.create({
        data: {
          userId: users[0].id,
          key: 'preferred_currency',
          value: 'SAR',
          type: 'preference'
        }
      }),
      prisma.globalMemory.create({
        data: {
          userId: users[0].id,
          key: 'response_style',
          value: 'detailed',
          type: 'preference'
        }
      }),
      prisma.globalMemory.create({
        data: {
          userId: users[1].id,
          key: 'monthly_budget_limit',
          value: '5000',
          type: 'fact'
        }
      }),
      prisma.globalMemory.create({
        data: {
          userId: users[2].id,
          key: 'default_currency',
          value: 'EGP',
          type: 'preference'
        }
      }),
      prisma.globalMemory.create({
        data: {
          userId: users[3].id,
          key: 'investment_preference',
          value: 'conservative',
          type: 'preference'
        }
      })
    ]);

    console.log('✅ Created 5 global memory entries');

    // ──────────────────────────────────────────────────────────────────────────────
    // 8. CONVERSATION MEMORY (5 conversation memory entries)
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('💭 Creating conversation memory...');

    const conversationMemories = await Promise.all([
      prisma.conversationMemory.create({
        data: {
          conversationId: conversations[0].id,
          userId: conversations[0].userId,
          key: "last_discussed_topic",
          value: "budget_planning",
          type: "context"
        }
      }),
      prisma.conversationMemory.create({
        data: {
          conversationId: conversations[1].id,
          userId: conversations[1].userId,
          key: "user_personality",
          value: "disciplined_saver",
          type: "insight"
        }
      }),
      prisma.conversationMemory.create({
        data: {
          conversationId: conversations[2].id,
          userId: conversations[2].userId,
          key: "family_situation",
          value: "has_3_children_in_school",
          type: "fact"
        }
      }),
      prisma.conversationMemory.create({
        data: {
          conversationId: conversations[3].id,
          userId: conversations[3].userId,
          key: "financial_stress_level",
          value: "moderate",
          type: "assessment"
        }
      }),
      prisma.conversationMemory.create({
        data: {
          conversationId: conversations[4].id,
          userId: conversations[4].userId,
          key: "investment_knowledge",
          value: "beginner",
          type: "assessment"
        }
      })
    ]);

    console.log('✅ Created 5 conversation memory entries');

    // ──────────────────────────────────────────────────────────────────────────────
    // 9. SUMMARY MEMORY (5 summary memory entries)
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('📊 Creating summary memory...');

    const summaryMemories = await Promise.all([
      prisma.summaryMemory.create({
        data: {
          userId: users[0].id,
          period: '2026-04',
          summaryText: 'شهر أبريل: دخل 5000 ريال، مصروفات 1500 ريال، توفير 3500 ريال',
          metrics: { income: 5000, expenses: 1500, savings: 3500 }
        }
      }),
      prisma.summaryMemory.create({
        data: {
          userId: users[1].id,
          period: '2026-04',
          summaryText: 'شهر أبريل: دخل 8000 درهم، مصروفات 3500 درهم، توفير 4500 درهم',
          metrics: { income: 8000, expenses: 3500, savings: 4500 }
        }
      }),
      prisma.summaryMemory.create({
        data: {
          userId: users[2].id,
          period: '2026-04',
          summaryText: 'شهر أبريل: دخل 3000 جنيه، مصروفات 1800 جنيه، توفير 1200 جنيه',
          metrics: { income: 3000, expenses: 1800, savings: 1200 }
        }
      }),
      prisma.summaryMemory.create({
        data: {
          userId: users[3].id,
          period: '2026-04',
          summaryText: 'شهر أبريل: دخل 7000 دولار، مصروفات 2800 دولار، توفير 4200 دولار',
          metrics: { income: 7000, expenses: 2800, savings: 4200 }
        }
      }),
      prisma.summaryMemory.create({
        data: {
          userId: users[4].id,
          period: '2026-04',
          summaryText: 'شهر أبريل: دخل 4000 يورو، مصروفات 2200 يورو، توفير 1800 يورو',
          metrics: { income: 4000, expenses: 2200, savings: 1800 }
        }
      })
    ]);

    console.log('✅ Created 5 summary memory entries');

    // ──────────────────────────────────────────────────────────────────────────────
    // 10. STORED FILES (5 files)
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('📁 Creating stored files...');

    const storedFiles = await Promise.all([
      prisma.storedFile.create({
        data: {
          userId: users[0].id,
          conversationId: conversations[0].id,
          transactionId: transactions[0].id,
          bucket: "salam-files",
          objectKey: "receipts/receipt_supermarket.jpg",
          originalName: "إيصال سوبر ماركت",
          mimeType: "image/jpeg",
          sizeBytes: 2048576,
          status: "uploaded"
        }
      }),
      prisma.storedFile.create({
        data: {
          userId: users[1].id,
          conversationId: conversations[2].id,
          bucket: "salam-files",
          objectKey: "bills/school_fees.pdf",
          originalName: "فاتورة المدرسة",
          mimeType: "application/pdf",
          sizeBytes: 1024000,
          status: "uploaded"
        }
      }),
      prisma.storedFile.create({
        data: {
          userId: users[2].id,
          transactionId: transactions[12].id,
          bucket: "salam-files",
          objectKey: "receipts/gas_receipt.png",
          originalName: "إيصال البنزين",
          mimeType: "image/png",
          sizeBytes: 1536000,
          status: "uploaded"
        }
      }),
      prisma.storedFile.create({
        data: {
          userId: users[3].id,
          bucket: "salam-files",
          objectKey: "statements/investment_statement.pdf",
          originalName: "كشف الاستثمار",
          mimeType: "application/pdf",
          sizeBytes: 2048000,
          status: "uploaded"
        }
      }),
      prisma.storedFile.create({
        data: {
          userId: users[4].id,
          conversationId: conversations[4].id,
          bucket: "salam-files",
          objectKey: "documents/business_plan.docx",
          originalName: "خطة العمل",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          sizeBytes: 3072000,
          status: "uploaded"
        }
      })
    ]);

    console.log('✅ Created 5 stored files');

    // ──────────────────────────────────────────────────────────────────────────────
    // 11. REFRESH TOKENS (5 tokens)
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('🔑 Creating refresh tokens...');

    const refreshTokens = await Promise.all([
      prisma.refreshToken.create({
        data: {
          userId: users[0].id,
          token: 'refresh_token_user1_abc123def456',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          isRevoked: false
        }
      }),
      prisma.refreshToken.create({
        data: {
          userId: users[1].id,
          token: 'refresh_token_user2_xyz789uvw123',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isRevoked: false
        }
      }),
      prisma.refreshToken.create({
        data: {
          userId: users[2].id,
          token: 'refresh_token_user3_mno456pqr789',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isRevoked: false
        }
      }),
      prisma.refreshToken.create({
        data: {
          userId: users[3].id,
          token: 'refresh_token_user4_stu890vwx123',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isRevoked: false
        }
      }),
      prisma.refreshToken.create({
        data: {
          userId: users[4].id,
          token: 'refresh_token_user5_yza456bcd789',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isRevoked: false
        }
      })
    ]);

    console.log('✅ Created 5 refresh tokens');

    // ──────────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ──────────────────────────────────────────────────────────────────────────────
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   👥 Users: ${users.length}`);
    console.log(`   🎯 Goals: ${goals.length}`);
    console.log(`   💬 Conversations: ${conversations.length}`);
    console.log(`   💬 Messages: ${messages.length}`);
    console.log(`   💰 Transactions: ${transactions.length}`);
    console.log(`   📝 Raw Notes: ${rawNotes.length}`);
    console.log(`   🧠 Global Memory: ${globalMemories.length}`);
    console.log(`   💭 Conversation Memory: ${conversationMemories.length}`);
    console.log(`   📊 Summary Memory: ${summaryMemories.length}`);
    console.log(`   📁 Stored Files: ${storedFiles.length}`);
    console.log(`   🔑 Refresh Tokens: ${refreshTokens.length}`);
    console.log('\n🚀 Ready to test endpoints!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedDatabase()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });