const { prisma } = require("../src/prisma/client");

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No user found");
    return;
  }
  const conversation = await prisma.conversation.findFirst({
    where: { userId: user.id }
  });
  console.log(JSON.stringify({ userId: user.id, conversationId: conversation?.id }, null, 2));
  process.exit(0);
}

main();
