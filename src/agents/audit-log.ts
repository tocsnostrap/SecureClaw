export interface AuditEntry {
  id: string;
  timestamp: number;
  agent: string;
  action: string;
  tool: string | null;
  input: string;
  output: string | null;
  status: "pending" | "approved" | "executed" | "denied" | "failed";
  requiresConsent: boolean;
  userId: string | null;
}

const auditLog: AuditEntry[] = [];
const MAX_LOG_SIZE = 1000;

let auditCounter = 0;
function generateAuditId(): string {
  auditCounter++;
  return `audit-${Date.now()}-${auditCounter}`;
}

export function logAction(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
  const full: AuditEntry = {
    ...entry,
    id: generateAuditId(),
    timestamp: Date.now(),
  };

  auditLog.unshift(full);

  if (auditLog.length > MAX_LOG_SIZE) {
    auditLog.length = MAX_LOG_SIZE;
  }

  const emoji =
    full.status === "executed"
      ? "[OK]"
      : full.status === "denied"
      ? "[DENY]"
      : full.status === "failed"
      ? "[FAIL]"
      : "[LOG]";

  console.log(
    `${emoji} [Audit] agent=${full.agent} action=${full.action} tool=${full.tool || "none"} status=${full.status}`
  );

  return full;
}

export function getAuditLog(limit: number = 50, agent?: string): AuditEntry[] {
  let filtered = auditLog;
  if (agent) {
    filtered = filtered.filter((e) => e.agent === agent);
  }
  return filtered.slice(0, limit);
}

export function getAuditStats(): {
  total: number;
  executed: number;
  denied: number;
  failed: number;
  byAgent: Record<string, number>;
} {
  const stats = {
    total: auditLog.length,
    executed: 0,
    denied: 0,
    failed: 0,
    byAgent: {} as Record<string, number>,
  };

  for (const entry of auditLog) {
    if (entry.status === "executed") stats.executed++;
    if (entry.status === "denied") stats.denied++;
    if (entry.status === "failed") stats.failed++;
    stats.byAgent[entry.agent] = (stats.byAgent[entry.agent] || 0) + 1;
  }

  return stats;
}

export function clearAuditLog(): void {
  auditLog.length = 0;
}

export const TOOL_ALLOWLIST = new Set([
  "web_search",
  "summarize",
  "schedule_task",
  "send_notification",
  "get_weather",
  "get_time",
  "read_rss",
  "calculate",
  "translate",
  "set_reminder",
]);

export function isToolAllowed(tool: string): boolean {
  return TOOL_ALLOWLIST.has(tool);
}
