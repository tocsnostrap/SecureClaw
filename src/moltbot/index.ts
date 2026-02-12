/**
 * MOLTBOT - Autonomous AI Agent
 * 
 * A real autonomous agent that plans, executes, observes, adapts, and learns.
 * Provider-agnostic: works with OpenAI, Anthropic, xAI, Ollama, or any LLM.
 */

export { MoltbotAgent } from './agent';
export { createProviderFromEnv, createOpenAIProvider, createAnthropicProvider, createOllamaProvider } from './providers';
export { registerTool, getTool, listTools, executeTool } from './tools';
export { getDb, saveTask, getTask, getUserTasks, saveMemory, searchMemories, getMemoryStats } from './db';
export { createMoltbotServer } from './server';
export type { LLMProvider, LLMMessage, LLMResponse, Task, TaskStep, ToolDef, ToolResult, MoltbotConfig } from './types';
