/**
 * MOLTBOT BROWSER SKILL - Full Puppeteer Integration
 * 
 * Safe browser automation with single-tab protocol and human-like responses
 * Enables real execution power for AGI-tier autonomy
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { acquireMutex, releaseMutex, getLockStatus } from './browser_mutex';

let globalBrowser: Browser | null = null;
let globalPage: Page | null = null;

export interface BrowserTaskResult {
  success: boolean;
  data?: any;
  message: string;
  humanMessage?: string; // Casual, empathetic response for user
  error?: string;
}

/**
 * RESTART BROWSER - Launch fresh Puppeteer instance
 */
export async function restartBrowser(): Promise<{ browser: Browser; page: Page }> {
  try {
    // Close existing if any
    if (globalBrowser) {
      await globalBrowser.close().catch(() => {});
      globalBrowser = null;
      globalPage = null;
    }
    
    console.log(`[Browser Skill] 🚀 Launching browser...`);
    
    // Launch headless Chrome
    const browser = await puppeteer.launch({
      headless: true, // Run in background
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Important for Replit
      ],
    });
    
    const page = await browser.newPage();
    
    // Set reasonable defaults
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    globalBrowser = browser;
    globalPage = page;
    
    console.log(`[Browser Skill] ✅ Browser ready`);
    return { browser, page };
    
  } catch (error: any) {
    console.error(`[Browser Skill] ❌ Browser launch failed:`, error.message);
    throw new Error(`Browser hiccup: ${error.message}`);
  }
}

/**
 * ENFORCE SINGLE TAB - Moltbot's safety protocol
 * Closes all tabs except the active one
 */
export async function enforceSingleTab(browser: Browser): Promise<void> {
  try {
    const pages = await browser.pages();
    
    if (pages.length > 1) {
      console.warn(`[Browser Skill] 🔒 Multiple tabs detected (${pages.length}), enforcing single-tab protocol`);
      
      // Keep only the last page (active one)
      for (let i = 0; i < pages.length - 1; i++) {
        await pages[i].close().catch(() => {});
      }
      
      globalPage = pages[pages.length - 1];
      console.log(`[Browser Skill] ✅ Single-tab enforced`);
    }
  } catch (error: any) {
    console.warn(`[Browser Skill] ⚠️  Single-tab enforcement warning:`, error.message);
  }
}

/**
 * VERIFY REPLY CONTEXT - DOM safety checks (Moltbot-style)
 * Ensures we're in a safe context before interacting
 */
export async function verifyReplyContext(page: Page, expectedContext?: string): Promise<boolean> {
  try {
    // Check basic page state
    const url = page.url();
    const title = await page.title();
    
    // Verify not on error page
    if (url.includes('chrome-error://') || url.includes('about:blank')) {
      console.warn(`[Browser Skill] ⚠️  Invalid context: ${url}`);
      return false;
    }
    
    // Verify page loaded
    if (!title && url === 'about:blank') {
      console.warn(`[Browser Skill] ⚠️  Page not loaded`);
      return false;
    }
    
    // Check for specific context if provided (e.g., Twitter/X)
    if (expectedContext) {
      if (expectedContext === 'twitter' || expectedContext === 'x') {
        const isTwitter = url.includes('twitter.com') || url.includes('x.com');
        if (!isTwitter) {
          console.warn(`[Browser Skill] ⚠️  Expected Twitter/X context, got: ${url}`);
          return false;
        }
      }
    }
    
    console.log(`[Browser Skill] ✅ Context verified: ${title} (${url})`);
    return true;
    
  } catch (error: any) {
    console.error(`[Browser Skill] ❌ Context verification failed:`, error.message);
    return false;
  }
}

/**
 * EXECUTE BROWSER TASK - Main entry point with mutex and safety
 * 
 * @param taskLabel - Human-readable task name
 * @param taskFn - Async function that uses browser/page
 * @param userName - User's name for personalized responses (e.g., "Scot")
 * @param location - User's location for context (e.g., "LA")
 */
