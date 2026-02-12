/**
 * TELEGRAM INTEGRATION - Bidirectional Messaging
 * 
 * Bot receives messages from Telegram and sends responses
 * Supports commands, autonomous notifications, and conversational AI
 */

import { Telegraf, Context } from 'telegraf';
import { routeToAgent } from '../agents/agents';
import { notifyEvent, getDeviceToken } from '../notifications/push';

let bot: Telegraf | null = null;
let botInitialized = false;

// User session storage (would be DB in production)
const userSessions = new Map<number, { userId: string; history: any[] }>();

/**
 * Initialize Telegram bot
 */
export function initializeTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn('[Telegram] ⚠️  TELEGRAM_BOT_TOKEN not set. Telegram integration disabled.');
    return;
  }

  try {
    bot = new Telegraf(token);

    // Start command
    bot.command('start', async (ctx: Context) => {
      const userName = ctx.from?.first_name || 'friend';
      await ctx.reply(
        `Hey ${userName}! 👋 I'm SecureClaw, your autonomous AI assistant.\n\n` +
        `I can help you with:\n` +
        `• 🔗 Link apps (Instagram, Gmail, Twitter)\n` +
        `• 📸 Post to social media\n` +
        `• 📧 Manage emails\n` +
        `• 🔍 Web search and research\n` +
        `• ⏰ Schedule tasks and reminders\n` +
        `• 🤖 Autonomous background tasks\n\n` +
        `Just chat with me naturally! Type /help for commands.`
      );
    });

    // Help command
    bot.command('help', async (ctx: Context) => {
      await ctx.reply(
        `🤖 **SecureClaw Commands**\n\n` +
        `/start - Start conversation\n` +
        `/help - Show this help\n` +
        `/link - Link an app (Instagram, Gmail, Twitter)\n` +
        `/status - Check system status\n` +
        `/tasks - View active tasks\n` +
        `/clear - Clear chat history\n\n` +
        `Or just chat with me naturally!`,
        { parse_mode: 'Markdown' }
      );
    });

    // Link command
    bot.command('link', async (ctx: Context) => {
      await ctx.reply(
        `🔗 **Link an App**\n\n` +
        `Choose an app to link:\n` +
        `• Instagram - Say "link Instagram"\n` +
        `• Gmail - Say "link Gmail"\n` +
        `• Twitter - Say "link Twitter"\n\n` +
        `I'll guide you through the setup!`,
        { parse_mode: 'Markdown' }
      );
    });

    // Status command
    bot.command('status', async (ctx: Context) => {
      const chatId = ctx.chat?.id;
      const session = chatId ? userSessions.get(chatId) : null;
      const hasSession = !!session;

      await ctx.reply(
        `✅ **System Status**\n\n` +
        `Server: Online 🟢\n` +
        `Session: ${hasSession ? 'Active' : 'Not started'}\n` +
        `Telegram Bot: Connected ✅\n` +
        `AI: Grok-4 (xAI) 🧠\n\n` +
        `All systems operational!`,
        { parse_mode: 'Markdown' }
      );
    });

    // Clear command
    bot.command('clear', async (ctx: Context) => {
      const chatId = ctx.chat?.id;
      if (chatId) {
        userSessions.delete(chatId);
        await ctx.reply('🧹 Chat history cleared!');
      }
    });

    // Handle all text messages
    bot.on('text', async (ctx: Context) => {
      try {
        const chatId = ctx.chat?.id;
        const text = (ctx.message as any)?.text;
        const userName = ctx.from?.first_name || 'friend';

        if (!chatId || !text) return;

        // Show typing indicator
        await ctx.sendChatAction('typing');

        // Get or create session
        let session = userSessions.get(chatId);
        if (!session) {
          session = {
            userId: `telegram_${chatId}`,
            history: [],
          };
          userSessions.set(chatId, session);
        }

        // Add user message to history
        session.history.push({
          role: 'user',
          content: text,
        });

        // Keep history manageable (last 10 messages)
        if (session.history.length > 10) {
          session.history = session.history.slice(-10);
        }

        console.log(`[Telegram] 📨 Message from ${userName} (${chatId}): ${text}`);

        // Route to AI agent
        const response = await routeToAgent(session.history, 'orchestrator');

        // Add assistant response to history
        session.history.push({
          role: 'assistant',
          content: response.response,
        });

        // Send response (split if too long)
        const maxLength = 4096;
        if (response.response.length <= maxLength) {
          await ctx.reply(response.response);
        } else {
          // Split into chunks
          const chunks = response.response.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
          for (const chunk of chunks) {
            await ctx.reply(chunk);
            await new Promise((resolve) => setTimeout(resolve, 500)); // Delay between chunks
          }
        }

        console.log(`[Telegram] 📤 Response sent to ${userName}`);
      } catch (error: any) {
        console.error(`[Telegram] ❌ Error:`, error.message);
        await ctx.reply(`Sorry, I encountered an error: ${error.message}`);
      }
    });

    // Handle errors
    bot.catch((err: any, ctx: Context) => {
      console.error(`[Telegram] ❌ Bot error:`, err);
    });

    // Start bot
    bot.launch();
    botInitialized = true;

    console.log('[Telegram] ✅ Bot started successfully!');
    console.log('[Telegram] Users can now message your bot on Telegram');
  } catch (error: any) {
    console.error('[Telegram] ❌ Initialization error:', error.message);
  }
}

/**
 * Send message to Telegram user
 */
export async function sendTelegramMessage(
  chatId: number,
  message: string,
  options?: any
): Promise<{ success: boolean; error?: string }> {
  if (!bot || !botInitialized) {
    return {
      success: false,
      error: 'Telegram bot not initialized',
    };
  }

  try {
    await bot.telegram.sendMessage(chatId, message, options);
    console.log(`[Telegram] 📤 Message sent to ${chatId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Telegram] ❌ Send error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send autonomous notification to Telegram
 */
export async function notifyTelegram(
  chatId: number,
  event: string,
  message: string
): Promise<void> {
  const emoji: Record<string, string> = {
    task_complete: '✅',
    task_failed: '⚠️',
    alert: '🔔',
    reminder: '⏰',
    autonomous_action: '🤖',
  };

  const icon = emoji[event] || '📢';
  await sendTelegramMessage(chatId, `${icon} **${event.replace(/_/g, ' ').toUpperCase()}**\n\n${message}`, {
    parse_mode: 'Markdown',
  });
}

/**
 * Stop bot (for cleanup)
 */
export function stopTelegramBot(): void {
  if (bot) {
    bot.stop();
    console.log('[Telegram] 🛑 Bot stopped');
  }
}

// Graceful shutdown
process.once('SIGINT', stopTelegramBot);
process.once('SIGTERM', stopTelegramBot);

export default {
  initializeTelegramBot,
  sendTelegramMessage,
  notifyTelegram,
  stopTelegramBot,
};
