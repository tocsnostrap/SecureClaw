/**
 * REAL GMAIL API INTEGRATION - Production
 * 
 * Full Gmail API with OAuth 2.0, send/receive, search, labels
 */

import { getDecryptedCredentials } from '../permissions';
import { refreshAccessToken } from './oauth';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  from?: string;
  subject?: string;
  unread: boolean;
}

/**
 * LIST MESSAGES - Scan inbox
 */
export async function listMessages(
  userId: string,
  query: string = '',
  maxResults: number = 10
): Promise<{ success: boolean; messages?: GmailMessage[]; message?: string; humanMessage?: string }> {
  try {
    console.log(`[Gmail] 📧 Listing messages for ${userId}, query: "${query}"`);
    
    const creds = getDecryptedCredentials(userId, 'gmail');
    if (!creds?.accessToken) {
      return {
        success: false,
        message: 'No Gmail access token',
        humanMessage: `Link Gmail first! Say: "Grant email access"`,
      };
    }
    
    // Build query params
    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      q: query || 'is:unread', // Default: unread messages
    });
    
    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/messages?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try refresh
        const refreshed = await refreshAccessToken('gmail', creds.refreshToken);
        if (refreshed.success) {
          // Retry with new token
          return listMessages(userId, query, maxResults);
        }
      }
      throw new Error(`Gmail API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const messageIds = data.messages || [];
    
    // Fetch full message details
    const messages: GmailMessage[] = [];
    
    for (const msg of messageIds.slice(0, maxResults)) {
      const msgResponse = await fetch(
        `${GMAIL_API_BASE}/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        {
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
          },
        }
      );
      
      if (msgResponse.ok) {
        const msgData = await msgResponse.json();
        
        const headers = msgData.payload?.headers || [];
        const from = headers.find((h: any) => h.name === 'From')?.value || '';
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
        
        messages.push({
          id: msgData.id,
          threadId: msgData.threadId,
          snippet: msgData.snippet,
          internalDate: msgData.internalDate,
          from,
          subject,
          unread: msgData.labelIds?.includes('UNREAD') || false,
        });
      }
    }
    
    console.log(`[Gmail] ✅ Retrieved ${messages.length} messages`);
    
    return {
      success: true,
      messages,
      message: `Found ${messages.length} messages`,
      humanMessage: `Found ${messages.length} emails! 📬`,
    };
    
  } catch (error: any) {
    console.error(`[Gmail] ❌ List error:`, error.message);
    return {
      success: false,
      message: error.message,
      humanMessage: `Email scan failed: ${error.message}`,
    };
  }
}

/**
 * SEND EMAIL - Real Gmail API
 */
export async function sendEmail(
  userId: string,
  to: string,
  subject: string,
  body: string,
  userName: string = 'friend'
): Promise<{ success: boolean; messageId?: string; message?: string; humanMessage?: string }> {
  try {
    console.log(`[Gmail] 📤 Sending email to: ${to}`);
    
    const creds = getDecryptedCredentials(userId, 'gmail');
    if (!creds?.accessToken) {
      throw new Error('No access token');
    }
    
    // Create RFC 2822 formatted message
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');
    
    // Base64url encode
    const encodedMessage = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const response = await fetch(
      `${GMAIL_API_BASE}/users/me/messages/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedMessage,
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Send failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log(`[Gmail] ✅ Email sent: ${data.id}`);
    
    return {
      success: true,
      messageId: data.id,
      message: `Email sent to ${to}`,
      humanMessage: `Sent, ${userName}! Email to ${to} is on its way 🚀`,
    };
    
  } catch (error: any) {
    console.error(`[Gmail] ❌ Send error:`, error.message);
    return {
      success: false,
      message: error.message,
      humanMessage: `${userName}, email failed: ${error.message}`,
    };
  }
}

/**
 * SEARCH EMAILS - Query inbox
 */
export async function searchEmails(
  userId: string,
  query: string
): Promise<{ success: boolean; messages?: GmailMessage[]; count?: number }> {
  return listMessages(userId, query, 20);
}

export default {
  listMessages,
  sendEmail,
  searchEmails,
};