export async function executeBrowserTask<T>(
  taskLabel: string,
  taskFn: (browser: Browser, page: Page) => Promise<T>,
  options: {
    userName?: string;
    location?: string;
    retries?: number;
  } = {}
): Promise<BrowserTaskResult> {
  const { userName = 'friend', location = '', retries = 3 } = options;
  
  // Acquire mutex lock
  const lockResult = await acquireMutex(taskLabel);
  
  if (!lockResult.acquired) {
    return {
      success: false,
      message: lockResult.message,
      humanMessage: `Hey ${userName}, browser's tied up right now (${lockResult.age}s into something). ${getRandomBackoffMessage()}`,
    };
  }
  
  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt < retries) {
    attempt++;
    
    try {
      console.log(`[Browser Skill] 🎯 Executing: "${taskLabel}" (attempt ${attempt}/${retries})`);
      
      // Launch/restart browser
      const { browser, page } = await restartBrowser();
      
      // Enforce single-tab protocol
      await enforceSingleTab(browser);
      
      // Execute user's task
      const result = await taskFn(browser, page);
      
      // Success! Release lock
      await releaseMutex(taskLabel);
      
      return {
        success: true,
        data: result,
        message: `Task completed: ${taskLabel}`,
        humanMessage: getRandomSuccessMessage(userName, taskLabel, location),
      };
      
    } catch (error: any) {
      lastError = error;
      console.error(`[Browser Skill] ❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt < retries) {
        const waitTime = 1000 * attempt; // Exponential backoff
        console.log(`[Browser Skill] 🔄 Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // All retries failed - release lock and return error
  await releaseMutex(taskLabel);
  
  return {
    success: false,
    message: `Task failed after ${retries} attempts: ${lastError?.message}`,
    humanMessage: getRandomErrorMessage(userName, taskLabel, lastError?.message || 'unknown error'),
    error: lastError?.message,
  };
}

/**
 * WEB SEARCH - Autonomous browser-based search
 */
export async function webSearch(query: string, options: { userName?: string } = {}): Promise<BrowserTaskResult> {
  return await executeBrowserTask(
    `web_search: ${query}`,
    async (browser, page) => {
      // Go to Google
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      
      // Verify context
      if (!await verifyReplyContext(page)) {
        throw new Error('Search page verification failed');
      }
      
      // Extract search results
      const results = await page.evaluate(() => {
        const items: Array<{ title: string; snippet: string; url: string }> = [];
        const resultElements = document.querySelectorAll('div.g');
        
        resultElements.forEach((el, index) => {
          if (index >= 5) return; // Top 5 results
          
          const titleEl = el.querySelector('h3');
          const snippetEl = el.querySelector('.VwiC3b');
          const linkEl = el.querySelector('a');
          
          if (titleEl && linkEl) {
            items.push({
              title: titleEl.textContent || '',
              snippet: snippetEl?.textContent || '',
              url: linkEl.href || '',
            });
          }
        });
        
        return items;
      });
      
      console.log(`[Browser Skill] 🔍 Found ${results.length} search results for: ${query}`);
      return results;
    },
    options
  );
}

/**
 * SCRAPE URL - Extract content from any webpage
 */
export async function scrapeUrl(url: string, options: { userName?: string; selector?: string } = {}): Promise<BrowserTaskResult> {
  const { selector } = options;
  
  return await executeBrowserTask(
    `scrape: ${url}`,
    async (browser, page) => {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      
      if (!await verifyReplyContext(page)) {
        throw new Error('Page verification failed');
      }
      
      // Extract content
      const content = await page.evaluate((sel) => {
        if (sel) {
          const element = document.querySelector(sel);
          return element?.textContent || '';
        }
        
        // Get main content
        return document.body.textContent || '';
      }, selector);
      
      const title = await page.title();
      
      return {
        url,
        title,
        content: content.slice(0, 5000), // Limit size
      };
    },
    options
  );
}

/**
 * HUMAN-LIKE RESPONSE GENERATORS - Casual, empathetic, personalized
 */

function getRandomSuccessMessage(userName: string, task: string, location: string): string {
  const locationPrefix = location ? ` from ${location}` : '';
  
  const templates = [
    `Nailed it, ${userName}! Got your ${task} all sorted${locationPrefix} 🎯`,
    `Done and done, ${userName}! ${task} is in the books${locationPrefix} ✨`,
    `Hey ${userName}, locked in that ${task}${locationPrefix}—you're all set! 🚀`,
    `${userName}, crushed that ${task}${locationPrefix}! What's next? 💪`,
    `All yours, ${userName}! ${task} complete${locationPrefix} 🎉`,
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

function getRandomErrorMessage(userName: string, task: string, error: string): string {
  const templates = [
    `Oops, ${userName}—hit a snag on ${task}. ${error}. Retrying for you! 🔧`,
    `Ugh, ${userName}, browser hiccup on ${task}: ${error}. On it! 💪`,
    `${userName}, ran into ${error} on ${task}. Let me try another way... 🔄`,
    `Sorry ${userName}, ${task} got messy: ${error}. Fixing it now! 🛠️`,
    `${userName}, browser got cranky: ${error}. Giving it another shot! 🎯`,
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

function getRandomBackoffMessage(): string {
  const messages = [
    "I'll circle back in a sec!",
    "Hang tight, almost done!",
    "Just wrapping something up!",
    "Browser's doing its thing—back soon!",
    "One task at a time—be right there!",
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Cleanup on exit
 */
async function cleanup() {
  try {
    if (globalBrowser) {
      await globalBrowser.close();
      globalBrowser = null;
      globalPage = null;
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

process.on('exit', () => { cleanup(); });
process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });
