/**
 * PERMISSIONS SYSTEM - GoClaw-Style App Access Control
 * 
 * Manages app permissions (Instagram, email, etc.) with encryption and OAuth
 * Employee-like execution: AI asks for permissions, stores securely, executes tasks
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

const PERMISSIONS_FILE = path.join(process.cwd(), '.permissions.json');

// Use env var or generate a deterministic key from hostname (warn if insecure)
function getEncryptionKey(): string {
  const envKey = process.env.PERMISSIONS_KEY;
  if (envKey && envKey !== 'secureclaw_default_key_change_me_32chars') {
    return envKey;
  }
  // Fallback: derive from a combination of env values (better than hardcoded, but set PERMISSIONS_KEY!)
  const fallback = require('crypto')
    .createHash('sha256')
    .update(`secureclaw_${process.env.REPL_ID || process.env.HOSTNAME || 'local'}_permissions`)
    .digest('hex')
    .slice(0, 32);
  return fallback;
}
const ENCRYPTION_KEY = getEncryptionKey();

export interface Permission {
  app: string;
  granted: boolean;
  grantedAt: number;
  revokedAt?: number;
  credentials?: {
    encrypted: string;
    iv: string;
  };
  scopes: string[];
  userId: string;
  metadata?: {
    username?: string;
    email?: string;
    refreshToken?: string;
  };
}

export interface PermissionRequest {
  app: string;
  reason: string;
  scopes: string[];
  credentials?: any;
}

export interface PermissionResponse {
  success: boolean;
  message: string;
  humanMessage?: string;
  permission?: Permission;
}

/**
 * In-memory permissions store (would be database in production)
 */
let permissionsCache: Map<string, Permission> = new Map();

/**
 * GRANT PERMISSION - Store encrypted credentials for app access
 */
export async function grantPermission(
  userId: string,
  app: string,
  credentials: any,
  scopes: string[] = ['read'],
  metadata?: any
): Promise<PermissionResponse> {
  try {
    console.log(`[Permissions] 🔐 Granting ${app} access for user ${userId}`);
    
    // Encrypt credentials
    const encryptedCreds = encryptCredentials(credentials);
    
    const permission: Permission = {
      app,
      granted: true,
      grantedAt: Date.now(),
      credentials: encryptedCreds,
      scopes,
      userId,
      metadata: metadata || {},
    };
    
    // Store in cache and persist
    const key = `${userId}:${app}`;
    permissionsCache.set(key, permission);
    await savePermissions();
    
    const humanMsg = getRandomGrantMessage(userId, app);
    
    console.log(`[Permissions] ✅ ${app} access granted for ${userId}`);
    return {
      success: true,
      message: `Permission granted for ${app}`,
      humanMessage: humanMsg,
      permission,
    };
    
  } catch (error: any) {
    console.error(`[Permissions] ❌ Grant error:`, error.message);
    return {
      success: false,
      message: `Failed to grant permission: ${error.message}`,
      humanMessage: `Oops, couldn't set up ${app} access: ${error.message}`,
    };
  }
}

/**
 * REVOKE PERMISSION - Remove app access
 */
export async function revokePermission(
  userId: string,
  app: string
): Promise<PermissionResponse> {
  try {
    const key = `${userId}:${app}`;
    const permission = permissionsCache.get(key);
    
    if (!permission) {
      return {
        success: false,
        message: `No permission found for ${app}`,
        humanMessage: `You haven't granted ${app} access yet`,
      };
    }
    
    permission.granted = false;
    permission.revokedAt = Date.now();
    
    permissionsCache.set(key, permission);
    await savePermissions();
    
    console.log(`[Permissions] 🚫 ${app} access revoked for ${userId}`);
    
    return {
      success: true,
      message: `Permission revoked for ${app}`,
      humanMessage: `All set—${app} access removed! 🔒`,
      permission,
    };
    
  } catch (error: any) {
    console.error(`[Permissions] ❌ Revoke error:`, error.message);
    return {
      success: false,
      message: `Failed to revoke: ${error.message}`,
      humanMessage: `Hmm, couldn't revoke ${app}: ${error.message}`,
    };
  }
}

/**
 * GET PERMISSION - Check if app access is granted
 */
export function getPermission(userId: string, app: string): Permission | null {
  const key = `${userId}:${app}`;
  const permission = permissionsCache.get(key);
  
  if (!permission || !permission.granted) {
    return null;
  }
  
  return permission;
}

/**
 * GET ALL PERMISSIONS - List all granted permissions for user
 */
export function getAllPermissions(userId: string): Permission[] {
  const userPermissions: Permission[] = [];
  
  for (const [key, permission] of permissionsCache.entries()) {
    if (key.startsWith(`${userId}:`) && permission.granted) {
      userPermissions.push(permission);
    }
  }
  
  return userPermissions;
}

