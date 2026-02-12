/**
 * MOLTBOT - Tool Registry
 * 
 * Real tools that do real things. Browser, search, code,
 * files, HTTP, shell, weather, RSS, math, memory, and more.
 */

import type { ToolDef, ToolResult } from './types';

const registry: Map<string, ToolDef> = new Map();

export function registerTool(tool: ToolDef): void { registry.set(tool.name, tool); }
export function getTool(name: string): ToolDef | undefined { return registry.get(name); }
export function listTools(): ToolDef[] { return Array.from(registry.values()); }

export function toolDescriptions(): string {
  return listTools().map(t => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `    ${k} (${v.type}${v.required ? ', required' : ''}): ${v.description}`)
      .join('\n');
    return `- ${t.name}: ${t.description}\n  Parameters:\n${params}`;
  }).join('\n\n');
}

export async function executeTool(name: string, args: Record<string, any>): Promise<ToolResult> {
  const tool = registry.get(name);
  if (!tool) return { success: false, data: null, error: `Unknown tool: ${name}` };
  try {
    // R8: Timeout wrapper
    const result = await Promise.race([
      tool.execute(args),
      new Promise<ToolResult>((_, reject) => setTimeout(() => reject(new Error('Tool timed out (30s)')), 30_000)),
    ]);
    return result;
  } catch (err: any) {
    return { success: false, data: null, error: err.message };
  }
}

// ── Built-in Tools ───────────────────────────────────────────────────

registerTool({
  name: 'web_search',
  description: 'Search Google for current information. Returns top results with titles, snippets, and URLs.',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
  },
  async execute({ query }) {
    try {
      const { webSearch } = await import('../skills/browser_skill');
      const result = await webSearch(query, {});
      if (result.success && result.data) return { success: true, data: result.data };
      // R3: Fallback to HTTP scrape if Puppeteer fails
      return await httpSearch(query);
    } catch (err: any) {
      return await httpSearch(query);
    }
  },
});

// R3: HTTP-based search fallback (no Puppeteer needed)
async function httpSearch(query: string): Promise<ToolResult> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Moltbot/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();
    // Extract result snippets from DuckDuckGo HTML
    const results: any[] = [];
    const matches = html.matchAll(/<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g);
    for (const m of matches) {
      if (results.length >= 5) break;
      results.push({ url: m[1], title: m[2].replace(/<[^>]+>/g, '').trim() });
    }
    const snippetMatches = html.matchAll(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g);
    let i = 0;
    for (const m of snippetMatches) {
      if (i < results.length) results[i].snippet = m[1].replace(/<[^>]+>/g, '').trim();
      i++;
    }
    return { success: results.length > 0, data: results.length > 0 ? results : null, error: results.length === 0 ? 'No results' : undefined };
  } catch (err: any) {
    return { success: false, data: null, error: `Search failed: ${err.message}` };
  }
}

