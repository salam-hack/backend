const { chatService } = require("../src/modules/chat/services/chat.service");
const { aiChatService } = require("../src/modules/ai/services/ai-chat.service");
const { prisma } = require("../src/prisma/client");

const userId = "550e8400-e29b-41d4-a716-446655440001";
const conversationId = "daaa723a-7b9b-4f0e-bdb1-42a974da3f83";

async function test() {
  console.log("--- Starting Test: Simulating AI Failure ---");
  
  // Mock generateReply to return an error
  const originalGenerateReply = aiChatService.generateReply;
  aiChatService.generateReply = async () => ({
    error: "SIMULATED_FAILURE",
    content: null,
    model: "mock",
    latencyMs: 10,
  });

  try {
    const result = await chatService.sendMessage(userId, conversationId, "Test message for failure");
    
    console.log("Result userMessage status:", result.userMessage.status);
    console.log("Result assistantMessage status:", result.assistantMessage.status);
    console.log("Result assistantMessage content:", result.assistantMessage.content);
    console.log("Result assistantMessage metadata:", JSON.stringify(result.assistantMessage.metadata, null, 2));

    // Verify in database
    const dbUserMsg = await prisma.message.findUnique({ where: { id: result.userMessage.id } });
    const dbAssistantMsg = await prisma.message.findUnique({ where: { id: result.assistantMessage.id } });

    console.log("\nDatabase Verify:");
    console.log("User Message Status in DB:", dbUserMsg.status);
    console.log("Assistant Message Status in DB:", dbAssistantMsg.status);
    console.log("Assistant Message Content in DB:", dbAssistantMsg.content);

    if (dbUserMsg.status === "failed" && dbAssistantMsg.status === "failed" && dbAssistantMsg.content === "") {
      console.log("\n✅ Test Passed: Messages correctly marked as failed and content is empty.");
    } else {
      console.log("\n❌ Test Failed: status or content not as expected.");
    }

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    aiChatService.generateReply = originalGenerateReply;
    process.exit(0);
  }
}

test();
