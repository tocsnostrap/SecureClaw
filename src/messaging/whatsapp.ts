/**
 * WHATSAPP INTEGRATION - Twilio API
 * 
 * Send and receive WhatsApp messages via Twilio
 * Supports bidirectional messaging and autonomous notifications
 */

import twilio from 'twilio';

let twilioClient: twilio.Twilio | null = null;
let twilioInitialized = false;

// Message handler storage
type MessageHandler = (from: string, body: string) => Promise<void>;
let messageHandler: MessageHandler | null = null;

/**
 * Initialize Twilio client
 */
export function initializeTwilio(): void {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.warn('[WhatsApp] ⚠️  Twilio credentials not set. WhatsApp integration disabled.');
    console.warn('[WhatsApp] Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    return;
  }

  try {
    twilioClient = twilio(accountSid, authToken);
    twilioInitialized = true;
    console.log('[WhatsApp] ✅ Twilio client initialized');
  } catch (error: any) {
    console.error('[WhatsApp] ❌ Initialization error:', error.message);
  }
}

/**
 * Send WhatsApp message
 */
export async function sendWhatsAppMessage(
  to: string, // Phone number in format: whatsapp:+1234567890
  message: string,
  mediaUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!twilioClient || !twilioInitialized) {
    return {
      success: false,
      error: 'Twilio not initialized',
    };
  }

  try {
    const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Twilio sandbox

    console.log(`[WhatsApp] 📤 Sending message to ${to}`);

    const messageOptions: any = {
      from,
      to,
      body: message,
    };

    if (mediaUrl) {
      messageOptions.mediaUrl = [mediaUrl];
    }

    const result = await twilioClient.messages.create(messageOptions);

    console.log(`[WhatsApp] ✅ Message sent: ${result.sid}`);

    return {
      success: true,
      messageId: result.sid,
    };
  } catch (error: any) {
    console.error(`[WhatsApp] ❌ Send error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Handle incoming WhatsApp message (webhook)
 */
export function handleIncomingMessage(handler: MessageHandler): void {
  messageHandler = handler;
  console.log('[WhatsApp] 📥 Message handler registered');
}

/**
 * Process incoming webhook (call from Express route)
 */
export async function processIncomingWebhook(
  from: string,
  body: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    console.log(`[WhatsApp] 📨 Incoming message from ${from}: ${body}`);

    if (!messageHandler) {
      console.warn('[WhatsApp] ⚠️  No message handler registered');
      return {
        success: false,
        error: 'No message handler',
      };
    }

    await messageHandler(from, body);

    return {
      success: true,
      response: 'Message processed',
    };
  } catch (error: any) {
    console.error(`[WhatsApp] ❌ Webhook error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send autonomous notification to WhatsApp
 */
export async function notifyWhatsApp(
  to: string,
  event: string,
  message: string,
  userName: string = 'friend'
): Promise<{ success: boolean; error?: string }> {
  const emoji: Record<string, string> = {
    task_complete: '✅',
    task_failed: '⚠️',
    alert: '🔔',
    reminder: '⏰',
    autonomous_action: '🤖',
  };

  const icon = emoji[event] || '📢';
  const formattedMessage = `${icon} *${event.replace(/_/g, ' ').toUpperCase()}*\n\n${message}\n\n_- SecureClaw_`;

  return await sendWhatsAppMessage(to, formattedMessage);
}

/**
 * Validate Twilio webhook signature (security)
 */
export function validateWebhook(
  signature: string,
  url: string,
  params: any
): boolean {
  if (!twilioClient) return false;

  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * Format phone number for WhatsApp
 */
export function formatWhatsAppNumber(phoneNumber: string): string {
  // Add whatsapp: prefix if not present
  if (!phoneNumber.startsWith('whatsapp:')) {
    phoneNumber = `whatsapp:${phoneNumber}`;
  }

  // Ensure + prefix for international format
  if (!phoneNumber.includes('+')) {
    phoneNumber = phoneNumber.replace('whatsapp:', 'whatsapp:+');
  }

  return phoneNumber;
}

// Auto-initialize
initializeTwilio();

export default {
  initializeTwilio,
  sendWhatsAppMessage,
  handleIncomingMessage,
  processIncomingWebhook,
  notifyWhatsApp,
  validateWebhook,
  formatWhatsAppNumber,
};
