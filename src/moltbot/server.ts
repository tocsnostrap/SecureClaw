/**
 * MOLTBOT - Server
 * 
 * Clean Express API with web UI. Give it a goal, get results.
 */

import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { MoltbotAgent, onStepUpdate, stepListeners } from './agent';
import { createProviderFromEnv } from './providers';
import { listTools } from './tools';
import { getDb, getTask, getUserTasks, getMemoryStats, searchMemories, getRecentMemories, saveMemory } from './db';

import './tools'; // Register all tools

let agent: MoltbotAgent | null = null;

// Conversation history per user (in-memory, survives across requests)
const conversations = new Map<string, Array<{ role: string; content: string; timestamp: number }>>();
const MAX_HISTORY = 20;

function getConversation(userId: string) {
  if (!conversations.has(userId)) conversations.set(userId, []);
  return conversations.get(userId)!;
}

function addToConversation(userId: string, role: string, content: string) {
  const conv = getConversation(userId);
  conv.push({ role, content, timestamp: Date.now() });
  if (conv.length > MAX_HISTORY * 2) conv.splice(0, conv.length - MAX_HISTORY * 2);
}

function getAgent(): MoltbotAgent {
  if (!agent) {
    const llm = createProviderFromEnv();
    agent = new MoltbotAgent(llm, {
      verbose: process.env.MOLTBOT_VERBOSE !== 'false',
    });
    console.log(`[Moltbot] Agent ready (${llm.name}) | ${listTools().length} tools`);
  }
  return agent;
}

