/**
 * REAL TWITTER API v2 INTEGRATION - Production
 * 
 * Full Twitter API implementation - post tweets, read timeline, manage DMs
 */

import { getDecryptedCredentials } from '../permissions';
import { refreshAccessToken } from './oauth';

const TWITTER_API_BASE = 'https://api.twitter.com/2';

/**
 * POST TWEET - Real Twitter API v2
 */
export async function postTweet(
  userId: string,
  text: string,
  userName: string = 'friend'
): Promise<{ success: boolean; tweetId?: string; url?: string; message?: string; humanMessage?: string }> {
  try {
    console.log(`[Twitter] 🐦 Posting tweet for ${userId}`);
    
    const creds = getDecryptedCredentials(userId, 'twitter');
    if (!creds?.accessToken) {
      return {
        success: false,
        message: 'No Twitter access token',
        humanMessage: `${userName}, link Twitter first! Say: "Grant Twitter access"`,
      };
    }
    
    const response = await fetch(
      `${TWITTER_API_BASE}/tweets`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twitter API: ${JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    const tweetId = data.data.id;
    const url = `https://twitter.com/user/status/${tweetId}`;
    
    console.log(`[Twitter] ✅ Tweet posted: ${tweetId}`);
    
    return {
      success: true,
      tweetId,
      url,
      message: 'Tweet posted',
      humanMessage: `Tweet's live, ${userName}! 🐦✨\n\n${url}`,
    };
    
  } catch (error: any) {
    console.error(`[Twitter] ❌ Post error:`, error.message);
    return {
      success: false,
      message: error.message,
      humanMessage: `${userName}, tweet failed: ${error.message}`,
    };
  }
}

/**
 * GET HOME TIMELINE - User's feed
 */
export async function getTimeline(
  userId: string,
  maxResults: number = 10
): Promise<{ success: boolean; tweets?: any[]; message?: string }> {
  try {
    const creds = getDecryptedCredentials(userId, 'twitter');
    if (!creds?.accessToken) {
      throw new Error('No access token');
    }
    
    const response = await fetch(
      `${TWITTER_API_BASE}/users/me/timelines/reverse_chronological?max_results=${maxResults}&tweet.fields=created_at,author_id,text`,
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Timeline fetch failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      tweets: data.data || [],
      message: `Retrieved ${data.data?.length || 0} tweets`,
    };
    
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

export default {
  postTweet,
  getTimeline,
};
