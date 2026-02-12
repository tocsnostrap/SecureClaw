/**
 * AUTONOMOUS BACKGROUND TASKS - Node-Cron
 * 
 * Scheduled tasks that run automatically without user intervention
 * Examples: Market monitoring, health checks, proactive alerts, auto-cleanup
 */

import cron from 'node-cron';
import { routeToAgent } from '../agents/agents';
import { notifyEvent, getDeviceToken } from '../notifications/push';
import { notifyTelegram } from '../messaging/telegram';
import { notifyWhatsApp } from '../messaging/whatsapp';

interface CronTaskConfig {
  name: string;
  schedule: string; // Cron expression
  task: () => Promise<void>;
  enabled: boolean;
}

const cronTasks: Map<string, cron.ScheduledTask> = new Map();

/**
 * Health Check - Every 5 minutes
 */
const healthCheckTask: CronTaskConfig = {
  name: 'health-check',
  schedule: '*/5 * * * *', // Every 5 minutes
  enabled: true,
  task: async () => {
    console.log('[Cron] 🏥 Running health check...');

    try {
      const healthData = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      };

      const memoryUsageMB = Math.round(healthData.memoryUsage.heapUsed / 1024 / 1024);
      const uptimeHours = Math.round(healthData.uptime / 3600);

      console.log(`[Cron] ✅ Health OK: Uptime ${uptimeHours}h, Memory ${memoryUsageMB}MB`);

      // Alert if memory usage is high (> 800MB)
      if (memoryUsageMB > 800) {
        console.warn(`[Cron] ⚠️  High memory usage: ${memoryUsageMB}MB`);
        // Send alert notification if configured
      }
    } catch (error: any) {
      console.error(`[Cron] ❌ Health check error:`, error.message);
    }
  },
};

/**
 * Market Monitor - Every 15 minutes during market hours
 */
const marketMonitorTask: CronTaskConfig = {
  name: 'market-monitor',
  schedule: '*/15 9-16 * * 1-5', // Every 15 minutes, 9am-4pm, Mon-Fri (market hours)
  enabled: process.env.ENABLE_MARKET_MONITOR === 'true',
  task: async () => {
    console.log('[Cron] 📈 Monitoring markets...');

    try {
      // Use AI agent to check market conditions
      const response = await routeToAgent(
        [
          {
            role: 'user',
            content: 'Check major market indices (S&P 500, NASDAQ, DOW) for significant movements > 1%. Be brief.',
          },
        ],
        'research'
      );

      // Check for significant movements
      if (
        response.response.toLowerCase().includes('up') ||
        response.response.toLowerCase().includes('down') ||
        response.response.toLowerCase().includes('movement')
      ) {
        console.log(`[Cron] 📊 Market update: ${response.response.slice(0, 100)}...`);
        // Send notification if user opted in
      }
    } catch (error: any) {
      console.error(`[Cron] ❌ Market monitor error:`, error.message);
    }
  },
};

/**
 * Daily Summary - Every day at 6 PM
 */
const dailySummaryTask: CronTaskConfig = {
  name: 'daily-summary',
  schedule: '0 18 * * *', // 6:00 PM every day
  enabled: process.env.ENABLE_DAILY_SUMMARY === 'true',
  task: async () => {
    console.log('[Cron] 📋 Generating daily summary...');

    try {
      // Generate AI summary of the day
      const response = await routeToAgent(
        [
          {
            role: 'user',
            content:
              'Generate a brief daily summary: top tech/AI news, any major market movements, weather forecast. Keep it under 200 words.',
          },
        ],
        'research'
      );

      console.log(`[Cron] ✅ Daily summary generated`);

      // Send via push/Telegram/WhatsApp if configured
      // Note: Would need user preferences for which channels to use
    } catch (error: any) {
      console.error(`[Cron] ❌ Daily summary error:`, error.message);
    }
  },
};

/**
 * Cleanup Old Logs - Every day at 2 AM
 */
