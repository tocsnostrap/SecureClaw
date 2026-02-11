import { routeToAgent, AgentMessage } from "./agents";
import { logAction, getAuditLog, getAuditStats, clearAuditLog } from "./audit-log";
export { getAuditLog, getAuditStats, clearAuditLog };

export interface ProactiveTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  agent: string;
  prompt: string;
  enabled: boolean;
  lastRun: number | null;
  nextRun: number | null;
  results: TaskResult[];
}

export interface TaskResult {
  timestamp: number;
  output: string;
  toolCalls: any[];
  status: "success" | "error";
}

const proactiveTasks: ProactiveTask[] = [];
const taskIntervals: Map<string, NodeJS.Timer> = new Map();

let taskCounter = 0;
function generateTaskId(): string {
  taskCounter++;
  return `ptask-${Date.now()}-${taskCounter}`;
}

export function createProactiveTask(config: {
  name: string;
  description: string;
  cronExpression: string;
  agent: string;
  prompt: string;
}): ProactiveTask {
  const task: ProactiveTask = {
    id: generateTaskId(),
    name: config.name,
    description: config.description,
    cronExpression: config.cronExpression,
    agent: config.agent,
    prompt: config.prompt,
    enabled: true,
    lastRun: null,
    nextRun: null,
    results: [],
  };

  proactiveTasks.push(task);

  logAction({
    agent: config.agent,
    action: "create_proactive_task",
    tool: null,
    input: `${config.name}: ${config.description}`,
    output: task.id,
    status: "executed",
    requiresConsent: true,
    userId: null,
  });

  scheduleTask(task);
  return task;
}

function parseCronToMs(cron: string): number {
  const parts = cron.split(" ");
  if (parts.length < 5) {
    return 3600000;
  }

  const minute = parts[0];
  const hour = parts[1];
  const dayOfMonth = parts[2];

  if (dayOfMonth !== "*") return 86400000;
  if (hour !== "*") return 3600000;
  if (minute !== "*") {
    const interval = parseInt(minute.replace("*/", ""));
    if (!isNaN(interval)) return interval * 60000;
    return 60000;
  }

  return 3600000;
}

function scheduleTask(task: ProactiveTask) {
  const existingInterval = taskIntervals.get(task.id);
  if (existingInterval) {
    clearInterval(existingInterval as any);
  }

  const intervalMs = parseCronToMs(task.cronExpression);
  task.nextRun = Date.now() + intervalMs;

  const interval = setInterval(async () => {
    if (!task.enabled) return;

    try {
      task.lastRun = Date.now();

      logAction({
        agent: task.agent,
        action: "proactive_execution",
        tool: null,
        input: task.prompt,
        output: null,
        status: "executed",
        requiresConsent: false,
        userId: null,
      });

      const messages: AgentMessage[] = [
        {
          role: "system",
          content: `You are executing a proactive task: "${task.name}". ${task.description}. Provide actionable results.`,
        },
        { role: "user", content: task.prompt },
      ];

      const result = await routeToAgent(messages, task.agent as any);

      const taskResult: TaskResult = {
        timestamp: Date.now(),
        output: result.response,
        toolCalls: result.toolCalls,
        status: "success",
      };

      task.results.unshift(taskResult);
      if (task.results.length > 10) task.results.length = 10;
      task.nextRun = Date.now() + intervalMs;

      console.log(`[Proactive] Task "${task.name}" executed successfully`);
    } catch (err: any) {
      const taskResult: TaskResult = {
        timestamp: Date.now(),
        output: err.message,
        toolCalls: [],
        status: "error",
      };
      task.results.unshift(taskResult);

      logAction({
        agent: task.agent,
        action: "proactive_execution_failed",
        tool: null,
        input: task.prompt,
        output: err.message,
        status: "failed",
        requiresConsent: false,
        userId: null,
      });

      console.error(`[Proactive] Task "${task.name}" failed:`, err.message);
    }
  }, intervalMs);

  taskIntervals.set(task.id, interval);
}

export function getProactiveTasks(): ProactiveTask[] {
  return proactiveTasks;
}

export function getProactiveTask(id: string): ProactiveTask | undefined {
  return proactiveTasks.find((t) => t.id === id);
}

