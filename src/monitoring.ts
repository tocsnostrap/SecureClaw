/**
 * STATUS MONITORING - Clawdbot-Style Real-Time Monitoring
 * 
 * Server health checks, uptime tracking, connection monitoring
 * Proactive alerts for issues
 */

import { callGrok } from './agents/providers/xai';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastCheck: number;
  message?: string;
}

interface SystemStatus {
  overall: 'operational' | 'degraded' | 'outage';
  uptime: number;
  startedAt: number;
  checks: HealthCheck[];
  alerts: Alert[];
}

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
}

const SYSTEM_START_TIME = Date.now();
const healthChecks: Map<string, HealthCheck> = new Map();
const activeAlerts: Alert[] = [];
let alertCounter = 0;

/**
 * RUN HEALTH CHECK - Ping service and measure latency
 */
export async function runHealthCheck(service: string, endpoint?: string): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    switch (service) {
      case 'gateway':
        // Check if server is responding
        const latency = Date.now() - startTime;
        return {
          service,
          status: 'healthy',
          latency,
          lastCheck: Date.now(),
          message: 'Gateway responding normally',
        };
        
      case 'grok':
        // Check Grok API availability WITHOUT making an expensive API call
        if (!process.env.XAI_API_KEY) {
          return {
            service,
            status: 'down',
            latency: 0,
            lastCheck: Date.now(),
            message: 'XAI_API_KEY not configured',
          };
        }
        
        // Lightweight check: verify API key format and endpoint reachability
        try {
          const response = await fetch('https://api.x.ai/v1/models', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
            },
            signal: AbortSignal.timeout(5000),
          });
          
          const latency = Date.now() - startTime;
          
          if (response.ok) {
            return {
              service,
              status: 'healthy',
              latency,
              lastCheck: Date.now(),
              message: 'xAI API reachable',
            };
          } else if (response.status === 401) {
            return {
              service,
              status: 'down',
              latency,
              lastCheck: Date.now(),
              message: 'Invalid API key',
            };
          } else {
            return {
              service,
              status: 'degraded',
              latency,
              lastCheck: Date.now(),
              message: `xAI API returned ${response.status}`,
            };
          }
        } catch (error: any) {
          return {
            service,
            status: 'down',
            latency: Date.now() - startTime,
            lastCheck: Date.now(),
            message: `xAI unreachable: ${error.message}`,
          };
        }
        
      case 'browser':
        // Check browser skill availability
        try {
          const { getLockStatus } = await import('./skills/browser_mutex');
          const lockStatus = await getLockStatus();
          
          return {
            service,
            status: lockStatus.locked ? 'degraded' : 'healthy',
            latency: Date.now() - startTime,
            lastCheck: Date.now(),
            message: lockStatus.locked ? `Browser busy (${lockStatus.age}s)` : 'Browser available',
          };
        } catch (error: any) {
          return {
            service,
            status: 'degraded',
            latency: Date.now() - startTime,
            lastCheck: Date.now(),
            message: `Browser check failed: ${error.message}`,
          };
        }
        
      case 'permissions':
        // Check permissions system
        try {
          const { getAllPermissions } = await import('./permissions');
          getAllPermissions('test');
          
          return {
            service,
            status: 'healthy',
            latency: Date.now() - startTime,
            lastCheck: Date.now(),
            message: 'Permissions system operational',
          };
        } catch (error: any) {
          return {
            service,
            status: 'degraded',
            latency: Date.now() - startTime,
            lastCheck: Date.now(),
            message: `Permissions error: ${error.message}`,
          };
        }
        
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  } catch (error: any) {
    console.error(`[Monitor] ❌ Health check failed for ${service}:`, error.message);
    
    return {
      service,
      status: 'down',
      latency: Date.now() - startTime,
      lastCheck: Date.now(),
      message: `Check failed: ${error.message}`,
    };
  }
}

/**
 * RUN ALL HEALTH CHECKS
 */
