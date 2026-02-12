/**
 * MOLTBOT - Core Types
 */

// ── LLM Provider ─────────────────────────────────────────────────────
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  model: string;
  finishReason?: string;
}

export interface LLMProvider {
  name: string;
  chat(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }): Promise<LLMResponse>;
}

// ── Task System ──────────────────────────────────────────────────────
export type TaskStatus = 'pending' | 'planning' | 'executing' | 'replanning' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface Task {
  id: string;
  goal: string;
  context: string;
  userId: string;
  status: TaskStatus;
  plan: TaskStep[];
  observations: Observation[];
  currentStep: number;
  replans: number;
  result: string | null;
  error: string | null;
  tokensUsed: number;
  startedAt: number;
  completedAt: number | null;
}

export interface TaskStep {
  id: string;
  index: number;
  action: string;          // What to do (human readable)
  tool: string | null;     // Tool name, or null for reasoning-only
  args: Record<string, any>;
  status: StepStatus;
  output: any;
  error: string | null;
  retries: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface Observation {
  stepIndex: number;
  type: 'result' | 'error' | 'info';
  content: string;
  timestamp: number;
}

// ── Tool System ──────────────────────────────────────────────────────
export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (args: Record<string, any>) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
}

// ── Memory ───────────────────────────────────────────────────────────
export interface Memory {
  id: number;
  userId: string;
  type: 'task' | 'learning' | 'preference' | 'fact';
  content: string;
  metadata: string; // JSON
  score: number;    // relevance/confidence 0-1
  createdAt: number;
}

// ── Config ───────────────────────────────────────────────────────────
export interface MoltbotConfig {
  maxSteps: number;
  maxRetries: number;
  maxReplans: number;
  taskTimeoutMs: number;
  verbose: boolean;
}

export const DEFAULT_CONFIG: MoltbotConfig = {
  maxSteps: 15,
  maxRetries: 2,
  maxReplans: 3,
  taskTimeoutMs: 5 * 60_000,
  verbose: true,
};
