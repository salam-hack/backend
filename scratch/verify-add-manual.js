const userId = "550e8400-e29b-41d4-a716-446655440001";
const conversationId = "daaa723a-7b9b-4f0e-bdb1-42a974da3f83";

async function test() {
  console.log("--- Testing /api/transactions/add-manual ---");

  const payload = {
    userId,
    title: "Test Dinner",
    amount: 150,
    type: "expense",
    categoryId: "EXP_FOOD",
    date: new Date().toISOString().split('T')[0],
    conversationId // Testing with conversationId
  };

  try {
    console.log("\n1. Testing with conversationId...");
    const res1 = await fetch("http://localhost:3000/api/transactions/add-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data1 = await res1.json();
    console.log("Response 1:", JSON.stringify(data1, null, 2));

    console.log("\n2. Testing without conversationId...");
    const { conversationId: _, ...payloadNoConv } = payload;
    const res2 = await fetch("http://localhost:3000/api/transactions/add-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadNoConv)
    });
    const data2 = await res2.json();
    console.log("Response 2:", JSON.stringify(data2, null, 2));

    if (data1.assistantMessage && data2.assistantMessage) {
      console.log("\n✅ Success: assistantMessage included in both responses.");
    } else {
      console.log("\n❌ Failure: assistantMessage missing.");
    }

  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

test();
