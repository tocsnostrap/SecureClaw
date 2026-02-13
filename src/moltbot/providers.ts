/**
 * MOLTBOT - LLM Providers
 * 
 * Raw HTTP to any LLM. No vendor SDKs. Plug in whatever you want.
 * Supports: OpenAI, Anthropic, xAI/Grok, Ollama (local), any OpenAI-compatible API.
 */

import type { LLMMessage, LLMResponse, LLMProvider } from './types';

// ── OpenAI-compatible provider (works with OpenAI, xAI, Together, Groq, etc.) ──

export function createOpenAIProvider(config: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  name?: string;
}): LLMProvider {
  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = config.model || 'gpt-4o';
  const name = config.name || 'openai';

  return {
    name,
    async chat(messages, options = {}) {
      const body: any = {
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
      };
      if (options.maxTokens) body.max_tokens = options.maxTokens;
      if (options.jsonMode) body.response_format = { type: 'json_object' };

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`${name} API ${res.status}: ${errText.slice(0, 300)}`);
      }

      const data = await res.json() as any;
      const choice = data.choices?.[0];

      return {
        content: choice?.message?.content || '',
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
        model: data.model || model,
        finishReason: choice?.finish_reason,
      };
    },
  };
}

// ── Anthropic provider ──────────────────────────────────────────────

export function createAnthropicProvider(config: {
  apiKey: string;
  model?: string;
}): LLMProvider {
  const model = config.model || 'claude-sonnet-4-20250514';

  return {
    name: 'anthropic',
    async chat(messages, options = {}) {
      // Extract system message
      const systemMsg = messages.find(m => m.role === 'system');
      const chatMsgs = messages.filter(m => m.role !== 'system');

      const body: any = {
        model,
        max_tokens: options.maxTokens || 4096,
        messages: chatMsgs.map(m => ({ role: m.role, content: m.content })),
      };
      if (systemMsg) body.system = systemMsg.content;
      if (options.temperature !== undefined) body.temperature = options.temperature;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
      }

      const data = await res.json() as any;

      return {
        content: data.content?.[0]?.text || '',
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
        model: data.model || model,
        finishReason: data.stop_reason,
      };
    },
  };
}

// ── Ollama provider (local, free) ───────────────────────────────────

export function createOllamaProvider(config: {
  baseUrl?: string;
  model?: string;
}): LLMProvider {
  const baseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
  const model = config.model || 'llama3';

  return {
    name: 'ollama',
    async chat(messages, options = {}) {
      const body: any = {
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: false,
        options: {} as any,
      };
      if (options.temperature !== undefined) body.options.temperature = options.temperature;

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Ollama ${res.status}: ${errText.slice(0, 300)}`);
      }

      const data = await res.json() as any;

      return {
        content: data.message?.content || '',
        inputTokens: data.prompt_eval_count,
        outputTokens: data.eval_count,
        model: data.model || model,
      };
    },
  };
}

// ── Auto-fallback provider: tries each configured provider in order ──

function createFallbackProvider(providers: LLMProvider[]): LLMProvider {
  if (providers.length === 0) {
    throw new Error('No LLM providers configured');
  }
  if (providers.length === 1) return providers[0];

  return {
    name: providers.map(p => p.name).join('+'),
    async chat(messages, options = {}) {
      let lastError: Error | null = null;

      for (const provider of providers) {
        try {
          const result = await provider.chat(messages, options);
          if (result.content) return result;
        } catch (err: any) {
          console.warn(`[Moltbot] ${provider.name} failed: ${err.message}. Trying next provider...`);
          lastError = err;
        }
      }

      throw lastError || new Error('All LLM providers failed');
    },
  };
}

// ── Auto-detect providers from environment ──────────────────────────

export function createProviderFromEnv(): LLMProvider {
  const providers: LLMProvider[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push(createAnthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    }));
  }

  if (process.env.OPENAI_API_KEY) {
    providers.push(createOpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      name: 'openai',
    }));
  }

  if (process.env.XAI_API_KEY) {
    providers.push(createOpenAIProvider({
      apiKey: process.env.XAI_API_KEY,
      baseUrl: 'https://api.x.ai/v1',
      model: process.env.XAI_MODEL || 'grok-3-latest',
      name: 'xai',
    }));
  }

  if (process.env.OLLAMA_HOST || process.env.OLLAMA_MODEL) {
    providers.push(createOllamaProvider({
      baseUrl: process.env.OLLAMA_HOST,
      model: process.env.OLLAMA_MODEL || 'llama3',
    }));
  }

  if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) {
    providers.push(createOpenAIProvider({
      apiKey: process.env.LLM_API_KEY,
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL || 'default',
      name: 'custom',
    }));
  }

  if (providers.length === 0) {
    throw new Error(
      'No LLM provider configured. Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, XAI_API_KEY, OLLAMA_MODEL, or LLM_API_KEY + LLM_BASE_URL'
    );
  }

  console.log(`[Moltbot] Providers: ${providers.map(p => p.name).join(', ')} (auto-fallback enabled)`);
  return createFallbackProvider(providers);
}
