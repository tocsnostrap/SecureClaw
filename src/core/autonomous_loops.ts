/**
 * AUTONOMOUS 24/7 BACKGROUND LOOPS
 * 
 * AI that runs continuously, monitors, learns, and acts WITHOUT user prompting
 * True autonomous AGI behavior
 * 
 * IMPROVED: Configurable, explicit startup, circuit breakers, cost-aware
 */

import { callGrok } from '../agents/providers/xai';
import { webSearch } from '../skills/browser_skill';
import { runAllHealthChecks } from '../monitoring';

interface AutonomousTask {
  id: string;
  name: string;
  action: () => Promise<void>;
  intervalMs: number;
  lastRun: number;
  enabled: boolean;
  // Circuit breaker state
  consecutiveFailures: number;
  maxFailures: number;
  backoffUntil: number;
}

const autonomousTasks: Map<string, AutonomousTask> = new Map();
const taskTimers: Map<string, NodeJS.Timeout> = new Map();
let loopsRunning = false;

/**
 * CONTINUOUS LEARNING LOOP - Learn from patterns periodically
 */
async function continuousLearningLoop(): Promise<void> {
  console.log(`[Autonomous] Running learning analysis...`);
  
  try {
    const learningPrompt = `You are analyzing your recent performance to improve.

Review the last few hours of operation and identify:
1. What worked well?
2. What could be better?
3. What new patterns emerged?
4. How should you adapt?

Provide 3 concrete improvements to implement.`;

    const insights = await callGrok([
      { role: 'system', content: 'You are self-analyzing for continuous improvement.' },
      { role: 'user', content: learningPrompt },
    ]);
    
    console.log(`[Autonomous] Learning insights:\n${insights.slice(0, 200)}...`);
    
  } catch (error: any) {
    console.error(`[Autonomous] Learning error:`, error.message);
    throw error; // Re-throw for circuit breaker
  }
}

/**
 * PROACTIVE MONITORING LOOP - Check systems WITHOUT wasting API credits
 */
async function proactiveMonitoringLoop(): Promise<void> {
  console.log(`[Autonomous] Running proactive health check...`);
  
  try {
    const status = await runAllHealthChecks();
    
    if (status.overall !== 'operational') {
      console.warn(`[Autonomous] System ${status.overall} - issues detected`);
      
      // Only use AI for diagnosis when there are actual problems
      const issues = status.checks
        .filter(c => c.status !== 'healthy')
        .map(c => `${c.service}: ${c.status} - ${c.message}`)
        .join(', ');
      
      console.log(`[Autonomous] Issues: ${issues}`);
    } else {
      console.log(`[Autonomous] All systems operational`);
    }
    
  } catch (error: any) {
    console.error(`[Autonomous] Monitoring error:`, error.message);
    throw error;
  }
}

/**
 * PREDICTIVE PREPARATION LOOP - Anticipate needs and pre-fetch
 */
async function predictivePreparationLoop(): Promise<void> {
  console.log(`[Autonomous] Running predictive preparation...`);
  
  try {
    const hour = new Date().getHours();
    
    // Morning: Pre-fetch news and weather
    if (hour >= 6 && hour <= 9) {
      console.log(`[Autonomous] Morning routine: Pre-fetching news...`);
      await webSearch('AI news today', { userName: 'Scot' });
    }
    
    // Evening: Log summary
    if (hour >= 18 && hour <= 21) {
      console.log(`[Autonomous] Evening routine: preparing daily summary...`);
    }
    
  } catch (error: any) {
    console.error(`[Autonomous] Prediction error:`, error.message);
    throw error;
  }
}

/**
 * SELF-EVOLUTION LOOP - Generate new capabilities automatically
 */
async function selfEvolutionLoop(): Promise<void> {
  console.log(`[Autonomous] Running self-evolution check...`);
  
  try {
    const { runSelfImprovementCycle } = await import('./self_evolution');
    
    const result = await runSelfImprovementCycle();
    
    if (result.deployed > 0) {
      console.log(`[Autonomous] Self-evolved: ${result.newCapabilities.join(', ')}`);
    }
    
  } catch (error: any) {
    console.error(`[Autonomous] Evolution error:`, error.message);
    throw error;
  }
}

/**
 * START ALL AUTONOMOUS LOOPS - Must be called explicitly
 */
