/**
 * BROWSER MUTEX SYSTEM - Moltbot's Exact Implementation in TypeScript
 * 
 * Cherry-picked from Moltbot's browser skill with mutex + single-tab protocol
 * Ensures only ONE browser session runs at a time for safety
 * Adapted from Python to TypeScript with Puppeteer
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const LOCK_FILE = path.join(process.cwd(), '.browser_lock.json');
const STALE_LOCK_THRESHOLD_MS = 300000; // 5 minutes (300000ms) - Moltbot's threshold

/**
 * Moltbot's exact lock file format
 */
export interface MoltbotLock {
  label: string;
  startedAtMs: number;
}

/**
 * MOLTBOT'S ACQUIRE LOCK - Manual/Ad-hoc Mode
 * Adapted from Python snippet with stale handling and browser restart
 * 
 * Python original:
 * now = int(time.time() * 1000)
 * try:
 *   st = json.load(open(LOCK))
 *   age = now - int(st.get('startedAtMs', 0))
 *   if age < 300000:  # 5 min
 *     exit(3)
 *   else:
 *     os.system('pkill -f chrome')
 *     json.dump({'label': 'task', 'startedAtMs': now}, open(LOCK, 'w'))
 * except FileNotFoundError:
 *   json.dump({'label': 'task', 'startedAtMs': now}, open(LOCK, 'w'))
 */
export async function acquireMutex(
  label: string = 'browser_task',
  forceRestart: boolean = false
): Promise<{ acquired: boolean; message: string; age?: number }> {
  const now = Date.now();
  
  try {
    // Try to read existing lock
    const lockData = fsSync.readFileSync(LOCK_FILE, 'utf-8');
    const lock: MoltbotLock = JSON.parse(lockData);
    
    const age = now - lock.startedAtMs;
    
    // FRESH LOCK: Back off if less than 5 minutes old
    if (age < STALE_LOCK_THRESHOLD_MS && !forceRestart) {
      const ageSeconds = Math.floor(age / 1000);
      console.log(`[Moltbot Mutex] ⏳ Lock fresh (${ageSeconds}s old): "${lock.label}"`);
      
      return {
        acquired: false,
        message: `Hey Scot, browser busy with: ${lock.label}. Give me a sec! (${ageSeconds}s ago)`,
        age: ageSeconds,
      };
    }
    
    // STALE LOCK: Kill browser and restart
    console.warn(`[Moltbot Mutex] 🔄 Stale lock detected (${Math.floor(age / 1000)}s old), restarting browser...`);
    await killBrowser();
    
    // Claim lock
    const newLock: MoltbotLock = { label, startedAtMs: now };
    fsSync.writeFileSync(LOCK_FILE, JSON.stringify(newLock, null, 2), 'utf-8');
    
    console.log(`[Moltbot Mutex] 🔒 Lock acquired after restart: "${label}"`);
    return {
      acquired: true,
      message: `Browser locked for: ${label}`,
    };
    
  } catch (error: any) {
    // FileNotFoundError equivalent - no lock exists
    if (error.code === 'ENOENT') {
      // Create new lock
      const newLock: MoltbotLock = { label, startedAtMs: now };
      fsSync.writeFileSync(LOCK_FILE, JSON.stringify(newLock, null, 2), 'utf-8');
      
      console.log(`[Moltbot Mutex] 🔒 Lock acquired (no prior lock): "${label}"`);
      return {
        acquired: true,
        message: `Browser locked for: ${label}`,
      };
    }
    
    console.error(`[Moltbot Mutex] ❌ Error acquiring lock:`, error.message);
    return {
      acquired: false,
      message: `Oops, Scot—lock hiccup: ${error.message}`,
    };
  }
}

/**
 * MOLTBOT'S RELEASE LOCK - Delete lock file
 */
export async function releaseMutex(label: string = ''): Promise<void> {
  try {
    if (fsSync.existsSync(LOCK_FILE)) {
      const lock: MoltbotLock = JSON.parse(fsSync.readFileSync(LOCK_FILE, 'utf-8'));
      
      if (label && lock.label !== label) {
        console.warn(`[Moltbot Mutex] ⚠️  Attempted to release "${label}" but lock held by "${lock.label}"`);
        return;
      }
      
      fsSync.unlinkSync(LOCK_FILE);
      console.log(`[Moltbot Mutex] 🔓 Lock released: "${lock.label}"`);
    }
  } catch (error: any) {
    console.error(`[Moltbot Mutex] ❌ Error releasing lock:`, error.message);
  }
}

