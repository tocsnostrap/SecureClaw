import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ───────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  plan: text("plan").notNull().default("free"), // free | basic | pro | enterprise
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Audit Log ───────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agent: text("agent").notNull(),
  action: text("action").notNull(),
  tool: text("tool"),
  input: text("input"),
  output: text("output"),
  status: text("status").notNull(), // pending | approved | executed | denied | failed
  requiresConsent: boolean("requires_consent").notNull().default(false),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;

// ─── Permissions (encrypted credentials) ─────────────────────────────
export const permissions = pgTable("permissions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  app: text("app").notNull(), // instagram | gmail | twitter | calendar
  granted: boolean("granted").notNull().default(true),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  encryptedCredentials: text("encrypted_credentials"), // AES-256 encrypted JSON
  credentialsIv: text("credentials_iv"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export type Permission = typeof permissions.$inferSelect;

// ─── Conversations / Memory ──────────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(), // user | assistant | system
  content: text("content").notNull(),
  toolsUsed: jsonb("tools_used").$type<string[]>().default([]),
  outcome: text("outcome"), // success | partial | failure
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;

// ─── User Preferences (learned by AI) ────────────────────────────────
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(),
  responseLength: text("response_length").notNull().default("comprehensive"),
  technicalDepth: text("technical_depth").notNull().default("expert"),
  creativityLevel: text("creativity_level").notNull().default("highly-creative"),
  communicationStyle: text("communication_style").notNull().default("direct"),
  preferredTools: jsonb("preferred_tools").$type<string[]>().default([]),
  topics: jsonb("topics").$type<string[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;

// ─── Credits ─────────────────────────────────────────────────────────
export const credits = pgTable("credits", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(),
  balance: integer("balance").notNull().default(100),
  plan: text("plan").notNull().default("free"),
  usedThisMonth: integer("used_this_month").notNull().default(0),
  resetDate: timestamp("reset_date").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Credit = typeof credits.$inferSelect;

// ─── Proactive Tasks ─────────────────────────────────────────────────
export const proactiveTasks = pgTable("proactive_tasks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  cronExpression: text("cron_expression").notNull(),
  agent: text("agent").notNull(),
  prompt: text("prompt").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProactiveTask = typeof proactiveTasks.$inferSelect;

// ─── Learnings (AI self-reflection insights) ─────────────────────────
export const learnings = pgTable("learnings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  insight: text("insight").notNull(),
  confidence: integer("confidence").notNull().default(70), // 0-100
  category: text("category").notNull(), // user-preference | strategy | technical | creative
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
