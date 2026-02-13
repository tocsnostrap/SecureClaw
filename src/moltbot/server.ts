/**
 * MOLTBOT - Server
 */

import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { MoltbotAgent } from './agent';
import { createProviderFromEnv } from './providers';
import { listTools } from './tools';
import { getDb, getTask, getUserTasks, getMemoryStats, searchMemories, getRecentMemories, saveMemory } from './db';

import './tools';

let agent: MoltbotAgent;

// Conversation history per user
const conversations = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();

function getHistory(userId: string) {
  if (!conversations.has(userId)) conversations.set(userId, []);
  return conversations.get(userId)!;
}

function addHistory(userId: string, role: 'user' | 'assistant', content: string) {
  const h = getHistory(userId);
  h.push({ role, content });
  if (h.length > 30) h.splice(0, h.length - 30);
}

export function createMoltbotServer(): express.Application {
  // Initialize agent immediately - don't wait for first request
  const llm = createProviderFromEnv();
  agent = new MoltbotAgent(llm, { verbose: process.env.MOLTBOT_VERBOSE !== 'false' });
  console.log(`[Moltbot] Agent ready (${llm.name}) | ${listTools().length} tools`);

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

  // UI
  app.get('/', (_req, res) => {
    for (const p of [path.join(__dirname, 'ui.html'), path.join(process.cwd(), 'src', 'moltbot', 'ui.html')]) {
      if (fs.existsSync(p)) return res.sendFile(p);
    }
    res.send('<h1>Moltbot</h1>');
  });

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      provider: agent.providerName,
      tools: listTools().length,
      ...getMemoryStats(),
    });
  });

  // ── THE ONE ENDPOINT ────────────────────────────────────────────
  // Everything goes here. Agent decides what to do.
  app.post('/api/message', async (req, res) => {
    const { message, userId: rawUserId } = req.body;
    const userId = rawUserId || 'default';

    if (!message || typeof message !== 'string' || message.trim().length < 1) {
      return res.status(400).json({ error: 'Send a message' });
    }

    const msg = message.trim();
    addHistory(userId, 'user', msg);

    try {
      // Ask the LLM: should I run this as a task or just respond?
      const history = getHistory(userId);
      const historyContext = history.slice(-10, -1) // Exclude current message
        .map(m => `${m.role}: ${m.content.slice(0, 150)}`)
        .join('\n');

      const memories = searchMemories(userId, msg, { limit: 3 });
      const memContext = memories.length > 0
        ? `\nMemory: ${memories.map((m: any) => m.content).join('; ')}`
        : '';

      // First: quick classification - does this need tools or just chat?
      const needsTools = shouldRunTask(msg);

      if (needsTools) {
        // Run as autonomous task
        const context = historyContext ? `Conversation so far:\n${historyContext}` : '';
        const task = await agent.run(msg, { userId, context });

        const result = task.result || task.error || 'Task completed';
        addHistory(userId, 'assistant', result);

        return res.json({
          type: 'task',
          response: result,
          taskId: task.id,
          status: task.status,
          steps: task.plan.map(s => ({
            action: s.action, tool: s.tool, status: s.status, error: s.error,
          })),
          tokensUsed: task.tokensUsed,
          durationMs: (task.completedAt || Date.now()) - task.startedAt,
        });
      }

      // Chat response with history
      const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
          content: `You are Moltbot, an autonomous AI agent with real tools: web search, browse URLs, run JavaScript, shell commands, read/write files, HTTP requests, weather, math, RSS feeds, git, and persistent memory.

You don't just talk - you ACT. If a user asks you to do something, do it. Run tasks. Get real data. Execute code. Don't just describe what you could do.

If a request needs real-world action (searching, computing, fetching data, creating files), say "Let me handle that" and explain you need them to phrase it as a direct task.${memContext}`,
        },
      ];

      // Add history (excluding current - it's added below)
      for (const m of history.slice(-10, -1)) {
        chatMessages.push({ role: m.role, content: m.content });
      }
      chatMessages.push({ role: 'user', content: msg });

      const response = await agent.chat(chatMessages);
      addHistory(userId, 'assistant', response.content);

      // Save to long-term memory
      if (msg.length > 15) {
        saveMemory(userId, 'fact', `${msg.slice(0, 80)} -> ${response.content.slice(0, 80)}`, {}, 0.5);
      }

      return res.json({
        type: 'chat',
        response: response.content,
        tokensUsed: (response.inputTokens || 0) + (response.outputTokens || 0),
      });

    } catch (err: any) {
      console.error('[Moltbot] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Clear conversation
  app.post('/api/clear', (req, res) => {
    conversations.delete(req.body.userId || 'default');
    res.json({ ok: true });
  });

  // Task details
  app.get('/api/task/:id', (req, res) => {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    res.json(task);
  });

  // Task list
  app.get('/api/tasks', (req, res) => {
    res.json({ tasks: getUserTasks((req.query.userId as string) || 'default', 50) });
  });

  // Tools list
  app.get('/api/tools', (_req, res) => {
    res.json({ tools: listTools().map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) });
  });

  // Memory
  app.get('/api/memory', (req, res) => {
    const userId = (req.query.userId as string) || 'default';
    const q = req.query.q as string;
    if (q) return res.json({ results: searchMemories(userId, q, { limit: 20 }) });
    res.json({ learnings: getRecentMemories(userId, 'learning', 20), tasks: getRecentMemories(userId, 'task', 10) });
  });

  return app;
}

/**
 * Decide if a message needs autonomous task execution
 */
function shouldRunTask(msg: string): boolean {
  const l = msg.toLowerCase().trim();

  // Direct commands - always run as task
  if (/^(search|find|look up|google|get me|fetch)\b/i.test(l)) return true;
  if (/^(create|build|write|generate|make|code)\b/i.test(l)) return true;
  if (/^(run|execute|deploy|install|compile)\b/i.test(l)) return true;
  if (/^(analyze|summarize|review|compare|evaluate)\b/i.test(l)) return true;
  if (/^(download|scrape|crawl|extract|read)\b.*\b(from|url|http|file|feed)/i.test(l)) return true;
  if (/^(check|monitor|watch|track)\b/i.test(l)) return true;
  if (/^(calculate|compute|solve|convert)\b/i.test(l)) return true;
  if (/^(schedule|remind|automate)\b/i.test(l)) return true;
  if (/^(list|show)\b.*\b(files|dir|folder)/i.test(l)) return true;
  if (/^(git|npm|pip)\b/i.test(l)) return true;

  // Topic requests that need real data
  if (/\b(weather|forecast|temperature)\b.*\b(in|for|at)\b/i.test(l)) return true;
  if (/\b(news|headlines|latest|current)\b.*\b(about|on|for|in)\b/i.test(l)) return true;
  if (/\b(price|stock|crypto|bitcoin)\b/i.test(l)) return true;
  if (/\bwhat time\b.*\b(in|is it)\b/i.test(l)) return true;

  // "Do something" patterns
  if (/^(do|please|can you|could you|i need you to|i want you to)\b/i.test(l)) return true;

  // If it mentions a URL, probably needs browsing
  if (/https?:\/\/\S+/i.test(l)) return true;

  return false;
}

// Standalone
if (require.main === module || process.argv.includes('--moltbot')) {
  const app = createMoltbotServer();
  const port = parseInt(process.env.PORT || '5000', 10);
  app.listen(port, '0.0.0.0', () => {
    console.log(`\n  Moltbot running on http://localhost:${port}`);
    console.log(`  ${listTools().length} tools | ${agent.providerName}\n`);
  });
}