/**
 * MOLTBOT'S CRON CHECK - Back off if fresh lock
 * Returns true if should proceed, false if should back off
 */
export async function checkLockForCron(cronLabel: string): Promise<boolean> {
  const now = Date.now();
  
  try {
    const lockData = fsSync.readFileSync(LOCK_FILE, 'utf-8');
    const lock: MoltbotLock = JSON.parse(lockData);
    
    const age = now - lock.startedAtMs;
    
    // FRESH LOCK: Back off (exit 3 in Moltbot's Python)
    if (age < STALE_LOCK_THRESHOLD_MS) {
      console.log(`[Moltbot Cron] 🛑 Lock fresh (${Math.floor(age / 1000)}s), backing off`);
      return false;
    }
    
    // STALE LOCK: Kill and claim
    console.warn(`[Moltbot Cron] 🔄 Stale lock, claiming for: ${cronLabel}`);
    await killBrowser();
    
    const newLock: MoltbotLock = { label: cronLabel, startedAtMs: now };
    fsSync.writeFileSync(LOCK_FILE, JSON.stringify(newLock, null, 2), 'utf-8');
    
    return true;
    
  } catch (error: any) {
    // FileNotFoundError - no lock, claim it
    if (error.code === 'ENOENT') {
      const newLock: MoltbotLock = { label: cronLabel, startedAtMs: now };
      fsSync.writeFileSync(LOCK_FILE, JSON.stringify(newLock, null, 2), 'utf-8');
      console.log(`[Moltbot Cron] 🔒 Lock claimed: ${cronLabel}`);
      return true;
    }
    
    console.error(`[Moltbot Cron] ❌ Error checking lock:`, error.message);
    return false;
  }
}

/**
 * Kill browser processes (Moltbot's pkill -f chrome)
 */
async function killBrowser(): Promise<void> {
  try {
    if (process.platform === 'linux' || process.platform === 'darwin') {
      await execAsync('pkill -f chrome || pkill -f chromium || true');
      console.log(`[Moltbot] 💀 Killed browser processes`);
    } else if (process.platform === 'win32') {
      await execAsync('taskkill /F /IM chrome.exe /T || taskkill /F /IM chromium.exe /T || exit 0');
      console.log(`[Moltbot] 💀 Killed browser processes (Windows)`);
    }
    
    // Wait for processes to die
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error: any) {
    console.warn(`[Moltbot] ⚠️  Browser kill warning:`, error.message);
  }
}

/**
 * Check current lock status
 */
export async function getLockStatus(): Promise<{ locked: boolean; lock?: MoltbotLock; age?: number }> {
  try {
    const lockData = fsSync.readFileSync(LOCK_FILE, 'utf-8');
    const lock: MoltbotLock = JSON.parse(lockData);
    
    const age = Date.now() - lock.startedAtMs;
    const isStale = age >= STALE_LOCK_THRESHOLD_MS;
    
    return {
      locked: !isStale,
      lock,
      age: Math.floor(age / 1000),
    };
  } catch (error) {
    return { locked: false };
  }
}

/**
 * Auto-cleanup on process exit (Moltbot-style)
 */
process.on('exit', () => {
  try {
    if (fsSync.existsSync(LOCK_FILE)) {
      fsSync.unlinkSync(LOCK_FILE);
      console.log(`[Moltbot Mutex] 🔓 Auto-released lock on exit`);
    }
  } catch (error) {
    // Ignore errors on exit
  }
});

process.on('SIGINT', () => {
  try {
    if (fsSync.existsSync(LOCK_FILE)) {
      fsSync.unlinkSync(LOCK_FILE);
    }
  } catch (error) {
    // Ignore
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  try {
    if (fsSync.existsSync(LOCK_FILE)) {
      fsSync.unlinkSync(LOCK_FILE);
    }
  } catch (error) {
    // Ignore
  }
  process.exit(0);
});