export function startAutonomousLoops(config?: {
  enableLearning?: boolean;
  enableMonitoring?: boolean;
  enablePrediction?: boolean;
  enableEvolution?: boolean;
  monitoringIntervalMs?: number;
  learningIntervalMs?: number;
}): void {
  if (loopsRunning) {
    console.log(`[Autonomous] Loops already running`);
    return;
  }
  
  const {
    enableLearning = true,
    enableMonitoring = true,
    enablePrediction = true,
    enableEvolution = false, // Disabled by default - opt-in
    monitoringIntervalMs = 5 * 60000,    // 5 minutes
    learningIntervalMs = 4 * 3600000,     // 4 hours
  } = config || {};
  
  console.log(`[Autonomous] Starting autonomous background loops...`);
  
  if (enableLearning) {
    registerAutonomousTask({
      id: 'continuous_learning',
      name: 'Continuous Learning',
      action: continuousLearningLoop,
      intervalMs: learningIntervalMs,
      lastRun: 0,
      enabled: true,
      consecutiveFailures: 0,
      maxFailures: 3,
      backoffUntil: 0,
    });
  }
  
  if (enableMonitoring) {
    registerAutonomousTask({
      id: 'proactive_monitoring',
      name: 'Proactive Monitoring',
      action: proactiveMonitoringLoop,
      intervalMs: monitoringIntervalMs,
      lastRun: 0,
      enabled: true,
      consecutiveFailures: 0,
      maxFailures: 5,
      backoffUntil: 0,
    });
  }
  
  if (enablePrediction) {
    registerAutonomousTask({
      id: 'predictive_preparation',
      name: 'Predictive Preparation',
      action: predictivePreparationLoop,
      intervalMs: 30 * 60000,
      lastRun: 0,
      enabled: true,
      consecutiveFailures: 0,
      maxFailures: 3,
      backoffUntil: 0,
    });
  }
  
  if (enableEvolution) {
    registerAutonomousTask({
      id: 'self_evolution',
      name: 'Self-Evolution',
      action: selfEvolutionLoop,
      intervalMs: 24 * 3600000,
      lastRun: 0,
      enabled: true,
      consecutiveFailures: 0,
      maxFailures: 2,
      backoffUntil: 0,
    });
  }
  
  loopsRunning = true;
  console.log(`[Autonomous] ${autonomousTasks.size} autonomous loops registered`);
}

/**
 * Register and start an autonomous task with circuit breaker
 */
function registerAutonomousTask(task: AutonomousTask): void {
  autonomousTasks.set(task.id, task);
  
  const timer = setInterval(async () => {
    if (!task.enabled) return;
    
    // Circuit breaker: check if in backoff
    const now = Date.now();
    if (now < task.backoffUntil) {
      const remainingSec = Math.ceil((task.backoffUntil - now) / 1000);
      console.log(`[Autonomous] ${task.name} in circuit breaker backoff (${remainingSec}s remaining)`);
      return;
    }
    
    console.log(`[Autonomous] Executing: ${task.name}`);
    task.lastRun = now;
    
    try {
      await task.action();
      // Reset circuit breaker on success
      task.consecutiveFailures = 0;
      task.backoffUntil = 0;
    } catch (error: any) {
      task.consecutiveFailures++;
      console.error(`[Autonomous] Task ${task.name} failed (${task.consecutiveFailures}/${task.maxFailures}):`, error.message);
      
      // Trip circuit breaker
      if (task.consecutiveFailures >= task.maxFailures) {
        // Exponential backoff: 5min, 15min, 45min, capped at 2 hours
        const backoffMs = Math.min(
          5 * 60000 * Math.pow(3, task.consecutiveFailures - task.maxFailures),
          2 * 3600000
        );
        task.backoffUntil = Date.now() + backoffMs;
        console.warn(`[Autonomous] CIRCUIT BREAKER: ${task.name} disabled for ${Math.ceil(backoffMs / 60000)}min after ${task.consecutiveFailures} consecutive failures`);
      }
    }
  }, task.intervalMs);
  
  taskTimers.set(task.id, timer);
  
  console.log(`[Autonomous] Registered: ${task.name} (every ${Math.round(task.intervalMs / 60000)}min)`);
}

/**
 * STOP ALL LOOPS
 */
export function stopAutonomousLoops(): void {
  for (const [id, timer] of taskTimers.entries()) {
    clearInterval(timer);
  }
  
  taskTimers.clear();
  autonomousTasks.clear();
  loopsRunning = false;
  console.log(`[Autonomous] All autonomous loops stopped`);
}

/**
 * GET LOOP STATUS
 */
export function getLoopStatus(): Array<{
  id: string;
  name: string;
  lastRun: number;
  enabled: boolean;
  consecutiveFailures: number;
  isInBackoff: boolean;
  backoffRemainingMs: number;
}> {
  const now = Date.now();
  return Array.from(autonomousTasks.values()).map(task => ({
    id: task.id,
    name: task.name,
    lastRun: task.lastRun,
    enabled: task.enabled,
    consecutiveFailures: task.consecutiveFailures,
    isInBackoff: now < task.backoffUntil,
    backoffRemainingMs: Math.max(0, task.backoffUntil - now),
  }));
}

/**
 * Check if loops are currently running
 */
export function areLoopsRunning(): boolean {
  return loopsRunning;
}

// NOTE: Loops are NOT auto-started. Call startAutonomousLoops() explicitly from server.

export default {
  startAutonomousLoops,
  stopAutonomousLoops,
  getLoopStatus,
  areLoopsRunning,
};