registerTool({
  name: 'browse_url',
  description: 'Visit a URL and extract its text content.',
  parameters: {
    url: { type: 'string', description: 'URL to visit', required: true },
    selector: { type: 'string', description: 'CSS selector for specific content' },
  },
  async execute({ url, selector }) {
    try {
      const { scrapeUrl } = await import('../skills/browser_skill');
      const result = await scrapeUrl(url, { selector });
      if (result.success) return { success: true, data: result.data };
    } catch {}
    // R3: HTTP fallback
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Moltbot/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      const html = await res.text();
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
      return { success: true, data: { url, title: html.match(/<title>(.*?)<\/title>/i)?.[1] || url, content: text } };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: 'run_javascript',
  description: 'Execute JavaScript code in a sandbox. Set "result" variable to return data.',
  parameters: {
    code: { type: 'string', description: 'JavaScript code to execute', required: true },
  },
  async execute({ code }) {
    const vm = await import('vm');
    const logs: string[] = [];
    const sandbox = {
      console: {
        log: (...a: any[]) => logs.push(a.map(String).join(' ')),
        error: (...a: any[]) => logs.push('ERR: ' + a.map(String).join(' ')),
      },
      Math, Date, JSON, Array, Object, String, Number, parseInt, parseFloat, RegExp,
      Buffer, encodeURIComponent, decodeURIComponent, atob, btoa,
      result: undefined as any,
    };
    try {
      const script = new vm.Script(`(function(){ ${code} \n; return typeof result !== 'undefined' ? result : undefined; })()`, { filename: 'moltbot.js' });
      const ctx = vm.createContext(sandbox);
      const output = script.runInContext(ctx, { timeout: 10_000 });
      return { success: true, data: { output, logs } };
    } catch (err: any) {
      return { success: false, data: { logs }, error: err.message };
    }
  },
});

registerTool({
  name: 'http_request',
  description: 'Make HTTP requests to any API. Returns status code and response body.',
  parameters: {
    url: { type: 'string', description: 'URL to request', required: true },
    method: { type: 'string', description: 'GET, POST, PUT, DELETE' },
    headers: { type: 'object', description: 'Request headers' },
    body: { type: 'string', description: 'Request body (JSON string)' },
  },
  async execute({ url, method = 'GET', headers = {}, body }) {
    try {
      const opts: RequestInit = {
        method,
        headers: { 'User-Agent': 'Moltbot/1.0', ...headers },
        signal: AbortSignal.timeout(30_000),
      };
      if (body && method !== 'GET') {
        opts.body = body;
        if (!(headers as any)['Content-Type']) (opts.headers as any)['Content-Type'] = 'application/json';
      }
      const res = await fetch(url, opts);
      const text = await res.text();
      let data: any = text;
      try { data = JSON.parse(text); } catch {}
      return { success: res.ok, data: { status: res.status, body: typeof data === 'string' ? data.slice(0, 3000) : data } };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: 'read_file',
  description: 'Read a file from disk.',
  parameters: { path: { type: 'string', description: 'File path', required: true } },
  async execute({ path: filePath }) {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, data: { path: filePath, content: content.slice(0, 10_000), size: content.length } };
    } catch (err: any) { return { success: false, data: null, error: err.message }; }
  },
});

registerTool({
  name: 'write_file',
  description: 'Write content to a file.',
  parameters: {
    path: { type: 'string', description: 'File path', required: true },
    content: { type: 'string', description: 'Content to write', required: true },
  },
  async execute({ path: filePath, content }) {
    try {
      const fs = await import('fs/promises');
      const p = await import('path');
      await fs.mkdir(p.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, data: { path: filePath, bytes: content.length } };
    } catch (err: any) { return { success: false, data: null, error: err.message }; }
  },
});

// R3: List directory
registerTool({
  name: 'list_files',
  description: 'List files and directories at a path.',
  parameters: {
    path: { type: 'string', description: 'Directory path', required: true },
    recursive: { type: 'boolean', description: 'List recursively (default false)' },
  },
  async execute({ path: dirPath, recursive = false }) {
    try {
      const fs = await import('fs/promises');
      const p = await import('path');
      if (recursive) {
        const files: string[] = [];
        async function walk(dir: string, depth = 0) {
          if (depth > 3) return;
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const e of entries) {
            if (e.name.startsWith('.') || e.name === 'node_modules') continue;
            const full = p.join(dir, e.name);
            files.push(full);
            if (e.isDirectory()) await walk(full, depth + 1);
          }
        }
        await walk(dirPath);
        return { success: true, data: files.slice(0, 100) };
      }
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return { success: true, data: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) };
    } catch (err: any) { return { success: false, data: null, error: err.message }; }
  },
});

registerTool({
  name: 'run_shell',
  description: 'Run a shell command. Returns stdout and stderr.',
  parameters: {
    command: { type: 'string', description: 'Shell command', required: true },
    cwd: { type: 'string', description: 'Working directory' },
  },
  async execute({ command, cwd }) {
    // R8: Block dangerous commands
    const blocked = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'fork bomb'];
    if (blocked.some(b => command.includes(b))) {
      return { success: false, data: null, error: 'Command blocked for safety' };
    }
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    try {
      const { stdout, stderr } = await promisify(exec)(command, {
        cwd: cwd || process.cwd(), timeout: 30_000, maxBuffer: 1024 * 1024,
      });
      return { success: true, data: { stdout: stdout.trim().slice(0, 5000), stderr: stderr.trim().slice(0, 1000) } };
    } catch (err: any) {
      return { success: false, data: { stdout: err.stdout?.trim()?.slice(0, 2000), stderr: err.stderr?.trim()?.slice(0, 1000) }, error: err.message };
    }
  },
});

registerTool({
  name: 'get_weather',
  description: 'Get current weather for a location.',
  parameters: { location: { type: 'string', description: 'City name', required: true } },
  async execute({ location }) {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, {
        headers: { 'User-Agent': 'Moltbot/1.0' }, signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as any;
      const c = data.current_condition?.[0];
      const area = data.nearest_area?.[0];
      return {
        success: true,
        data: {
          location: area?.areaName?.[0]?.value || location,
          temp_c: c?.temp_C, temp_f: c?.temp_F, feels_like_c: c?.FeelsLikeC,
          conditions: c?.weatherDesc?.[0]?.value, humidity: `${c?.humidity}%`,
          wind: `${c?.windspeedKmph} km/h ${c?.winddir16Point}`,
          uv: c?.uvIndex,
        },
      };
    } catch (err: any) { return { success: false, data: null, error: err.message }; }
  },
});

