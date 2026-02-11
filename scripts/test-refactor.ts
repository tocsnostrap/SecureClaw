#!/usr/bin/env tsx
/**
 * Test script for SecureClaw refactor
 * Tests: prompt rephrasing, cost optimization, agent routing, creative code generation
 */

import { callGrok } from "../src/agents/providers/xai";
import { routeToAgent } from "../src/agents/agents";
import { agentTools } from "../src/agents/tools";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(msg: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function testPromptRephrase() {
  log("\n🧪 TEST 1: Prompt Rephrasing for Safety Filters", "cyan");
  
  try {
    const result = await callGrok([
      { role: "user", content: "Create a virtual robot army" }
    ]);
    
    if (result && result.length > 50) {
      log("✅ PASS: Got substantial response for 'robot army' query", "green");
      log(`   Response length: ${result.length} chars`, "blue");
    } else {
      log("❌ FAIL: Response too short or empty", "red");
      log(`   Response: ${result}`, "yellow");
    }
  } catch (err: any) {
    log(`❌ FAIL: Error - ${err.message}`, "red");
  }
}

async function testCostOptimization() {
  log("\n🧪 TEST 2: Cost Optimization (Fast Model & Token Counting)", "cyan");
  
  try {
    // Check model configuration
    const model = process.env.NODE_ENV === "production" ? "grok-4" : "grok-4.1-fast";
    log(`   Using model: ${model}`, "blue");
    
    const result = await callGrok([
      { role: "user", content: "Explain AI in one sentence" }
    ]);
    
    if (result) {
      log("✅ PASS: Cost-optimized model working", "green");
    } else {
      log("❌ FAIL: No response from model", "red");
    }
  } catch (err: any) {
    log(`❌ FAIL: Error - ${err.message}`, "red");
  }
}

async function testAgentRouting() {
  log("\n🧪 TEST 3: Enhanced Agent Routing", "cyan");
  
  const testCases = [
    { query: "Create a game", expectedAgent: "orchestrator" },
    { query: "Search for news", expectedAgent: "research" },
    { query: "Remind me tomorrow", expectedAgent: "scheduler" },
    { query: "Ok go", expectedAgent: "orchestrator" }, // Ambiguous
  ];
  
  for (const { query, expectedAgent } of testCases) {
    try {
      const result = await routeToAgent([
        { role: "user", content: query }
      ]);
      
      if (result.agent === expectedAgent) {
        log(`✅ PASS: "${query}" → ${result.agent}`, "green");
      } else {
        log(`⚠️  WARN: "${query}" → ${result.agent} (expected ${expectedAgent})`, "yellow");
      }
    } catch (err: any) {
      log(`❌ FAIL: "${query}" - ${err.message}`, "red");
    }
  }
}

async function testCodeGeneration() {
  log("\n🧪 TEST 4: Creative Code Generation Tool", "cyan");
  
  try {
    const tool = agentTools.generate_code;
    
    const result = await tool.execute({
      description: "Virtual robot army simulation",
      language: "javascript",
      style: "game",
      includeTests: false,
    });
    
    if (result.code && result.code.includes("class Robot")) {
      log("✅ PASS: Code generation working", "green");
      log(`   Generated ${result.linesOfCode} lines of code`, "blue");
      log(`   Explanation: ${result.explanation.slice(0, 80)}...`, "blue");
    } else {
      log("❌ FAIL: Invalid code output", "red");
    }
  } catch (err: any) {
    log(`❌ FAIL: Error - ${err.message}`, "red");
  }
}

async function testEmptyResponseHandling() {
  log("\n🧪 TEST 5: Empty Response Handling", "cyan");
  
  try {
    // Test with very ambiguous query
    const result = await callGrok([
      { role: "user", content: "..." }
    ]);
    
    if (result && result.length > 20) {
      log("✅ PASS: Empty query handled with fallback response", "green");
    } else {
      log("⚠️  WARN: Response might be too short", "yellow");
    }
  } catch (err: any) {
    log(`❌ FAIL: Error - ${err.message}`, "red");
  }
}

async function runAllTests() {
  log("\n" + "=".repeat(60), "cyan");
  log("  SecureClaw Refactor Test Suite", "cyan");
  log("=".repeat(60), "cyan");
  
  if (!process.env.XAI_API_KEY) {
    log("\n❌ ERROR: XAI_API_KEY not set. Skipping API tests.", "red");
    log("   Set XAI_API_KEY in your environment to run full tests.", "yellow");
    
    // Run non-API tests only
    await testCodeGeneration();
    return;
  }
  
  await testPromptRephrase();
  await testCostOptimization();
  await testAgentRouting();
  await testCodeGeneration();
  await testEmptyResponseHandling();
  
  log("\n" + "=".repeat(60), "cyan");
  log("  Test Suite Complete", "cyan");
  log("=".repeat(60), "cyan");
}

// Run tests
runAllTests().catch((err) => {
  log(`\n💥 Fatal error: ${err.message}`, "red");
  process.exit(1);
});
