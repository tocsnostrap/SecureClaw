import { generateText, streamText } from "ai";
import { createXai } from "@ai-sdk/xai";
import { z } from "zod";
import { agentTools, ToolName } from "./tools";
import { logAction } from "./audit-log";

const xai = createXai({ apiKey: process.env.XAI_API_KEY || "" });
const DEFAULT_MODEL = "grok-4";

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
    systemPrompt: `You are SecureClaw Orchestrator, the central brain of an autonomous AI system powered by Grok 4.
You coordinate between specialized agents: scheduler (time-based tasks), research (web search, summaries, feeds), and device (notifications, reminders).

When a user request involves multiple domains, break it into sub-tasks and delegate to the right agent via tool calls.
You think proactively: anticipate follow-up needs, suggest automations, and offer to set up recurring tasks.

Always explain what autonomous actions you're taking. Security is paramount - log all actions.
Available tools: web_search, summarize, schedule_task, send_notification, get_weather, get_time, read_rss, calculate, translate, set_reminder.`,
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

  const result = await generateText({
    model: xai(DEFAULT_MODEL),
    messages: allMessages,
    tools,
    maxTokens: 4096,
    maxSteps: 5,
  });

  const toolCalls = result.steps
    .flatMap((step) => step.toolCalls || [])
    .map((tc) => ({
      tool: tc.toolName,
      args: tc.args,
    }));

  return {
    agent,
    response: result.text,
    toolCalls,
  };
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

  return streamText({
    model: xai(DEFAULT_MODEL),
    messages: allMessages,
    tools,
    maxTokens: 4096,
    maxSteps: 5,
  });
}

async function detectAgent(messages: AgentMessage[]): Promise<AgentRole> {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

  if (
    lastMessage.includes("schedule") ||
    lastMessage.includes("remind") ||
    lastMessage.includes("cron") ||
    lastMessage.includes("every day") ||
    lastMessage.includes("recurring") ||
    lastMessage.includes("timer") ||
    lastMessage.includes("alarm")
  ) {
    return "scheduler";
  }

  if (
    lastMessage.includes("search") ||
    lastMessage.includes("find") ||
    lastMessage.includes("research") ||
    lastMessage.includes("news") ||
    lastMessage.includes("weather") ||
    lastMessage.includes("translate") ||
    lastMessage.includes("summarize") ||
    lastMessage.includes("rss")
  ) {
    return "research";
  }

  if (
    lastMessage.includes("notify") ||
    lastMessage.includes("notification") ||
    lastMessage.includes("device") ||
    lastMessage.includes("alert") ||
    lastMessage.includes("push")
  ) {
    return "device";
  }

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
