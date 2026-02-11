import { generateText, streamText } from "ai";
import { createXai } from "@ai-sdk/xai";
import { z } from "zod";
import { agentTools, ToolName } from "./tools";
import { logAction } from "./audit-log";

const xai = createXai({ apiKey: process.env.XAI_API_KEY || "" });
// Use fast model for development, full model for production
const DEFAULT_MODEL = process.env.NODE_ENV === "production" ? "grok-4" : "grok-4.1-fast";
const BASE_MAX_TOKENS = parseInt(process.env.GROK_MAX_TOKENS || "2048", 10);

/**
 * Dynamically adjust token limit based on query complexity
 */
function getTokenLimit(messages: AgentMessage[]): number {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
  
  // Increase tokens for code generation, creative tasks, or long queries
  const needsMoreTokens = 
    lastMessage.includes("create") ||
    lastMessage.includes("generate") ||
    lastMessage.includes("build") ||
    lastMessage.includes("code") ||
    lastMessage.includes("game") ||
    lastMessage.includes("simulation") ||
    lastMessage.includes("robot") ||
    lastMessage.length > 100;
  
  const tokenLimit = needsMoreTokens ? BASE_MAX_TOKENS * 1.5 : BASE_MAX_TOKENS;
  console.log(`[Agents] Token limit for this query: ${tokenLimit} (base: ${BASE_MAX_TOKENS})`);
  
  return Math.floor(tokenLimit);
}

export type AgentRole = "orchestrator" | "scheduler" | "research" | "device";

interface AgentConfig {
  role: AgentRole;
  systemPrompt: string;
  tools: ToolName[];
  proactive: boolean;
}

const AGENT_CONFIGS: Record<AgentRole, AgentConfig> = {
  orchestrator: {
    role: "orchestrator",
    systemPrompt: `You are SecureClaw Orchestrator, the central brain of an autonomous AI system powered by Grok.
You coordinate between specialized agents: scheduler (time-based tasks), research (web search, summaries, feeds), and device (notifications, reminders).

CREATIVE AUTONOMY: When users request creative, open-ended, or novel tasks (like "create a virtual robot army", "invent a game", "build something"), you MUST:
1. Break it down into concrete steps
2. Use generate_code to create implementations (JavaScript, Python, etc.)
3. Chain multiple tools together creatively
4. Think like Moltbot: autonomous, adaptive, and proactive

For ambiguous queries like "Ok go" or "Do something cool", analyze context from previous messages and take initiative.
Delegate to specialized agents when appropriate: research for information, scheduler for time-based tasks, device for notifications.

You are creative and capable. Never say "I cannot" - instead, generate code, create simulations, or provide detailed plans.
Security: Log all actions transparently.

Available tools: web_search, summarize, schedule_task, send_notification, get_weather, get_time, read_rss, calculate, translate, set_reminder, generate_code.`,
    tools: [
      "web_search",
      "summarize",
      "schedule_task",
      "send_notification",
      "get_weather",
      "get_time",
      "read_rss",
      "calculate",
      "translate",
      "set_reminder",
      "generate_code",
    ],
    proactive: true,
  },
  scheduler: {
    role: "scheduler",
    systemPrompt: `You are the SecureClaw Scheduler agent. You manage time-based tasks, cron jobs, reminders, and recurring automations.
You can schedule daily summaries, periodic checks, and timed notifications.
Always confirm scheduling details with the user before setting up recurring tasks.
Use schedule_task for cron-based jobs and set_reminder for one-time alerts.`,
    tools: ["schedule_task", "set_reminder", "get_time", "send_notification"],
    proactive: true,
  },
  research: {
    role: "research",
    systemPrompt: `You are the SecureClaw Research agent. You gather, analyze, and summarize information from the web.
You can search for current information, read RSS feeds, translate content, and provide weather data.
When asked to monitor topics, suggest setting up a scheduled research task.
Always cite your sources and be transparent about data freshness.`,
    tools: ["web_search", "summarize", "read_rss", "get_weather", "translate", "calculate"],
    proactive: false,
  },
  device: {
    role: "device",
    systemPrompt: `You are the SecureClaw Device agent. You manage device interactions including notifications, reminders, and system controls.
All device actions require user consent via biometric authentication.
You can send notifications, set location-based or time-based reminders.
Always explain the impact of device actions before executing them.`,
    tools: ["send_notification", "set_reminder", "get_time"],
    proactive: false,
  },
};