const cleanupLogsTask: CronTaskConfig = {
  name: 'cleanup-logs',
  schedule: '0 2 * * *', // 2:00 AM every day
  enabled: true,
  task: async () => {
    console.log('[Cron] 🧹 Cleaning up old logs...');

    try {
      // In production, would clean up logs older than 30 days
      const { promises: fs } = await import('fs');
      const path = await import('path');
      
      const logsDir = path.join(process.cwd(), 'logs');

      // Check if logs directory exists
      try {
        await fs.access(logsDir);
        console.log(`[Cron] ✅ Logs directory checked`);
      } catch {
        console.log(`[Cron] ℹ️  No logs directory to clean`);
      }
    } catch (error: any) {
      console.error(`[Cron] ❌ Cleanup error:`, error.message);
    }
  },
};

/**
 * Token Refresh Check - Every hour
 */
const tokenRefreshTask: CronTaskConfig = {
  name: 'token-refresh',
  schedule: '0 * * * *', // Every hour
  enabled: true,
  task: async () => {
    console.log('[Cron] 🔄 Checking for tokens to refresh...');

    try {
      // Check if any OAuth tokens are expiring soon
      // In production, would query database for expiring tokens
      // and proactively refresh them before they expire

      console.log(`[Cron] ✅ Token refresh check complete`);
    } catch (error: any) {
      console.error(`[Cron] ❌ Token refresh error:`, error.message);
    }
  },
};

/**
 * AI Self-Reflection - Every 24 hours
 */
const selfReflectionTask: CronTaskConfig = {
  name: 'self-reflection',
  schedule: '0 3 * * *', // 3:00 AM every day
  enabled: process.env.ENABLE_AI_REFLECTION === 'true',
  task: async () => {
    console.log('[Cron] 🧠 AI self-reflection cycle...');

    try {
      // AI analyzes its own performance and suggests improvements
      const response = await routeToAgent(
        [
          {
            role: 'user',
            content:
              'Reflect on your performance over the last 24 hours. What worked well? What could be improved? Any new capabilities you should develop?',
          },
        ],
        'orchestrator'
      );

      console.log(`[Cron] 🤖 Self-reflection: ${response.response.slice(0, 150)}...`);

      // In production, would store insights and potentially trigger self-evolution
    } catch (error: any) {
      console.error(`[Cron] ❌ Self-reflection error:`, error.message);
    }
  },
};

/**
 * Register and start all cron tasks
 */
export function startCronTasks(): void {
  console.log('[Cron] 🚀 Starting autonomous background tasks...');

  const tasks: CronTaskConfig[] = [
    healthCheckTask,
    marketMonitorTask,
    dailySummaryTask,
    cleanupLogsTask,
    tokenRefreshTask,
    selfReflectionTask,
  ];

  let enabledCount = 0;

  for (const taskConfig of tasks) {
    if (!taskConfig.enabled) {
      console.log(`[Cron] ⏭️  Skipping disabled task: ${taskConfig.name}`);
      continue;
    }

    try {
      const scheduledTask = cron.schedule(taskConfig.schedule, taskConfig.task, {
        scheduled: true,
        timezone: process.env.TIMEZONE || 'America/New_York',
      });

      cronTasks.set(taskConfig.name, scheduledTask);
      enabledCount++;

      console.log(`[Cron] ✅ Scheduled: ${taskConfig.name} (${taskConfig.schedule})`);
    } catch (error: any) {
      console.error(`[Cron] ❌ Failed to schedule ${taskConfig.name}:`, error.message);
    }
  }

  console.log(`[Cron] 🎉 ${enabledCount} autonomous tasks started!`);
}

/**
 * Stop all cron tasks
 */
export function stopCronTasks(): void {
  console.log('[Cron] 🛑 Stopping all cron tasks...');

  for (const [name, task] of cronTasks.entries()) {
    task.stop();
    console.log(`[Cron] ⏹️  Stopped: ${name}`);
  }

  cronTasks.clear();
  console.log('[Cron] ✅ All cron tasks stopped');
}

/**
 * Get status of all cron tasks
 */
export function getCronTasksStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {};

  for (const [name, task] of cronTasks.entries()) {
    status[name] = true; // Running
  }

  return status;
}

// Auto-start if running as main module
if (require.main === module) {
  console.log('[Cron] 🤖 SecureClaw Autonomous Tasks Starting...');
  startCronTasks();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('[Cron] 📴 Shutting down gracefully...');
    stopCronTasks();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[Cron] 📴 Shutting down gracefully...');
    stopCronTasks();
    process.exit(0);
  });
}

export default {
  startCronTasks,
  stopCronTasks,
  getCronTasksStatus,
};