registerTool({
  name: 'get_time',
  description: 'Get current date and time.',
  parameters: { timezone: { type: 'string', description: 'Timezone (e.g. America/New_York)' } },
  async execute({ timezone }) {
    const now = new Date();
    return { success: true, data: {
      iso: now.toISOString(), unix: now.getTime(),
      formatted: now.toLocaleString('en-US', { timeZone: timezone || 'UTC', dateStyle: 'full', timeStyle: 'long' }),
    }};
  },
});

registerTool({
  name: 'calculate',
  description: 'Evaluate math expressions. Supports sqrt, sin, cos, log, pi, e, etc.',
  parameters: { expression: { type: 'string', description: 'Math expression', required: true } },
  async execute({ expression }) {
    try {
      const mathjs = await import('mathjs');
      const result = mathjs.evaluate(expression);
      return { success: true, data: { expression, result: String(result) } };
    } catch (err: any) { return { success: false, data: null, error: err.message }; }
  },
});

registerTool({
  name: 'read_rss',
  description: 'Read and parse an RSS/Atom feed.',
  parameters: {
    url: { type: 'string', description: 'RSS feed URL', required: true },
    limit: { type: 'number', description: 'Max items (default 5)' },
  },
  async execute({ url, limit = 5 }) {
    try {
      const RssParser = (await import('rss-parser')).default;
      const feed = await new RssParser({ timeout: 10_000 }).parseURL(url);
      const items = (feed.items || []).slice(0, limit).map(i => ({
        title: i.title, link: i.link, date: i.pubDate || i.isoDate,
        summary: (i.contentSnippet || '').slice(0, 200),
      }));
      return { success: true, data: { title: feed.title, items } };
    } catch (err: any) { return { success: false, data: null, error: err.message }; }
  },
});

// R3: Git operations
registerTool({
  name: 'git',
  description: 'Run git commands (status, log, diff, add, commit, push, pull, etc.).',
  parameters: {
    command: { type: 'string', description: 'Git subcommand and args (e.g. "status", "log --oneline -5")', required: true },
  },
  async execute({ command }) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    try {
      const { stdout, stderr } = await promisify(exec)(`git ${command}`, {
        cwd: process.cwd(), timeout: 15_000, maxBuffer: 512 * 1024,
      });
      return { success: true, data: { output: stdout.trim().slice(0, 3000) } };
    } catch (err: any) {
      return { success: false, data: null, error: (err.stderr || err.message).slice(0, 500) };
    }
  },
});

registerTool({
  name: 'store_memory',
  description: 'Save information to persistent memory for later recall.',
  parameters: {
    content: { type: 'string', description: 'What to remember', required: true },
    type: { type: 'string', description: 'Type: fact, preference, learning' },
  },
  async execute({ content, type = 'fact' }) {
    const { saveMemory } = await import('./db');
    const id = saveMemory('system', type, content);
    return { success: true, data: { id, stored: content } };
  },
});

registerTool({
  name: 'recall_memory',
  description: 'Search persistent memory for stored information.',
  parameters: { query: { type: 'string', description: 'Search query', required: true } },
  async execute({ query }) {
    const { searchMemories } = await import('./db');
    const results = searchMemories('system', query, { limit: 5 });
    return { success: true, data: results.map((r: any) => ({ content: r.content, type: r.type })) };
  },
});

// R7: Schedule a recurring task (stores in memory for now)
registerTool({
  name: 'schedule_task',
  description: 'Schedule a task to run later or repeatedly. Stores the schedule in memory.',
  parameters: {
    goal: { type: 'string', description: 'What to do', required: true },
    when: { type: 'string', description: 'When: "in 5 minutes", "every hour", "daily at 9am"', required: true },
  },
  async execute({ goal, when }) {
    const { saveMemory } = await import('./db');
    const id = saveMemory('system', 'schedule', `SCHEDULED: ${goal} | WHEN: ${when}`, { goal, when }, 0.9);
    return { success: true, data: { id, goal, when, note: 'Scheduled task saved to memory' } };
  },
});

// R3: Generate text/content using the LLM
registerTool({
  name: 'think',
  description: 'Use the AI to reason about something, generate text, write content, or answer a question. Use when you need to think or create.',
  parameters: {
    prompt: { type: 'string', description: 'What to think about or generate', required: true },
    system: { type: 'string', description: 'Optional system instruction' },
  },
  async execute({ prompt, system }) {
    // This gets special handling - the agent will call its own LLM
    return { success: true, data: { type: 'think', prompt, system, note: 'Agent will process this with LLM' } };
  },
});
