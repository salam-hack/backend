const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getIds() {
  const conv = await prisma.conversation.findFirst({
    select: { id: true, userId: true }
  });
  console.log(JSON.stringify(conv));
  await prisma.$disconnect();
}

getIds();
