/**
 * MOLTBOT - Tool Registry
 * 
 * Real tools that do real things. Browser automation, web search,
 * code execution, file operations, HTTP requests.
 */

import type { ToolDef, ToolResult } from './types';

const registry: Map<string, ToolDef> = new Map();

// ── Tool Registration ────────────────────────────────────────────────

export function registerTool(tool: ToolDef): void {
  registry.set(tool.name, tool);
}

export function getTool(name: string): ToolDef | undefined {
  return registry.get(name);
}

export function listTools(): ToolDef[] {
  return Array.from(registry.values());
}

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
  if (!tool) {
    return { success: false, data: null, error: `Unknown tool: ${name}` };
  }
  try {
    return await tool.execute(args);
  } catch (err: any) {
    return { success: false, data: null, error: err.message };
  }
}

// ── Built-in Tools ───────────────────────────────────────────────────

registerTool({
  name: 'web_search',
  description: 'Search Google and return real results. Use for finding current information.',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
  },
  async execute({ query }) {
    // Use the existing Moltbot browser skill
    const { webSearch } = await import('../skills/browser_skill');
    const result = await webSearch(query, {});
    if (result.success) {
      return { success: true, data: result.data };
    }
    // Fallback: use a lightweight scrape of Google
    return { success: false, data: null, error: result.error || result.message };
  },
});

registerTool({
  name: 'browse_url',
  description: 'Visit a URL and extract its text content. Use for reading web pages.',
  parameters: {
    url: { type: 'string', description: 'URL to visit', required: true },
    selector: { type: 'string', description: 'CSS selector to extract specific content' },
  },
  async execute({ url, selector }) {
    const { scrapeUrl } = await import('../skills/browser_skill');
    const result = await scrapeUrl(url, { selector });
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, data: null, error: result.error || result.message };
  },
});

registerTool({
  name: 'run_javascript',
  description: 'Execute JavaScript code in a sandboxed environment and return the result.',
  parameters: {
    code: { type: 'string', description: 'JavaScript code to execute', required: true },
  },
  async execute({ code }) {
    const vm = await import('vm');
    const logs: string[] = [];
    const sandbox = {
      console: { log: (...a: any[]) => logs.push(a.map(String).join(' ')), error: (...a: any[]) => logs.push('ERROR: ' + a.map(String).join(' ')) },
      Math, Date, JSON, Array, Object, String, Number, parseInt, parseFloat,
      setTimeout: undefined, setInterval: undefined,
      result: undefined as any,
    };
    try {
      const script = new vm.Script(`(function(){ ${code} \n; return typeof result !== 'undefined' ? result : undefined; })()`, { filename: 'moltbot_exec.js' });
      const ctx = vm.createContext(sandbox);
      const output = script.runInContext(ctx, { timeout: 5000 });
      return { success: true, data: { output, logs } };
    } catch (err: any) {
      return { success: false, data: { logs }, error: err.message };
    }
  },
});

registerTool({
  name: 'http_request',
  description: 'Make an HTTP request to any API endpoint. Use for calling external APIs.',
  parameters: {
    url: { type: 'string', description: 'URL to request', required: true },
    method: { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE)' },
    headers: { type: 'object', description: 'Request headers' },
    body: { type: 'string', description: 'Request body (for POST/PUT)' },
  },
  async execute({ url, method = 'GET', headers = {}, body }) {
    try {
      const opts: RequestInit = {
        method,
        headers: { 'User-Agent': 'Moltbot/1.0', ...headers },
        signal: AbortSignal.timeout(30_000),
      };
      if (body && (method === 'POST' || method === 'PUT')) {
        opts.body = body;
        if (!headers['Content-Type']) {
          (opts.headers as any)['Content-Type'] = 'application/json';
        }
      }
      const res = await fetch(url, opts);
      const text = await res.text();
      let data: any = text;
      try { data = JSON.parse(text); } catch { /* keep as text */ }
      return { success: res.ok, data: { status: res.status, body: data } };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: 'read_file',
  description: 'Read a file from the local filesystem.',
  parameters: {
    path: { type: 'string', description: 'File path to read', required: true },
  },
  async execute({ path: filePath }) {
    const fs = await import('fs/promises');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, data: content };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: 'write_file',
  description: 'Write content to a file on the local filesystem.',
  parameters: {
    path: { type: 'string', description: 'File path to write', required: true },
    content: { type: 'string', description: 'Content to write', required: true },
  },
  async execute({ path: filePath, content }) {
    const fs = await import('fs/promises');
    const pathMod = await import('path');
    try {
      await fs.mkdir(pathMod.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, data: { path: filePath, bytes: content.length } };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: 'run_shell',
  description: 'Run a shell command and return stdout/stderr. Use for system tasks, git, npm, etc.',
  parameters: {
    command: { type: 'string', description: 'Shell command to run', required: true },
    cwd: { type: 'string', description: 'Working directory' },
  },
  async execute({ command, cwd }) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd || process.cwd(),
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      });
      return { success: true, data: { stdout: stdout.trim(), stderr: stderr.trim() } };
    } catch (err: any) {
      return { success: false, data: { stdout: err.stdout?.trim(), stderr: err.stderr?.trim() }, error: err.message };
    }
  },
});