export function toggleProactiveTask(id: string, enabled: boolean): ProactiveTask | null {
  const task = proactiveTasks.find((t) => t.id === id);
  if (!task) return null;

  task.enabled = enabled;
  if (!enabled) {
    const interval = taskIntervals.get(id);
    if (interval) {
      clearInterval(interval as any);
      taskIntervals.delete(id);
    }
  } else {
    scheduleTask(task);
  }

  logAction({
    agent: task.agent,
    action: enabled ? "enable_task" : "disable_task",
    tool: null,
    input: task.name,
    output: null,
    status: "executed",
    requiresConsent: true,
    userId: null,
  });

  return task;
}

export function deleteProactiveTask(id: string): boolean {
  const index = proactiveTasks.findIndex((t) => t.id === id);
  if (index === -1) return false;

  const task = proactiveTasks[index];
  const interval = taskIntervals.get(id);
  if (interval) {
    clearInterval(interval as any);
    taskIntervals.delete(id);
  }

  proactiveTasks.splice(index, 1);

  logAction({
    agent: task.agent,
    action: "delete_task",
    tool: null,
    input: task.name,
    output: null,
    status: "executed",
    requiresConsent: true,
    userId: null,
  });

  return true;
}

export async function executeTaskNow(id: string): Promise<TaskResult | null> {
  const task = proactiveTasks.find((t) => t.id === id);
  if (!task) return null;

  try {
    task.lastRun = Date.now();

    const messages: AgentMessage[] = [
      {
        role: "system",
        content: `You are executing a proactive task: "${task.name}". ${task.description}. Provide actionable results.`,
      },
      { role: "user", content: task.prompt },
    ];

    const result = await routeToAgent(messages, task.agent as any);

    const taskResult: TaskResult = {
      timestamp: Date.now(),
      output: result.response,
      toolCalls: result.toolCalls,
      status: "success",
    };

    task.results.unshift(taskResult);
    if (task.results.length > 10) task.results.length = 10;

    return taskResult;
  } catch (err: any) {
    const taskResult: TaskResult = {
      timestamp: Date.now(),
      output: err.message,
      toolCalls: [],
      status: "error",
    };
    task.results.unshift(taskResult);
    return taskResult;
  }
}

export function initDefaultProactiveTasks() {
  if (proactiveTasks.length > 0) return;

  console.log("[Proactive] Default proactive tasks available but not auto-started.");
  console.log("[Proactive] Use POST /api/agents/tasks to create proactive tasks.");
}

export const DEFAULT_TASK_TEMPLATES = [
  {
    name: "Daily Morning Briefing",
    description: "Generate a daily summary of weather, news highlights, and scheduled tasks",
    cronExpression: "0 9 * * *",
    agent: "orchestrator",
    prompt:
      "Generate a morning briefing: 1) Get the current weather, 2) Summarize any top news or recent updates, 3) List any scheduled tasks or reminders for today. Format as a concise daily brief.",
  },
  {
    name: "Hourly News Monitor",
    description: "Check RSS feeds and search for trending topics every hour",
    cronExpression: "0 * * * *",
    agent: "research",
    prompt:
      "Search for the latest trending technology and AI news. Provide a brief summary of the top 3 stories with links.",
  },
  {
    name: "Daily X/Twitter Search",
    description: "Search and summarize posts on X about specified topics",
    cronExpression: "0 18 * * *",
    agent: "research",
    prompt:
      "Search the web for the latest discussions and posts about AI safety, autonomous agents, and Grok. Summarize the top findings and any notable opinions.",
  },
  {
    name: "X Feed Monitor - AI & Tech",
    description: "Monitor X/Twitter for AI, autonomous agents, and tech trends every 2 hours",
    cronExpression: "0 */2 * * *",
    agent: "research",
    prompt:
      "Search for trending discussions on X (Twitter) about: AI breakthroughs, autonomous agents, Grok updates, and emerging tech. Highlight the most important conversations and sentiment.",
  },
  {
    name: "X Feed Monitor - Breaking News",
    description: "Monitor X/Twitter for breaking news and viral trends every hour",
    cronExpression: "0 * * * *",
    agent: "research",
    prompt:
      "Search X (Twitter) for breaking news, viral trends, and important updates across technology, science, and world events. Focus on high-impact stories gaining traction.",
  },
  {
    name: "Proactive Task Suggester",
    description: "Analyze patterns and suggest new automations daily",
    cronExpression: "0 20 * * *",
    agent: "orchestrator",
    prompt:
      "Based on today's activities and user patterns, suggest 3 useful automation tasks that could be scheduled. Think creatively about recurring needs.",
  },
];