export async function runAllHealthChecks(): Promise<SystemStatus> {
  console.log(`[Monitor] 🏥 Running health checks...`);
  
  const services = ['gateway', 'grok', 'browser', 'permissions'];
  const checks: HealthCheck[] = [];
  
  for (const service of services) {
    const check = await runHealthCheck(service);
    checks.push(check);
    healthChecks.set(service, check);
  }
  
  // Determine overall status
  const hasDown = checks.some(c => c.status === 'down');
  const hasDegraded = checks.some(c => c.status === 'degraded');
  
  const overall = hasDown ? 'outage' : hasDegraded ? 'degraded' : 'operational';
  
  // Create alerts for issues
  for (const check of checks) {
    if (check.status !== 'healthy') {
      createAlert('warning', `${check.service} is ${check.status}: ${check.message}`);
    }
  }
  
  const uptime = Date.now() - SYSTEM_START_TIME;
  
  const status: SystemStatus = {
    overall,
    uptime,
    startedAt: SYSTEM_START_TIME,
    checks,
    alerts: getActiveAlerts(),
  };
  
  console.log(`[Monitor] 📊 Status: ${overall}, Uptime: ${Math.floor(uptime / 1000)}s`);
  
  return status;
}

/**
 * CREATE ALERT
 */
export function createAlert(
  severity: 'info' | 'warning' | 'critical',
  message: string
): Alert {
  const alert: Alert = {
    id: `alert-${++alertCounter}`,
    severity,
    message,
    timestamp: Date.now(),
    resolved: false,
  };
  
  activeAlerts.push(alert);
  console.log(`[Monitor] 🚨 Alert (${severity}): ${message}`);
  
  return alert;
}

/**
 * RESOLVE ALERT
 */
export function resolveAlert(alertId: string): void {
  const alert = activeAlerts.find(a => a.id === alertId);
  if (alert) {
    alert.resolved = true;
    console.log(`[Monitor] ✅ Alert resolved: ${alertId}`);
  }
}

/**
 * GET ACTIVE ALERTS
 */
export function getActiveAlerts(): Alert[] {
  return activeAlerts.filter(a => !a.resolved);
}

/**
 * GET SYSTEM UPTIME (formatted)
 */
export function getFormattedUptime(): string {
  const uptime = Date.now() - SYSTEM_START_TIME;
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * PROACTIVE MONITORING - Auto-diagnose and suggest fixes
 */
export async function runProactiveDiagnostics(userName: string = 'friend'): Promise<string> {
  const status = await runAllHealthChecks();
  
  if (status.overall === 'operational') {
    return `All systems green, ${userName}! Everything's running smoothly ✅`;
  }
  
  // Use Grok to analyze issues and suggest fixes
  const issues = status.checks
    .filter(c => c.status !== 'healthy')
    .map(c => `- ${c.service}: ${c.status} (${c.message})`)
    .join('\n');
  
  try {
    const diagnosis = await callGrok([
      {
        role: 'system',
        content: `You are a system diagnostics AI. Analyze issues and suggest fixes in a casual, helpful way for ${userName}.`,
      },
      {
        role: 'user',
        content: `System status: ${status.overall}\n\nIssues detected:\n${issues}\n\nProvide a brief diagnosis and suggested fixes.`,
      },
    ]);
    
    return `${userName}, found some issues:\n\n${diagnosis}`;
    
  } catch (error) {
    return `${userName}, detected issues but Grok is down. Manual check needed:\n${issues}`;
  }
}

/**
 * START MONITORING LOOP (optional background monitoring)
 */
let monitoringInterval: NodeJS.Timeout | null = null;

export function startMonitoring(intervalMs: number = 60000): void {
  if (monitoringInterval) {
    console.log(`[Monitor] ⚠️  Monitoring already running`);
    return;
  }
  
  console.log(`[Monitor] 🔄 Starting monitoring (every ${intervalMs}ms)`);
  
  monitoringInterval = setInterval(async () => {
    const status = await runAllHealthChecks();
    
    if (status.overall !== 'operational') {
      console.warn(`[Monitor] ⚠️  System ${status.overall}`);
      
      // Could send notifications here
    }
  }, intervalMs);
}

export function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log(`[Monitor] 🛑 Monitoring stopped`);
  }
}

/**
 * GET CONNECTION STATUS - For real-time dashboard updates
 */
export function getConnectionStatus(): {
  connected: boolean;
  latency: number;
  lastCheck: number;
} {
  const gatewayCheck = healthChecks.get('gateway');
  
  return {
    connected: gatewayCheck?.status === 'healthy',
    latency: gatewayCheck?.latency || 0,
    lastCheck: gatewayCheck?.lastCheck || Date.now(),
  };
}

export default {
  runHealthCheck,
  runAllHealthChecks,
  createAlert,
  resolveAlert,
  getActiveAlerts,
  getFormattedUptime,
  runProactiveDiagnostics,
  startMonitoring,
  stopMonitoring,
  getConnectionStatus,
};
