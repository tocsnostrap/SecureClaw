/**
 * PUSH NOTIFICATIONS - Firebase FCM Integration
 * 
 * Send push notifications to iOS/Android devices
 * Event-based notifications for task completion, alerts, autonomous actions
 */

import * as admin from 'firebase-admin';

let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebase(): void {
  if (firebaseInitialized) {
    console.log('[Firebase] Already initialized');
    return;
  }

  try {
    // Check if service account credentials are available
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountPath) {
      // Load from file
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[Firebase] ✅ Initialized from file');
    } else if (serviceAccountJson) {
      // Load from environment variable (JSON string)
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[Firebase] ✅ Initialized from env variable');
    } else {
      console.warn('[Firebase] ⚠️  No credentials found. Push notifications disabled.');
      console.warn('[Firebase] Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON');
      return;
    }

    firebaseInitialized = true;
  } catch (error: any) {
    console.error('[Firebase] ❌ Initialization error:', error.message);
    console.warn('[Firebase] Push notifications will be disabled');
  }
}

/**
 * Send push notification to a device
 */
export async function sendPushNotification(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  userName: string = 'friend'
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!firebaseInitialized) {
    console.warn('[Firebase] Not initialized, skipping push notification');
    return {
      success: false,
      error: 'Firebase not initialized',
    };
  }

  try {
    console.log(`[Push] 📲 Sending notification to device: ${title}`);

    const message: admin.messaging.Message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      token: deviceToken,
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'secureclaw_default',
        },
      },
    };

    const response = await admin.messaging().send(message);

    console.log(`[Push] ✅ Notification sent: ${response}`);

    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    console.error(`[Push] ❌ Error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send push to multiple devices (multicast)
 */
export async function sendMulticastPush(
  deviceTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; successCount: number; failureCount: number; errors?: string[] }> {
  if (!firebaseInitialized) {
    return {
      success: false,
      successCount: 0,
      failureCount: deviceTokens.length,
      errors: ['Firebase not initialized'],
    };
  }

  try {
    console.log(`[Push] 📲 Sending multicast to ${deviceTokens.length} devices`);

    const message: admin.messaging.MulticastMessage = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens: deviceTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`[Push] ✅ Multicast: ${response.successCount} sent, ${response.failureCount} failed`);

    const errors = response.responses
      .filter((r) => !r.success)
      .map((r) => r.error?.message || 'Unknown error');

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error(`[Push] ❌ Multicast error:`, error.message);
    return {
      success: false,
      successCount: 0,
      failureCount: deviceTokens.length,
      errors: [error.message],
    };
  }
}

/**
 * Send event-based notification (task completion, alert, etc.)
 */
export async function notifyEvent(
  deviceToken: string,
  event: 'task_complete' | 'task_failed' | 'alert' | 'reminder' | 'autonomous_action',
  message: string,
  taskId?: string,
  userName: string = 'Scot'
): Promise<{ success: boolean; error?: string }> {
  const titles: Record<string, string> = {
    task_complete: `✅ Task Complete, ${userName}!`,
    task_failed: `⚠️ Task Failed`,
    alert: `🔔 Alert from SecureClaw`,
    reminder: `⏰ Reminder`,
    autonomous_action: `🤖 SecureClaw took action`,
  };

  const title = titles[event] || 'SecureClaw Notification';

  const data: Record<string, string> = {
    event,
    timestamp: Date.now().toString(),
  };

  if (taskId) {
    data.taskId = taskId;
  }

  return await sendPushNotification(deviceToken, title, message, data, userName);
}

/**
 * Test push notification (for setup verification)
 */
export async function sendTestPush(
  deviceToken: string,
  userName: string = 'Scot'
): Promise<{ success: boolean; error?: string }> {
  return await sendPushNotification(
    deviceToken,
    `Hey ${userName}! 🎉`,
    `SecureClaw push notifications are working perfectly! You'll get instant updates on all your tasks.`,
    { test: 'true', timestamp: Date.now().toString() },
    userName
  );
}

// Device token storage (in-memory, would be DB in production)
const deviceTokens = new Map<string, string>();

/**
 * Register device token for user
 */
export function registerDeviceToken(userId: string, token: string): void {
  deviceTokens.set(userId, token);
  console.log(`[Push] 📱 Device token registered for ${userId}`);
}

/**
 * Get device token for user
 */
export function getDeviceToken(userId: string): string | undefined {
  return deviceTokens.get(userId);
}

/**
 * Remove device token
 */
export function unregisterDeviceToken(userId: string): void {
  deviceTokens.delete(userId);
  console.log(`[Push] 🚫 Device token unregistered for ${userId}`);
}

// Auto-initialize on import
initializeFirebase();

export default {
  initializeFirebase,
  sendPushNotification,
  sendMulticastPush,
  notifyEvent,
  sendTestPush,
  registerDeviceToken,
  getDeviceToken,
  unregisterDeviceToken,
};
