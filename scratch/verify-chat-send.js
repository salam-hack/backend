const userId = "550e8400-e29b-41d4-a716-446655440001";
const conversationId = "daaa723a-7b9b-4f0e-bdb1-42a974da3f83";

async function test() {
  console.log("--- Testing /api/chat/send ---");

  const payload = {
    userId,
    conversationId,
    message: "Hello from verification script"
  };

  try {
    const res = await fetch("http://localhost:3000/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));

    if (data.assistantMessage && !data.success && !data.data) {
      console.log("\n✅ Success: assistantMessage is at the root level.");
    } else {
      console.log("\n❌ Failure: Structure is not as expected.");
    }

  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

test();
