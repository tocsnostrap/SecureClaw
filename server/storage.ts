import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

/**
 * Storage interface - supports both in-memory and PostgreSQL backends
 * 
 * On Replit: Set DATABASE_URL in Secrets to enable PostgreSQL persistence.
 * Without DATABASE_URL: Falls back to in-memory (data lost on restart).
 */

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      plan: "free",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }
}

// Database connection setup (lazy - only connects when DATABASE_URL exists)
let _db: any = null;

export async function getDb() {
  if (_db) return _db;
  
  if (!process.env.DATABASE_URL) {
    console.log("[Storage] No DATABASE_URL - using in-memory storage. Set DATABASE_URL in Replit Secrets for persistence.");
    return null;
  }
  
  try {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pg = await import("pg");
    const Pool = pg.default?.Pool || pg.Pool;
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    
    const schema = await import("@shared/schema");
    _db = drizzle(pool, { schema });
    
    console.log("[Storage] Connected to PostgreSQL database");
    return _db;
  } catch (error: any) {
    console.error("[Storage] Failed to connect to PostgreSQL:", error.message);
    console.log("[Storage] Falling back to in-memory storage");
    return null;
  }
}

export const storage = new MemStorage();
