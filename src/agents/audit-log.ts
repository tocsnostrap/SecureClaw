import * as fs from "fs";
import * as path from "path";

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

const AUDIT_FILE = path.join(process.cwd(), ".audit-log.json");
const MAX_LOG_SIZE = 1000;

interface AuditState {
  log: AuditEntry[];
  counter: number;
}

function readState(): AuditState {
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const data = fs.readFileSync(AUDIT_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch {}
  return { log: [], counter: 0 };
}

function writeState(state: AuditState): void {
  try {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(state), "utf-8");
  } catch (err) {
    console.error("[Audit] Failed to write audit log:", err);
  }
}

function generateAuditId(state: AuditState): string {
  state.counter++;
  return `audit-${Date.now()}-${state.counter}`;
}

export function logAction(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
  const state = readState();
  const full: AuditEntry = {
    ...entry,
    id: generateAuditId(state),
    timestamp: Date.now(),
  };

  state.log.unshift(full);

  if (state.log.length > MAX_LOG_SIZE) {
    state.log.length = MAX_LOG_SIZE;
  }

  writeState(state);

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
  const state = readState();
  let filtered = state.log;
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
  const state = readState();
  const stats = {
    total: state.log.length,
    executed: 0,
    denied: 0,
    failed: 0,
    byAgent: {} as Record<string, number>,
  };

  for (const entry of state.log) {
    if (entry.status === "executed") stats.executed++;
    if (entry.status === "denied") stats.denied++;
    if (entry.status === "failed") stats.failed++;
    stats.byAgent[entry.agent] = (stats.byAgent[entry.agent] || 0) + 1;
  }

  return stats;
}

export function clearAuditLog(): void {
  writeState({ log: [], counter: 0 });
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
