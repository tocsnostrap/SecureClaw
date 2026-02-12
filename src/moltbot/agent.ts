/**
 * MOLTBOT - Autonomous Agent
 * 
 * The core loop: PLAN → EXECUTE → OBSERVE → ADAPT → REPEAT
 * 
 * Give it a goal. It figures out how to accomplish it, executes
 * real tools, observes results, adapts when things go wrong,
 * and learns from every task for next time.
 */

import type { LLMProvider, LLMMessage, Task, TaskStep, Observation, MoltbotConfig, DEFAULT_CONFIG } from './types';
import { toolDescriptions, executeTool, listTools } from './tools';
import { saveTask, saveMemory, searchMemories, getRecentMemories } from './db';

let taskCounter = 0;

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

  /**
   * RUN A TASK AUTONOMOUSLY
   * 
   * This is the main entry point. Give it a goal, it does the rest.
   */
  async run(goal: string, options: { userId?: string; context?: string } = {}): Promise<Task> {
    const userId = options.userId || 'default';
    const task: Task = {
      id: `task_${Date.now()}_${++taskCounter}`,
      goal,
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
    this.log(`MOLTBOT TASK: ${goal}`);
    this.log(`========================================`);

    const deadline = Date.now() + this.config.taskTimeoutMs;

    try {
      // ── PHASE 1: PLAN ──────────────────────────────────────────
      task.status = 'planning';
      const relevantMemories = this.getRelevantContext(userId, goal);
      task.plan = await this.plan(task, relevantMemories);
      saveTask(task);

      // ── PHASE 2: EXECUTE LOOP ──────────────────────────────────
      task.status = 'executing';

      while (task.currentStep < task.plan.length) {
        // Timeout check
        if (Date.now() > deadline) {
          task.error = 'Task timed out';
          task.status = 'failed';
          break;
        }

        const step = task.plan[task.currentStep];
        this.log(`\n── Step ${step.index + 1}/${task.plan.length}: ${step.action}`);

        // Execute the step
        step.status = 'running';
        step.startedAt = Date.now();

        if (step.tool) {
          // Tool execution
          this.log(`   Tool: ${step.tool}(${JSON.stringify(step.args).slice(0, 100)})`);
          const result = await executeTool(step.tool, step.args);
          step.completedAt = Date.now();

          if (result.success) {
            step.status = 'success';
            step.output = result.data;
            const obs = this.observe(task, step.index, 'result',
              `${step.tool} succeeded: ${JSON.stringify(result.data).slice(0, 300)}`);
            this.log(`   OK: ${obs.content.slice(0, 150)}`);
          } else {
            step.error = result.error || 'Unknown error';
            step.retries++;

            // Retry?
            if (step.retries <= this.config.maxRetries) {
              this.log(`   RETRY ${step.retries}/${this.config.maxRetries}: ${step.error}`);
              this.observe(task, step.index, 'error', `Retry ${step.retries}: ${step.error}`);
              continue; // Don't advance, try again
            }

            step.status = 'failed';
            this.observe(task, step.index, 'error', `FAILED after ${step.retries} retries: ${step.error}`);
            this.log(`   FAILED: ${step.error}`);

            // ── PHASE 3: ADAPT (re-plan if needed) ───────────────
            if (task.replans < this.config.maxReplans) {
              this.log(`\n   Adapting... (replan ${task.replans + 1}/${this.config.maxReplans})`);
              task.status = 'replanning';
              task.replans++;

              const newPlan = await this.replan(task);
              if (newPlan.length > 0) {
                // Replace remaining steps with new plan
                task.plan = [
                  ...task.plan.slice(0, task.currentStep + 1),
                  ...newPlan,
                ];
                this.log(`   New plan: ${newPlan.length} steps`);
                task.status = 'executing';
              }
            }
          }
        } else {
          // Reasoning-only step (no tool)
          step.status = 'success';
          step.completedAt = Date.now();
          this.observe(task, step.index, 'info', `Reasoning: ${step.action}`);
          this.log(`   (reasoning step)`);
        }

        task.currentStep++;
        saveTask(task);
      }

      // ── PHASE 4: SYNTHESIZE RESULT ─────────────────────────────
      if (task.status !== 'failed') {
        task.result = await this.synthesize(task);
        task.status = 'completed';
        this.log(`\n RESULT: ${task.result?.slice(0, 200)}`);
      }

    } catch (err: any) {
      task.error = err.message;
      task.status = 'failed';
      this.log(`\n TASK FAILED: ${err.message}`);
    }

    task.completedAt = Date.now();
    saveTask(task);

    // ── PHASE 5: LEARN ───────────────────────────────────────────
    await this.learnFromTask(task);

    const duration = ((task.completedAt - task.startedAt) / 1000).toFixed(1);
    this.log(`\n Task ${task.status} in ${duration}s (${task.tokensUsed} tokens)`);
    this.log(`========================================\n`);

    return task;
  }

  /**
   * PLAN: Break goal into executable steps
   */
  private async plan(task: Task, context: string): Promise<TaskStep[]> {
    const prompt = `You are an autonomous agent. Break this goal into concrete executable steps.

GOAL: ${task.goal}
${task.context ? `CONTEXT: ${task.context}` : ''}
${context ? `\nRELEVANT MEMORY:\n${context}` : ''}

AVAILABLE TOOLS:
${toolDescriptions()}

RULES:
- Each step must use exactly one tool, or be a reasoning step (tool: null)
- Use REAL tool names and REAL argument values
- Keep it to 2-8 steps. Don't over-plan.
- The last step should verify or summarize the result.

Return ONLY a JSON array:
[
  { "action": "what this step does", "tool": "tool_name", "args": { "key": "value" } },
  { "action": "reasoning about X", "tool": null, "args": {} }
]`;

    const response = await this.chat([
      { role: 'system', content: 'You are an autonomous task planner. Return ONLY valid JSON arrays. No markdown.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, jsonMode: false });

    task.tokensUsed += (response.inputTokens || 0) + (response.outputTokens || 0);

    const steps = this.parseSteps(response.content, task.id);
    if (steps.length === 0) {
      throw new Error('Planner returned no steps');
    }

    this.log(`Plan: ${steps.length} steps`);
    steps.forEach((s, i) => this.log(`  ${i + 1}. [${s.tool || 'think'}] ${s.action}`));

    return steps;
  }

  /**
   * REPLAN: Adjust plan based on what's happened so far
   */
  private async replan(task: Task): Promise<TaskStep[]> {
    const history = task.observations.slice(-10)
      .map(o => `[${o.type}] Step ${o.stepIndex + 1}: ${o.content}`)
      .join('\n');

    const completedSteps = task.plan
      .filter(s => s.status === 'success')
      .map(s => `${s.index + 1}. [OK] ${s.action}: ${JSON.stringify(s.output).slice(0, 150)}`)
      .join('\n');

    const failedStep = task.plan[task.currentStep];

    const prompt = `A step in your plan failed. Create a new plan for the REMAINING work.

ORIGINAL GOAL: ${task.goal}

COMPLETED SO FAR:
${completedSteps || '(none)'}

FAILED STEP: ${failedStep?.action || 'unknown'}
ERROR: ${failedStep?.error || 'unknown'}

OBSERVATIONS:
${history}

AVAILABLE TOOLS:
${toolDescriptions()}

Create new steps to accomplish what's left. Try a DIFFERENT approach than what failed.
Return ONLY a JSON array of steps.`;

    const response = await this.chat([
      { role: 'system', content: 'You are replanning after a failure. Return ONLY valid JSON array.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.5 });

    task.tokensUsed += (response.inputTokens || 0) + (response.outputTokens || 0);

    return this.parseSteps(response.content, task.id, task.plan.length);
  }

  /**
   * SYNTHESIZE: Create a final result from everything that happened
   */
  private async synthesize(task: Task): Promise<string> {
    const results = task.plan
      .filter(s => s.status === 'success' && s.output)
      .map(s => `Step "${s.action}": ${JSON.stringify(s.output).slice(0, 400)}`)
      .join('\n\n');

    if (!results) return 'Task completed with no captured results.';

    const response = await this.chat([
      { role: 'system', content: 'Synthesize task results into a clear, useful answer. Be direct.' },
      { role: 'user', content: `GOAL: ${task.goal}\n\nRESULTS:\n${results}\n\nProvide a clear summary of what was accomplished.` },
    ]);

    task.tokensUsed += (response.inputTokens || 0) + (response.outputTokens || 0);
    return response.content;
  }

  /**
   * LEARN: Extract patterns from completed tasks
   */
  private async learnFromTask(task: Task): Promise<void> {
    const userId = task.userId;

    // Learn from successes
    if (task.status === 'completed') {
      const toolChain = task.plan
        .filter(s => s.tool && s.status === 'success')
        .map(s => s.tool)
        .join(' -> ');

      if (toolChain) {
        saveMemory(userId, 'learning',
          `For "${this.categorize(task.goal)}" goals, this tool chain works: ${toolChain}`,
          { goal: task.goal, status: 'completed' }, 0.8);
      }
    }

    // Learn from failures
    if (task.status === 'failed') {
      const errors = task.plan
        .filter(s => s.status === 'failed')
        .map(s => `${s.tool}: ${s.error}`)
        .join('; ');

      saveMemory(userId, 'learning',
        `"${this.categorize(task.goal)}" tasks can fail: ${errors}`,
        { goal: task.goal, status: 'failed' }, 0.6);
    }

    // Remember the task outcome
    saveMemory(userId, 'task',
      `${task.status === 'completed' ? 'Completed' : 'Failed'}: ${task.goal} -> ${(task.result || task.error || '').slice(0, 200)}`,
      { taskId: task.id, status: task.status }, 0.7);
  }

  /**
   * CHAT: Send messages to the LLM
   */
  async chat(messages: LLMMessage[], options: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}) {
    return this.llm.chat(messages, options);
  }

  /**
   * Simple goal categorization for learning
   */
  private categorize(goal: string): string {
    const l = goal.toLowerCase();
    if (l.includes('search') || l.includes('find')) return 'search';
    if (l.includes('create') || l.includes('build') || l.includes('write')) return 'creation';
    if (l.includes('monitor') || l.includes('watch')) return 'monitoring';
    if (l.includes('analyze') || l.includes('summarize')) return 'analysis';
    if (l.includes('code') || l.includes('program')) return 'coding';
    return 'general';
  }

  /**
   * Get relevant context from memory
   */
  private getRelevantContext(userId: string, goal: string): string {
    try {
      const memories = searchMemories(userId, goal, { type: 'learning', limit: 3 });
      const recent = getRecentMemories(userId, 'task', 3);

      const parts: string[] = [];
      if (memories.length > 0) {
        parts.push('Learnings: ' + memories.map((m: any) => m.content).join('; '));
      }
      if (recent.length > 0) {
        parts.push('Recent tasks: ' + recent.map((m: any) => m.content).join('; '));
      }
      return parts.join('\n');
    } catch {
      return '';
    }
  }

  /**
   * Record an observation
   */
  private observe(task: Task, stepIndex: number, type: Observation['type'], content: string): Observation {
    const obs: Observation = { stepIndex, type, content: content.slice(0, 500), timestamp: Date.now() };
    task.observations.push(obs);
    return obs;
  }

  /**
   * Parse JSON steps from LLM response
   */
  private parseSteps(text: string, taskId: string, startIndex: number = 0): TaskStep[] {
    let parsed: any[] | null = null;

    // Try direct JSON parse
    try { parsed = JSON.parse(text.trim()); } catch { /* continue */ }

    // Try extracting from markdown
    if (!parsed) {
      const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (m) try { parsed = JSON.parse(m[1].trim()); } catch { /* continue */ }
    }

    // Try finding array in text
    if (!parsed) {
      const m = text.match(/\[[\s\S]*\]/);
      if (m) try { parsed = JSON.parse(m[0]); } catch { /* continue */ }
    }

    if (!Array.isArray(parsed)) return [];

    return parsed.slice(0, this.config.maxSteps).map((s: any, i: number) => ({
      id: `${taskId}_s${startIndex + i}`,
      index: startIndex + i,
      action: s.action || s.description || `Step ${startIndex + i + 1}`,
      tool: s.tool || null,
      args: s.args || s.toolArgs || {},
      status: 'pending' as const,
      output: null,
      error: null,
      retries: 0,
      startedAt: null,
      completedAt: null,
    }));
  }

  private log(msg: string): void {
    if (this.config.verbose) console.log(`[Moltbot] ${msg}`);
  }
}
