/**
 * MOLTBOT - Server
 * 
 * Clean Express API. Give it a goal, get back results.
 */

import express from 'express';
import { MoltbotAgent } from './agent';
import { createProviderFromEnv } from './providers';
import { listTools } from './tools';
import { getDb, getTask, getUserTasks, getMemoryStats, searchMemories, getRecentMemories } from './db';

// Import tools to register them
import './tools';

let agent: MoltbotAgent | null = null;

function getAgent(): MoltbotAgent {
  if (!agent) {
    const llm = createProviderFromEnv();
    agent = new MoltbotAgent(llm, {
      verbose: process.env.MOLTBOT_VERBOSE !== 'false',
    });
    console.log(`[Moltbot] Agent ready (provider: ${llm.name})`);
  }
  return agent;
}

export function createMoltbotServer(): express.Application {
  const app = express();
  app.use(express.json());

  // CORS for Replit
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // ── Health ──────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    const stats = getMemoryStats();
    res.json({
      status: 'ok',
      agent: 'moltbot',
      provider: agent?.['llm']?.name || 'not initialized',
      tools: listTools().length,
      ...stats,
      uptime: process.uptime(),
    });
  });

  // ── Run a task ──────────────────────────────────────────────────
  app.post('/api/task', async (req, res) => {
    const { goal, context, userId } = req.body;

    if (!goal || typeof goal !== 'string') {
      return res.status(400).json({ error: 'Missing "goal" in request body' });
    }

    try {
      const a = getAgent();
      const task = await a.run(goal, { userId: userId || 'default', context });

      res.json({
        id: task.id,
        status: task.status,
        result: task.result,
        error: task.error,
        steps: task.plan.map(s => ({
          action: s.action,
          tool: s.tool,
          status: s.status,
          output: s.output ? JSON.stringify(s.output).slice(0, 200) : null,
          error: s.error,
        })),
        tokensUsed: task.tokensUsed,
        durationMs: (task.completedAt || Date.now()) - task.startedAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Chat (simple question/answer, no task planning) ─────────────
  app.post('/api/chat', async (req, res) => {
    const { message, userId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing "message" in request body' });
    }

    try {
      const a = getAgent();

      // Check if this looks like a task or just a question
      const isTask = looksLikeTask(message);

      if (isTask) {
        // Run as autonomous task
        const task = await a.run(message, { userId: userId || 'default' });
        return res.json({
          response: task.result || task.error || 'Task completed',
          taskId: task.id,
          status: task.status,
          autonomous: true,
        });
      }

      // Simple chat
      const memories = searchMemories(userId || 'default', message, { limit: 3 });
      const context = memories.length > 0
        ? `\nRelevant memory: ${memories.map((m: any) => m.content).join('; ')}`
        : '';

      const response = await a.chat([
        { role: 'system', content: `You are Moltbot, an autonomous AI agent. You have tools for web search, browsing, code execution, file operations, and more. If the user asks you to DO something (not just answer a question), tell them you'll run it as a task.${context}` },
        { role: 'user', content: message },
      ]);

      res.json({
        response: response.content,
        autonomous: false,
        tokensUsed: (response.inputTokens || 0) + (response.outputTokens || 0),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get task status ─────────────────────────────────────────────
  app.get('/api/task/:id', (req, res) => {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  // ── List user tasks ─────────────────────────────────────────────
  app.get('/api/tasks', (req, res) => {
    const userId = (req.query.userId as string) || 'default';
    const tasks = getUserTasks(userId, 50);
    res.json({ tasks });
  });

  // ── List available tools ────────────────────────────────────────
  app.get('/api/tools', (_req, res) => {
    res.json({
      tools: listTools().map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    });
  });

  // ── Memory ──────────────────────────────────────────────────────
  app.get('/api/memory', (req, res) => {
    const userId = (req.query.userId as string) || 'default';
    const query = req.query.q as string;

    if (query) {
      const results = searchMemories(userId, query, { limit: 20 });
      return res.json({ results });
    }

    const recent = getRecentMemories(userId, 'learning', 20);
    const tasks = getRecentMemories(userId, 'task', 10);
    res.json({ learnings: recent, recentTasks: tasks });
  });

  return app;
}

/**
 * Detect if a message is a task (do something) vs a question (answer something)
 */
function looksLikeTask(msg: string): boolean {
  const l = msg.toLowerCase().trim();

  // Imperative verbs = task
  const taskPatterns = [
    /^(search|find|look up|google)\b/,
    /^(create|build|write|generate|make)\b/,
    /^(monitor|watch|track|check)\b/,
    /^(post|send|publish|tweet)\b/,
    /^(download|fetch|get|grab)\b/,
    /^(run|execute|deploy|install)\b/,
    /^(analyze|summarize|review|compare)\b/,
    /^(scrape|crawl|extract)\b/,
    /^(schedule|remind|automate)\b/,
    /^(read|open|browse)\b.*\b(file|url|http|www)/,
    /^(calculate|compute|solve)\b/,
  ];

  return taskPatterns.some(p => p.test(l));
}

// ── Standalone server ────────────────────────────────────────────────
if (require.main === module || process.argv.includes('--moltbot')) {
  const app = createMoltbotServer();
  const port = parseInt(process.env.PORT || '5000', 10);

  app.listen(port, '0.0.0.0', () => {
    console.log(`\n  Moltbot running on http://localhost:${port}`);
    console.log(`  POST /api/task   { "goal": "..." }  - Run autonomous task`);
    console.log(`  POST /api/chat   { "message": "..." }  - Chat`);
    console.log(`  GET  /api/health                    - Status`);
    console.log(`  GET  /api/tools                     - Available tools\n`);
  });
}
