import { callGrok, ChatMessage } from "../src/agents/providers/xai";

async function testGrok() {
  console.log("=== SecureClaw AI Test ===");
  console.log("Provider: xAI");
  console.log("Model: Grok 4");
  console.log("");

  if (!process.env.XAI_API_KEY) {
    console.error("ERROR: XAI_API_KEY environment variable is not set.");
    console.error("Set it with: export XAI_API_KEY=your_key_here");
    process.exit(1);
  }

  const testMessages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are SecureClaw, a secure personal AI assistant. Be concise and helpful.",
    },
    {
      role: "user",
      content:
        "Hello SecureClaw! Can you confirm you're running on Grok 4 and briefly describe your security features?",
    },
  ];

  console.log("Sending test prompt to Grok 4...");
  console.log(`Prompt: "${testMessages[1].content}"`);
  console.log("");

  try {
    const startTime = Date.now();
    const response = await callGrok(testMessages);
    const elapsed = Date.now() - startTime;

    console.log("--- Response ---");
    console.log(response);
    console.log("----------------");
    console.log(`Response time: ${elapsed}ms`);
    console.log("");
    console.log("Test PASSED - Grok 4 integration working.");
  } catch (error: any) {
    console.error("Test FAILED:", error.message);
    process.exit(1);
  }
}

testGrok();