registerTool({
  name: 'get_weather',
  description: 'Get current weather for a location.',
  parameters: {
    location: { type: 'string', description: 'City or location name', required: true },
  },
  async execute({ location }) {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, {
        headers: { 'User-Agent': 'Moltbot/1.0' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as any;
      const c = data.current_condition?.[0];
      return {
        success: true,
        data: {
          location, temp_c: c?.temp_C, temp_f: c?.temp_F, feels_like_c: c?.FeelsLikeC,
          conditions: c?.weatherDesc?.[0]?.value, humidity: c?.humidity, wind_kmh: c?.windspeedKmph,
        },
      };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: 'get_time',
  description: 'Get the current date and time.',
  parameters: {
    timezone: { type: 'string', description: 'Timezone (e.g. America/New_York)' },
  },
  async execute({ timezone }) {
    const now = new Date();
    return {
      success: true,
      data: {
        iso: now.toISOString(),
        unix: now.getTime(),
        formatted: now.toLocaleString('en-US', { timeZone: timezone || 'UTC' }),
        timezone: timezone || 'UTC',
      },
    };
  },
});

registerTool({
  name: 'calculate',
  description: 'Evaluate a math expression safely.',
  parameters: {
    expression: { type: 'string', description: 'Math expression (e.g. "2*(3+4)", "sqrt(16)")', required: true },
  },
  async execute({ expression }) {
    try {
      const mathjs = await import('mathjs');
      const result = mathjs.evaluate(expression);
      return { success: true, data: { expression, result: String(result) } };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: 'read_rss',
  description: 'Read and parse an RSS/Atom feed.',
  parameters: {
    url: { type: 'string', description: 'RSS feed URL', required: true },
    limit: { type: 'number', description: 'Max items to return (default 5)' },
  },
  async execute({ url, limit = 5 }) {
    try {
      const RssParser = (await import('rss-parser')).default;
      const parser = new RssParser({ timeout: 10_000 });
      const feed = await parser.parseURL(url);
      const items = (feed.items || []).slice(0, limit).map(i => ({
        title: i.title, link: i.link, date: i.pubDate || i.isoDate,
        summary: (i.contentSnippet || '').slice(0, 200),
      }));
      return { success: true, data: { title: feed.title, items } };
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },
});

registerTool({
  name: 'store_memory',
  description: 'Save information to persistent memory for later recall.',
  parameters: {
    content: { type: 'string', description: 'What to remember', required: true },
    type: { type: 'string', description: 'Memory type: fact, preference, learning' },
  },
  async execute({ content, type = 'fact' }) {
    const { saveMemory } = await import('./db');
    const id = saveMemory('system', type, content);
    return { success: true, data: { id, stored: content } };
  },
});

registerTool({
  name: 'recall_memory',
  description: 'Search persistent memory for previously stored information.',
  parameters: {
    query: { type: 'string', description: 'What to search for', required: true },
  },
  async execute({ query }) {
    const { searchMemories } = await import('./db');
    const results = searchMemories('system', query, { limit: 5 });
    return { success: true, data: results.map((r: any) => ({ content: r.content, type: r.type, score: r.score })) };
  },
});
