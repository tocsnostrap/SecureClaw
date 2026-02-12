/**
 * MOLTBOT - Autonomous Agent
 * 
 * The core loop: PLAN → EXECUTE → OBSERVE → ADAPT → REPEAT
 * 
 * Give it a goal. It figures out how to accomplish it, executes
 * real tools, observes results, adapts when things go wrong,
 * and learns from every task for next time.
 */

import type { LLMProvider, LLMMessage, Task, TaskStep, Observation, MoltbotConfig } from './types';
import { toolDescriptions, executeTool, listTools } from './tools';
import { saveTask, saveMemory, searchMemories, getRecentMemories } from './db';

let taskCounter = 0;

// Event emitter for real-time step updates
type StepListener = (task: Task, step: TaskStep, event: string) => void;
export const stepListeners: StepListener[] = [];
export function onStepUpdate(fn: StepListener) { stepListeners.push(fn); }
function emitStep(task: Task, step: TaskStep, event: string) {
  stepListeners.forEach(fn => { try { fn(task, step, event); } catch {} });
}

export class MoltbotAgent {
  private llm: LLMProvider;
  private config: MoltbotConfig;

  constructor(llm: LLMProvider, config: Partial<MoltbotConfig> = {}) {
    this.llm = llm;
    this.config = {
      maxSteps: 15,
      maxRetries: 2,
      maxReplans: 3,
      taskTimeoutMs: 5 * 60_000,
      verbose: true,
      ...config,
    };
  }

  // R5: Expose provider name
  get providerName(): string { return this.llm.name; }

