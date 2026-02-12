/**
 * MOLTBOT - Database (SQLite)
 * 
 * Zero-config persistent storage. Works on Replit out of the box.
 * No Postgres, no connection strings, just a file.
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'moltbot.db');
let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    console.log(`[Moltbot DB] Ready: ${DB_PATH}`);
  }
  return db;
}

function initSchema(): void {
  const d = db;

  d.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      goal TEXT NOT NULL,
      context TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      plan TEXT DEFAULT '[]',
      observations TEXT DEFAULT '[]',
      result TEXT,
      error TEXT,
      tokens_used INTEGER DEFAULT 0,
      started_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      score REAL DEFAULT 0.7,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(user_id, type);
    CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  `);
}

// ── Task persistence ─────────────────────────────────────────────────

export function saveTask(task: any): void {
  const d = getDb();
  d.prepare(`
    INSERT OR REPLACE INTO tasks (id, user_id, goal, context, status, plan, observations, result, error, tokens_used, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id, task.userId, task.goal, task.context || '',
    task.status, JSON.stringify(task.plan), JSON.stringify(task.observations),
    task.result, task.error, task.tokensUsed || 0,
    task.startedAt, task.completedAt
  );
}

export function getTask(id: string): any | null {
  const d = getDb();
  const row = d.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    ...row,
    plan: JSON.parse(row.plan || '[]'),
    observations: JSON.parse(row.observations || '[]'),
    userId: row.user_id,
    tokensUsed: row.tokens_used,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export function getUserTasks(userId: string, limit: number = 20): any[] {
  const d = getDb();
  const rows = d.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY started_at DESC LIMIT ?').all(userId, limit) as any[];
  return rows.map(row => ({
    ...row,
    plan: JSON.parse(row.plan || '[]'),
    observations: JSON.parse(row.observations || '[]'),
    userId: row.user_id,
    tokensUsed: row.tokens_used,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));
}

// ── Memory persistence ───────────────────────────────────────────────

export function saveMemory(userId: string, type: string, content: string, metadata: any = {}, score: number = 0.7): number {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO memories (user_id, type, content, metadata, score, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, type, content, JSON.stringify(metadata), score, Date.now());
  return Number(result.lastInsertRowid);
}

export function searchMemories(userId: string, query: string, options: { type?: string; limit?: number } = {}): any[] {
  const d = getDb();
  const { type, limit = 10 } = options;

  // Simple keyword search (works well enough; can add FTS5 later)
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return [];

  let sql = 'SELECT * FROM memories WHERE user_id = ?';
  const params: any[] = [userId];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  // Match any word in content
  const conditions = words.map(() => 'LOWER(content) LIKE ?');
  sql += ` AND (${conditions.join(' OR ')})`;
  words.forEach(w => params.push(`%${w}%`));

  sql += ' ORDER BY score DESC, created_at DESC LIMIT ?';
  params.push(limit);

  return d.prepare(sql).all(...params) as any[];
}

export function getRecentMemories(userId: string, type: string, limit: number = 10): any[] {
  const d = getDb();
  return d.prepare('SELECT * FROM memories WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, type, limit) as any[];
}

export function getMemoryStats(): { tasks: number; memories: number } {
  const d = getDb();
  const tasks = (d.prepare('SELECT COUNT(*) as c FROM tasks').get() as any).c;
  const memories = (d.prepare('SELECT COUNT(*) as c FROM memories').get() as any).c;
  return { tasks, memories };
}