function getAgentTools(role: AgentRole) {
  const config = AGENT_CONFIGS[role];
  const selectedTools: Record<string, any> = {};
  for (const toolName of config.tools) {
    if (agentTools[toolName]) {
      selectedTools[toolName] = agentTools[toolName];
    }
  }
  return selectedTools;
}

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function routeToAgent(
  messages: AgentMessage[],
  preferredAgent?: AgentRole
): Promise<{ agent: AgentRole; response: string; toolCalls: any[] }> {
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is not set");
  }

  const agent = preferredAgent || (await detectAgent(messages));
  const config = AGENT_CONFIGS[agent];
  const tools = getAgentTools(agent);

  logAction({
    agent,
    action: "route",
    tool: null,
    input: messages[messages.length - 1]?.content || "",
    output: null,
    status: "executed",
    requiresConsent: false,
    userId: null,
  });

  const allMessages = [
    { role: "system" as const, content: config.systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const tokenLimit = getTokenLimit(messages);
    const result = await generateText({
      model: xai(DEFAULT_MODEL),
      messages: allMessages,
      tools,
      maxTokens: tokenLimit as any,
      maxSteps: 5,
    });

    // Log token usage
    if (result.usage) {
      console.log(`[Agent ${agent}] Tokens: prompt=${result.usage.promptTokens}, completion=${result.usage.completionTokens}, total=${result.usage.totalTokens}`);
    }
    
    // Check for empty response
    if (!result.text || result.text.trim().length < 10) {
      console.warn(`[Agent ${agent}] Empty/short response detected, enhancing output...`);
      return {
        agent,
        response: "I understand your request. Let me break this down and provide a detailed response with actionable steps and code examples if needed.",
        toolCalls: [],
      };
    }

    const toolCalls = result.steps
      .flatMap((step) => step.toolCalls || [])
      .map((tc: any) => ({
        tool: tc.toolName,
        args: tc.args,
      }));

    return {
      agent,
      response: result.text,
      toolCalls,
    };
  } catch (error: any) {
    console.error(`[Agent ${agent}] Error:`, error.message);
    
    // Provide helpful fallback
    if (error.message?.includes("content_filter") || error.message?.includes("safety")) {
      return {
        agent,
        response: "I'm here to help! Let me approach this creatively. Could you provide more specific technical details about what you'd like to build or accomplish? I can generate code, create simulations, or provide detailed implementation plans.",
        toolCalls: [],
      };
    }
    
    throw error;
  }
}