  /**
   * RUN A TASK AUTONOMOUSLY
   */
  async run(goal: string, options: { userId?: string; context?: string } = {}): Promise<Task> {
    const userId = options.userId || 'default';

    // R8: Input validation
    if (!goal || goal.trim().length < 2) throw new Error('Goal is too short');
    if (goal.length > 5000) throw new Error('Goal is too long (max 5000 chars)');

    const task: Task = {
      id: `task_${Date.now()}_${++taskCounter}`,
      goal: goal.trim(),
      context: options.context || '',
      userId,
      status: 'pending',
      plan: [],
      observations: [],
      currentStep: 0,
      replans: 0,
      result: null,
      error: null,
      tokensUsed: 0,
      startedAt: Date.now(),
      completedAt: null,
    };

    this.log(`\n========================================`);
    this.log(`TASK: ${goal}`);
    this.log(`========================================`);

    const deadline = Date.now() + this.config.taskTimeoutMs;

    try {
      // ── PHASE 1: PLAN ──────────────────────────────────────────
      task.status = 'planning';
      saveTask(task);
      const relevantMemories = this.getRelevantContext(userId, goal);
      task.plan = await this.plan(task, relevantMemories);
      saveTask(task);

      // ── PHASE 2: EXECUTE LOOP ──────────────────────────────────
      task.status = 'executing';
      saveTask(task);

      while (task.currentStep < task.plan.length) {
        if (Date.now() > deadline) {
          task.error = `Task timed out after ${Math.round(this.config.taskTimeoutMs / 1000)}s`;
          task.status = 'failed';
          break;
        }

        const step = task.plan[task.currentStep];
        this.log(`\n── Step ${step.index + 1}/${task.plan.length}: ${step.action}`);
        step.status = 'running';
        step.startedAt = Date.now();
        emitStep(task, step, 'start');

        if (step.tool) {
          // Handle "think" tool specially - use LLM directly
          if (step.tool === 'think') {
            const resolvedArgs = this.resolveArgs(step.args, task);
            const prompt = resolvedArgs.prompt || step.action;
            const systemMsg = resolvedArgs.system || 'You are Moltbot thinking through a problem step by step.';

            this.log(`   Thinking: ${prompt.slice(0, 100)}`);
            try {
              const thought = await this.chat([
                { role: 'system', content: systemMsg },
                { role: 'user', content: prompt },
              ]);
              task.tokensUsed += (thought.inputTokens || 0) + (thought.outputTokens || 0);
              step.status = 'success';
              step.output = { thought: thought.content };
              step.completedAt = Date.now();
              this.observe(task, step.index, 'result', `Thought: ${thought.content.slice(0, 300)}`);
              this.log(`   Thought: ${thought.content.slice(0, 150)}`);
              emitStep(task, step, 'success');
              task.currentStep++;
              saveTask(task);
              continue;
            } catch (err: any) {
              step.error = err.message;
              step.status = 'failed';
              step.completedAt = Date.now();
              this.observe(task, step.index, 'error', `Think failed: ${err.message}`);
              task.currentStep++;
              continue;
            }
          }

          // Validate tool exists before executing
          const toolExists = listTools().some(t => t.name === step.tool);
          if (!toolExists) {
            step.error = `Unknown tool "${step.tool}"`;
            step.status = 'failed';
            step.completedAt = Date.now();
            this.observe(task, step.index, 'error', step.error);
            this.log(`   SKIP: ${step.error}`);
            task.currentStep++;
            continue;
          }

          // Inject previous step results into args
          const resolvedArgs = this.resolveArgs(step.args, task);

          this.log(`   Tool: ${step.tool}(${JSON.stringify(resolvedArgs).slice(0, 100)})`);
          const result = await executeTool(step.tool, resolvedArgs);
          step.completedAt = Date.now();

          if (result.success) {
            step.status = 'success';
            step.output = result.data;
            const obs = this.observe(task, step.index, 'result',
              `${step.tool} succeeded: ${this.summarizeOutput(result.data)}`);
            this.log(`   OK (${step.completedAt - (step.startedAt || step.completedAt)}ms)`);
            emitStep(task, step, 'success');
          } else {
            step.error = result.error || 'Unknown error';
            step.retries++;

            if (step.retries <= this.config.maxRetries) {
              this.log(`   RETRY ${step.retries}/${this.config.maxRetries}: ${step.error}`);
              this.observe(task, step.index, 'error', `Retry ${step.retries}: ${step.error}`);
              emitStep(task, step, 'retry');
              // R1: Exponential backoff between retries
              await this.sleep(1000 * Math.pow(2, step.retries - 1));
              continue;
            }

            step.status = 'failed';
            this.observe(task, step.index, 'error', `FAILED: ${step.error}`);
            this.log(`   FAILED: ${step.error}`);
            emitStep(task, step, 'failed');

            // ── PHASE 3: ADAPT ───────────────────────────────────
            if (task.replans < this.config.maxReplans) {
              this.log(`   Adapting... (replan ${task.replans + 1}/${this.config.maxReplans})`);
              task.status = 'replanning';
              task.replans++;

              try {
                const newPlan = await this.replan(task);
                if (newPlan.length > 0) {
                  task.plan = [...task.plan.slice(0, task.currentStep + 1), ...newPlan];
                  this.log(`   New plan: ${newPlan.length} steps`);
                  task.status = 'executing';
                }
              } catch (replanErr: any) {
                this.log(`   Replan failed: ${replanErr.message}`);
              }
            }
          }
        } else {
          // Reasoning-only step
          step.status = 'success';
          step.completedAt = Date.now();
          this.observe(task, step.index, 'info', `Reasoning: ${step.action}`);
          emitStep(task, step, 'success');
        }

        task.currentStep++;
        saveTask(task);
      }

      // ── PHASE 4: SYNTHESIZE ────────────────────────────────────
      if (task.status !== 'failed') {
        task.result = await this.synthesize(task);
        task.status = 'completed';
        this.log(`\nRESULT: ${task.result?.slice(0, 300)}`);
      }

    } catch (err: any) {
      task.error = err.message;
      task.status = 'failed';
      this.log(`\nTASK FAILED: ${err.message}`);
    }

    task.completedAt = Date.now();
    saveTask(task);

    // ── PHASE 5: LEARN ───────────────────────────────────────────
    this.learnFromTask(task);

    const duration = ((task.completedAt - task.startedAt) / 1000).toFixed(1);
    this.log(`\nTask ${task.status} in ${duration}s | ${task.tokensUsed} tokens | ${task.plan.length} steps`);
    this.log(`========================================\n`);

    return task;
  }