/**
 * CHECK PERMISSION - Verify if user has granted access to app
 */
export function hasPermission(
  userId: string,
  app: string,
  requiredScopes: string[] = []
): { allowed: boolean; reason?: string } {
  const permission = getPermission(userId, app);
  
  if (!permission) {
    return {
      allowed: false,
      reason: `No permission granted for ${app}`,
    };
  }
  
  // Check scopes if required
  if (requiredScopes.length > 0) {
    const hasAllScopes = requiredScopes.every(scope => permission.scopes.includes(scope));
    
    if (!hasAllScopes) {
      return {
        allowed: false,
        reason: `Missing required scopes: ${requiredScopes.join(', ')}`,
      };
    }
  }
  
  return { allowed: true };
}

/**
 * GET DECRYPTED CREDENTIALS - For task execution
 */
export function getDecryptedCredentials(userId: string, app: string): any | null {
  const permission = getPermission(userId, app);
  
  if (!permission || !permission.credentials) {
    return null;
  }
  
  try {
    return decryptCredentials(permission.credentials);
  } catch (error: any) {
    console.error(`[Permissions] ❌ Decryption error:`, error.message);
    return null;
  }
}

/**
 * ENCRYPT CREDENTIALS - AES-256-CBC
 */
function encryptCredentials(credentials: any): { encrypted: string; iv: string } {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  const dataStr = JSON.stringify(credentials);
  let encrypted = cipher.update(dataStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
  };
}

/**
 * DECRYPT CREDENTIALS
 */
function decryptCredentials(encryptedData: { encrypted: string; iv: string }): any {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const iv = Buffer.from(encryptedData.iv, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

/**
 * SAVE PERMISSIONS - Persist to disk (encrypted)
 */
async function savePermissions(): Promise<void> {
  try {
    const data: any = {};
    
    for (const [key, permission] of permissionsCache.entries()) {
      data[key] = permission;
    }
    
    await fs.writeFile(PERMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error: any) {
    console.error(`[Permissions] ❌ Save error:`, error.message);
  }
}

/**
 * LOAD PERMISSIONS - Load from disk on startup
 */
export async function loadPermissions(): Promise<void> {
  try {
    const data = await fs.readFile(PERMISSIONS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    permissionsCache = new Map(Object.entries(parsed));
    console.log(`[Permissions] 📂 Loaded ${permissionsCache.size} permissions`);
    
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`[Permissions] 📂 No existing permissions file, starting fresh`);
    } else {
      console.error(`[Permissions] ❌ Load error:`, error.message);
    }
  }
}

/**
 * REQUEST PERMISSION - Ask user for approval (for UI)
 */
export function formatPermissionRequest(request: PermissionRequest): string {
  return `SecureClaw needs access to ${request.app}

Reason: ${request.reason}
Scopes: ${request.scopes.join(', ')}

Grant access? This will allow SecureClaw to:
${getScopesDescription(request.app, request.scopes)}

Credentials will be encrypted and stored securely.`;
}

/**
 * Get human-readable scope descriptions
 */
function getScopesDescription(app: string, scopes: string[]): string {
  const descriptions: Record<string, Record<string, string>> = {
    instagram: {
      read: '- View your posts and profile',
      write: '- Post photos and stories on your behalf',
      delete: '- Delete posts',
    },
    email: {
      read: '- Read your emails',
      write: '- Send emails on your behalf',
      delete: '- Delete emails',
    },
    twitter: {
      read: '- View your tweets and timeline',
      write: '- Post tweets on your behalf',
      delete: '- Delete tweets',
    },
  };
  
  const appDescs = descriptions[app.toLowerCase()] || {};
  
  return scopes
    .map(scope => appDescs[scope] || `- ${scope} access`)
    .join('\n');
}

/**
 * HUMAN-LIKE GRANT MESSAGES
 */
function getRandomGrantMessage(userName: string, app: string): string {
  const templates = [
    `All set, ${userName}! You've given me ${app} access—I'll keep it secure 🔐`,
    `Got it! ${app} is now linked for you, ${userName}. Let's do this! 🚀`,
    `${userName}, ${app} access granted! I'll use it wisely 💪`,
    `Awesome! ${app} is connected, ${userName}. Ready to roll! ✨`,
    `${userName}, locked in ${app} credentials—all encrypted and safe! 🔒`,
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Initialize permissions system on startup
 */
loadPermissions();

export default {
  grantPermission,
  revokePermission,
  getPermission,
  getAllPermissions,
  hasPermission,
  getDecryptedCredentials,
  formatPermissionRequest,
};