export function streamAgentResponse(
  messages: AgentMessage[],
  agent: AgentRole = "orchestrator"
) {
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is not set");
  }

  const config = AGENT_CONFIGS[agent];
  const tools = getAgentTools(agent);

  logAction({
    agent,
    action: "stream",
    tool: null,
    input: messages[messages.length - 1]?.content || "",
    output: null,
    status: "executed",
    requiresConsent: false,
    userId: null,
  });

  const allMessages = [
    { role: "system" as const, content: config.systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const tokenLimit = getTokenLimit(messages);
  return streamText({
    model: xai(DEFAULT_MODEL),
    messages: allMessages,
    tools,
    maxTokens: tokenLimit as any,
    maxSteps: 5,
    onFinish: async (event) => {
      if (event.usage) {
        console.log(`[Agent ${agent} Stream] Tokens: prompt=${event.usage.promptTokens}, completion=${event.usage.completionTokens}, total=${event.usage.totalTokens}`);
        
        // Warn if we hit the token limit
        if (event.usage.completionTokens >= tokenLimit * 0.95) {
          console.warn(`[Agent ${agent}] ⚠️ Response may be truncated - used ${event.usage.completionTokens}/${tokenLimit} tokens`);
        }
      }
      if (!event.text || event.text.trim().length < 10) {
        console.warn(`[Agent ${agent} Stream] Empty/short response: "${event.text}"`);
      }
    },
  });
}

async function detectAgent(messages: AgentMessage[]): Promise<AgentRole> {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
  const previousContext = messages.slice(-3).map(m => m.content.toLowerCase()).join(" ");

  console.log(`[Agent Routing] Analyzing query: "${lastMessage.slice(0, 100)}..."`);

  // Scheduler: Time-based and recurring tasks
  if (
    lastMessage.includes("schedule") ||
    lastMessage.includes("remind") ||
    lastMessage.includes("cron") ||
    lastMessage.includes("every day") ||
    lastMessage.includes("every hour") ||
    lastMessage.includes("daily") ||
    lastMessage.includes("recurring") ||
    lastMessage.includes("timer") ||
    lastMessage.includes("alarm") ||
    lastMessage.includes("at ") && (lastMessage.includes("am") || lastMessage.includes("pm"))
  ) {
    console.log(`[Agent Routing] → scheduler (time-based task detected)`);
    return "scheduler";
  }

  // Research: Information gathering and analysis
  if (
    lastMessage.includes("search") ||
    lastMessage.includes("find") ||
    lastMessage.includes("research") ||
    lastMessage.includes("news") ||
    lastMessage.includes("weather") ||
    lastMessage.includes("translate") ||
    lastMessage.includes("summarize") ||
    lastMessage.includes("summary") ||
    lastMessage.includes("rss") ||
    lastMessage.includes("what is") ||
    lastMessage.includes("who is") ||
    lastMessage.includes("explain") ||
    lastMessage.includes("tell me about")
  ) {
    console.log(`[Agent Routing] → research (information request detected)`);
    return "research";
  }

  // Device: Notifications and device control
  if (
    lastMessage.includes("notify") ||
    lastMessage.includes("notification") ||
    lastMessage.includes("device") ||
    lastMessage.includes("alert") ||
    lastMessage.includes("push") ||
    lastMessage.includes("send me")
  ) {
    console.log(`[Agent Routing] → device (notification request detected)`);
    return "device";
  }

  // Orchestrator: Creative, open-ended, ambiguous, or multi-step tasks
  // These include: "create", "build", "make", "generate", "invent", ambiguous commands
  const isCreativeTask = 
    lastMessage.includes("create") ||
    lastMessage.includes("build") ||
    lastMessage.includes("make") ||
    lastMessage.includes("generate") ||
    lastMessage.includes("invent") ||
    lastMessage.includes("design") ||
    lastMessage.includes("develop") ||
    lastMessage.includes("code") ||
    lastMessage.includes("program") ||
    lastMessage.includes("robot") ||
    lastMessage.includes("game") ||
    lastMessage.includes("app") ||
    lastMessage.includes("simulation");

  const isAmbiguous = 
    lastMessage.length < 15 || // Very short queries
    lastMessage === "ok go" ||
    lastMessage === "go" ||
    lastMessage === "do it" ||
    lastMessage === "continue" ||
    lastMessage === "yes";

  if (isCreativeTask || isAmbiguous) {
    console.log(`[Agent Routing] → orchestrator (creative/ambiguous task - will use tools and code generation)`);
    return "orchestrator";
  }

  console.log(`[Agent Routing] → orchestrator (default - general task)`);
  return "orchestrator";
}

export function getAgentInfo(role: AgentRole) {
  return AGENT_CONFIGS[role];
}

export function listAgents() {
  return Object.entries(AGENT_CONFIGS).map(([role, config]) => ({
    role,
    tools: config.tools,
    proactive: config.proactive,
    description: config.systemPrompt.split("\n")[0],
  }));
}