export function createMoltbotServer(): express.Application {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // CORS
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // R8: Rate limiting (simple in-memory)
  const rateLimits = new Map<string, { count: number; reset: number }>();
  app.use('/api', (req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const entry = rateLimits.get(ip);
    if (entry && now < entry.reset) {
      if (entry.count >= 30) {
        return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
      }
      entry.count++;
    } else {
      rateLimits.set(ip, { count: 1, reset: now + 60_000 });
    }
    next();
  });

  // ── UI ──────────────────────────────────────────────────────────
  app.get('/', (_req, res) => {
    const paths = [
      path.join(__dirname, 'ui.html'),
      path.join(process.cwd(), 'src', 'moltbot', 'ui.html'),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return res.sendFile(p);
    }
    res.send('<h1>Moltbot</h1><p>UI not found</p>');
  });

  // ── Health ──────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    const stats = getMemoryStats();
    res.json({
      status: 'ok',
      agent: 'moltbot',
      version: '1.0.0',
      provider: agent?.providerName || 'not initialized',
      tools: listTools().length,
      ...stats,
      uptime: Math.round(process.uptime()),
    });
  });

  // ── Run a task ──────────────────────────────────────────────────
  app.post('/api/task', async (req, res) => {
    const { goal, context, userId } = req.body;
    if (!goal || typeof goal !== 'string' || goal.trim().length < 2) {
      return res.status(400).json({ error: 'Provide a "goal" (min 2 characters)' });
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
          action: s.action, tool: s.tool, status: s.status,
          output: s.output ? JSON.stringify(s.output).slice(0, 300) : null,
          error: s.error,
        })),
        tokensUsed: task.tokensUsed,
        durationMs: (task.completedAt || Date.now()) - task.startedAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Chat (with conversation memory) ──────────────────────────────
  app.post('/api/chat', async (req, res) => {
    const { message, userId: rawUserId } = req.body;
    const userId = rawUserId || 'default';

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Provide a "message"' });
    }

    try {
      const a = getAgent();
      const isTask = looksLikeTask(message);

      // Store user message in conversation history
      addToConversation(userId, 'user', message);

      if (isTask) {
        // Build context from recent conversation
        const conv = getConversation(userId);
        const recentContext = conv.slice(-6, -1)
          .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
          .join('\n');

        const task = await a.run(message, {
          userId,
          context: recentContext ? `Recent conversation:\n${recentContext}` : '',
        });

        addToConversation(userId, 'assistant', task.result || task.error || 'Task completed');

        return res.json({
          response: task.result || task.error || 'Task completed',
          taskId: task.id,
          status: task.status,
          autonomous: true,
          steps: task.plan.map(s => ({
            action: s.action, tool: s.tool, status: s.status,
            output: s.output ? JSON.stringify(s.output).slice(0, 300) : null,
            error: s.error,
          })),
          tokensUsed: task.tokensUsed,
          durationMs: (task.completedAt || Date.now()) - task.startedAt,
        });
      }

      // Chat with full conversation history
      const conv = getConversation(userId);
      const memories = searchMemories(userId, message, { limit: 3 });
      const memContext = memories.length > 0
        ? `\nYou remember: ${memories.map((m: any) => m.content).join('; ')}`
        : '';

      // Build messages with history (exclude the message we just added - it goes as the final user message)
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
          content: `You are Moltbot, an autonomous AI agent. You can search the web, browse pages, run JavaScript, execute shell commands, read/write files, call APIs, check weather, do math, read RSS feeds, manage git repos, and remember things.

When the user asks you to DO something (search, create, monitor, analyze, etc.), let them know you're running it as a task and show results.

Be concise, helpful, direct. No hedging.${memContext}`,
        },
      ];

      // Add conversation history EXCLUDING the current message (which is already the last item)
      const historyWithoutCurrent = conv.slice(-11, -1); // Last 10 before current
      for (const msg of historyWithoutCurrent) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
        }
      }

      // Add current message as the final user turn
      messages.push({ role: 'user', content: message });

      const response = await a.chat(messages);
      addToConversation(userId, 'assistant', response.content);

      // Save notable interactions to long-term memory
      if (message.length > 20) {
        saveMemory(userId, 'fact', `User asked: ${message.slice(0, 100)} | Response: ${response.content.slice(0, 100)}`, {}, 0.5);
      }

      res.json({
        response: response.content,
        autonomous: false,
        tokensUsed: (response.inputTokens || 0) + (response.outputTokens || 0),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Run task with streaming progress (SSE) ──────────────────────
  app.post('/api/task/stream', async (req, res) => {
    const { goal, context, userId } = req.body;
    if (!goal || typeof goal !== 'string' || goal.trim().length < 2) {
      return res.status(400).json({ error: 'Provide a "goal"' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Track which task ID we're listening for (set once task starts)
    let myTaskId: string | null = null;
    let listenerRemoved = false;

    const listener = (task: any, step: any, event: string) => {
      // Capture the task ID from the first event
      if (!myTaskId) myTaskId = task.id;
      // Only handle our task
      if (task.id !== myTaskId) return;
      try {
        res.write(`data: ${JSON.stringify({ event, step: { action: step.action, tool: step.tool, status: step.status, index: step.index }, taskId: task.id })}\n\n`);
      } catch {}
    };
    onStepUpdate(listener);

    // Remove listener helper
    function removeListener() {
      if (!listenerRemoved) {
        const idx = (stepListeners as any[]).indexOf(listener);
        if (idx >= 0) (stepListeners as any[]).splice(idx, 1);
        listenerRemoved = true;
      }
    }

    // Clean up if client disconnects
    res.on('close', removeListener);

    try {
      const a = getAgent();
      addToConversation(userId || 'default', 'user', goal);

      const task = await a.run(goal, { userId: userId || 'default', context });
      addToConversation(userId || 'default', 'assistant', task.result || task.error || 'Task completed');

      res.write(`data: ${JSON.stringify({
        event: 'complete',
        id: task.id, status: task.status, result: task.result, error: task.error,
        steps: task.plan.map(s => ({ action: s.action, tool: s.tool, status: s.status, error: s.error })),
        tokensUsed: task.tokensUsed,
        durationMs: (task.completedAt || Date.now()) - task.startedAt,
      })}\n\n`);
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ event: 'error', error: err.message })}\n\n`);
    }

    removeListener();
    res.write('data: [DONE]\n\n');
    res.end();
  });

  // ── Clear conversation ──────────────────────────────────────────
  app.post('/api/clear', (req, res) => {
    const userId = req.body.userId || 'default';
    conversations.delete(userId);
    res.json({ ok: true });
  });

  // ── Task details ────────────────────────────────────────────────
  app.get('/api/task/:id', (req, res) => {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  // ── Task list ───────────────────────────────────────────────────
  app.get('/api/tasks', (req, res) => {
    const userId = (req.query.userId as string) || 'default';
    const tasks = getUserTasks(userId, 50);
    res.json({ tasks });
  });

  // ── Tools ───────────────────────────────────────────────────────
  app.get('/api/tools', (_req, res) => {
    res.json({
      tools: listTools().map(t => ({
        name: t.name, description: t.description, parameters: t.parameters,
      })),
    });
  });

  // ── Memory ──────────────────────────────────────────────────────
  app.get('/api/memory', (req, res) => {
    const userId = (req.query.userId as string) || 'default';
    const query = req.query.q as string;
    if (query) {
      return res.json({ results: searchMemories(userId, query, { limit: 20 }) });
    }
    res.json({
      learnings: getRecentMemories(userId, 'learning', 20),
      recentTasks: getRecentMemories(userId, 'task', 10),
    });
  });

  // R9: Debug endpoint
  app.get('/api/debug', (_req, res) => {
    res.json({
      env: {
        hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasXAI: !!process.env.XAI_API_KEY,
        hasOllama: !!process.env.OLLAMA_MODEL,
        nodeVersion: process.version,
        platform: process.platform,
      },
      agent: {
        initialized: !!agent,
        provider: agent?.providerName || 'none',
        toolCount: listTools().length,
      },
      db: getMemoryStats(),
    });
  });

  return app;
}

// R6: Better task detection
function looksLikeTask(msg: string): boolean {
  const l = msg.toLowerCase().trim();

  // Short messages are usually chat
  if (l.length < 10 && !l.match(/^(search|find|get|check|run|read)/)) return false;

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
    /^(read|open|browse)\b.*\b(file|url|http|www|rss|feed)/,
    /^(calculate|compute|solve)\b/,
    /^(list|show)\b.*\b(files|directory)/,
    /\b(weather|forecast)\b.*\b(in|for|at)\b/,
    /\b(news|headlines|latest)\b.*\b(about|on|for)\b/,
  ];

  return taskPatterns.some(p => p.test(l));
}

// ── Standalone ──────────────────────────────────────────────────────
if (require.main === module || process.argv.includes('--moltbot')) {
  const app = createMoltbotServer();
  const port = parseInt(process.env.PORT || '5000', 10);

  app.listen(port, '0.0.0.0', () => {
    console.log(`\n  Moltbot running on http://localhost:${port}`);
    console.log(`  ${listTools().length} tools loaded\n`);
  });
}