  /**
   * PLAN: Break goal into executable steps
   */
  private async plan(task: Task, context: string): Promise<TaskStep[]> {
    const tools = listTools();
    const toolList = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');

    const prompt = `You are Moltbot, an autonomous AI agent. Break this goal into concrete steps.

GOAL: ${task.goal}
${task.context ? `CONTEXT: ${task.context}` : ''}
${context ? `\nMEMORY:\n${context}` : ''}

TOOLS:
${toolList}

RULES:
- Each step uses one tool OR is a reasoning step (tool: null)
- Use real tool names and real argument values
- 2-8 steps max. Simple goals = fewer steps.
- You can reference previous step results with {{step_N}} in args (N = step number)
- Final step should synthesize/verify the result

Return ONLY a JSON array:
[{"action": "description", "tool": "name", "args": {"key": "value"}}]`;

    const response = await this.chat([
      { role: 'system', content: 'You are a task planner. Return ONLY a valid JSON array. No markdown fences. No explanation.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.2 });

    task.tokensUsed += (response.inputTokens || 0) + (response.outputTokens || 0);

    // R1: Robust JSON parsing with repair
    const steps = this.parseSteps(response.content, task.id);
    if (steps.length === 0) {
      // R1: Retry planning once with explicit instruction
      this.log('   Plan parse failed, retrying...');
      const retry = await this.chat([
        { role: 'system', content: 'Return ONLY a JSON array like: [{"action":"x","tool":"web_search","args":{"query":"y"}}]' },
        { role: 'user', content: `Plan steps for: ${task.goal}` },
      ], { temperature: 0.1 });
      task.tokensUsed += (retry.inputTokens || 0) + (retry.outputTokens || 0);

      const retrySteps = this.parseSteps(retry.content, task.id);
      if (retrySteps.length === 0) throw new Error('Could not create a valid plan');
      return retrySteps;
    }

    this.log(`Plan: ${steps.length} steps`);
    steps.forEach((s, i) => this.log(`  ${i + 1}. [${s.tool || 'think'}] ${s.action}`));
    return steps;
  }

  /**
   * REPLAN: Adjust after failure
   */
  private async replan(task: Task): Promise<TaskStep[]> {
    const completed = task.plan
      .filter(s => s.status === 'success')
      .map(s => `[OK] ${s.action}: ${this.summarizeOutput(s.output)}`).join('\n');

    const failed = task.plan[task.currentStep];

    const prompt = `Your plan failed at a step. Create NEW steps for the remaining work.

GOAL: ${task.goal}
DONE: ${completed || '(none)'}
FAILED: ${failed?.action} - ERROR: ${failed?.error}

Try a DIFFERENT approach. Return ONLY a JSON array of new steps.`;

    const response = await this.chat([
      { role: 'system', content: 'Replan after failure. Return ONLY valid JSON array.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.4 });

    task.tokensUsed += (response.inputTokens || 0) + (response.outputTokens || 0);
    return this.parseSteps(response.content, task.id, task.plan.length);
  }

  /**
   * SYNTHESIZE: Final result from all step outputs
   */
  private async synthesize(task: Task): Promise<string> {
    const results = task.plan
      .filter(s => s.status === 'success' && s.output)
      .map(s => `[${s.tool || 'reasoning'}] ${s.action}: ${this.summarizeOutput(s.output)}`)
      .join('\n\n');

    if (!results) return 'Task completed but no data was captured.';

    const response = await this.chat([
      { role: 'system', content: 'You are Moltbot. Synthesize these results into a clear, useful answer. Be direct and thorough. Format nicely with sections if needed.' },
      { role: 'user', content: `GOAL: ${task.goal}\n\nDATA GATHERED:\n${results}\n\nProvide a comprehensive answer.` },
    ], { maxTokens: 2000 });

    task.tokensUsed += (response.inputTokens || 0) + (response.outputTokens || 0);
    return response.content;
  }

  /**
   * LEARN from task
   */
  private learnFromTask(task: Task): void {
    try {
      const userId = task.userId;
      const successTools = task.plan.filter(s => s.tool && s.status === 'success').map(s => s.tool);
      const failedTools = task.plan.filter(s => s.tool && s.status === 'failed');
      const category = this.categorize(task.goal);

      if (task.status === 'completed' && successTools.length > 0) {
        saveMemory(userId, 'learning',
          `"${category}" tasks work with: ${successTools.join(' -> ')}`,
          { goal: task.goal, tools: successTools }, 0.8);
      }

      if (task.status === 'failed') {
        const errors = failedTools.map(s => `${s.tool}: ${s.error}`).join('; ');
        saveMemory(userId, 'learning',
          `"${category}" tasks fail when: ${errors || task.error}`,
          { goal: task.goal }, 0.6);
      }

      // R4: Store richer task outcome
      saveMemory(userId, 'task',
        `${task.status}: ${task.goal} | ${task.plan.length} steps, ${successTools.length} succeeded | ${(task.result || task.error || '').slice(0, 300)}`,
        { taskId: task.id, status: task.status, duration: (task.completedAt || Date.now()) - task.startedAt }, 0.7);
    } catch { /* don't let learning errors break tasks */ }
  }

  /**
   * CHAT: Send messages to the LLM
   */
  async chat(messages: LLMMessage[], options: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}) {
    return this.llm.chat(messages, options);
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  // R6: Replace {{step_N}} placeholders with actual step outputs
  private resolveArgs(args: Record<string, any>, task: Task): Record<string, any> {
    const resolved: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        resolved[key] = value.replace(/\{\{step_(\d+)\}\}/g, (_match, num) => {
          const stepIdx = parseInt(num) - 1;
          const step = task.plan[stepIdx];
          if (step?.output) return JSON.stringify(step.output).slice(0, 500);
          return '(no data)';
        });
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  // R5: Smarter output summarization
  private summarizeOutput(data: any): string {
    if (!data) return '(empty)';
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    if (str.length <= 300) return str;
    return str.slice(0, 297) + '...';
  }

  private categorize(goal: string): string {
    const l = goal.toLowerCase();
    if (l.match(/search|find|look.?up|google/)) return 'search';
    if (l.match(/create|build|write|generate|make/)) return 'creation';
    if (l.match(/monitor|watch|track/)) return 'monitoring';
    if (l.match(/analy[sz]e|summarize|review|compare/)) return 'analysis';
    if (l.match(/code|program|script|function/)) return 'coding';
    if (l.match(/weather|forecast|temperature/)) return 'weather';
    if (l.match(/calculate|compute|math|solve/)) return 'math';
    if (l.match(/file|read|write|save|download/)) return 'file_ops';
    return 'general';
  }

  private getRelevantContext(userId: string, goal: string): string {
    try {
      const learnings = searchMemories(userId, goal, { type: 'learning', limit: 3 });
      const recent = getRecentMemories(userId, 'task', 3);
      const parts: string[] = [];
      if (learnings.length > 0) parts.push('Learnings: ' + learnings.map((m: any) => m.content).join('; '));
      if (recent.length > 0) parts.push('Recent: ' + recent.map((m: any) => m.content).join('; '));
      return parts.join('\n');
    } catch { return ''; }
  }

  private observe(task: Task, stepIndex: number, type: Observation['type'], content: string): Observation {
    const obs: Observation = { stepIndex, type, content: content.slice(0, 500), timestamp: Date.now() };
    task.observations.push(obs);
    return obs;
  }

  // R1: Robust JSON parsing with multiple strategies
  private parseSteps(text: string, taskId: string, startIndex: number = 0): TaskStep[] {
    let parsed: any[] | null = null;

    // Strategy 1: Direct parse
    try { parsed = JSON.parse(text.trim()); } catch {}

    // Strategy 2: Extract from markdown fences
    if (!parsed) {
      const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (m) try { parsed = JSON.parse(m[1].trim()); } catch {}
    }

    // Strategy 3: Find array in text
    if (!parsed) {
      const m = text.match(/\[[\s\S]*\]/);
      if (m) try { parsed = JSON.parse(m[0]); } catch {}
    }

    // Strategy 4: Fix common JSON errors and retry
    if (!parsed) {
      const cleaned = text
        .replace(/^[^[]*/, '')           // Remove leading non-JSON
        .replace(/[^\]]*$/, '')          // Remove trailing non-JSON
        .replace(/,\s*([}\]])/g, '$1')   // Remove trailing commas
        .replace(/'/g, '"')              // Single to double quotes
        .replace(/(\w+):/g, '"$1":');    // Unquoted keys
      try { parsed = JSON.parse(cleaned); } catch {}
    }

    if (!Array.isArray(parsed)) return [];

    return parsed.slice(0, this.config.maxSteps).map((s: any, i: number) => ({
      id: `${taskId}_s${startIndex + i}`,
      index: startIndex + i,
      action: String(s.action || s.description || s.step || `Step ${startIndex + i + 1}`).slice(0, 200),
      tool: s.tool === 'null' ? null : (s.tool || null),
      args: (typeof s.args === 'object' && s.args !== null) ? s.args : (s.toolArgs || {}),
      status: 'pending' as const,
      output: null,
      error: null,
      retries: 0,
      startedAt: null,
      completedAt: null,
    }));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(msg: string): void {
    if (this.config.verbose) console.log(`[Moltbot] ${msg}`);
  }
}
