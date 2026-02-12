/**
 * REAL OAUTH INTEGRATION - Production-Grade
 * 
 * Instagram Graph API, Gmail API, Twitter API v2
 * Full OAuth 2.0 flows with PKCE, token refresh, scope management
 */

import crypto from 'crypto';
import { grantPermission } from '../permissions';

// OAuth Configuration for each provider
export const OAUTH_CONFIGS = {
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    apiBase: 'https://graph.instagram.com',
    scopes: ['user_profile', 'user_media', 'instagram_basic', 'instagram_content_publish'],
    clientId: process.env.INSTAGRAM_CLIENT_ID || '',
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || '',
  },
  gmail: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    apiBase: 'https://www.googleapis.com/gmail/v1',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    apiBase: 'https://api.twitter.com/2',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    clientId: process.env.TWITTER_CLIENT_ID || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
  },
};

interface OAuthSession {
  state: string;
  codeVerifier: string;
  app: string;
  userId: string;
  redirectUri: string;
  createdAt: number;
}

const oauthSessions = new Map<string, OAuthSession>();

/**
 * Generate PKCE challenge for OAuth 2.0
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}

/**
 * START OAUTH FLOW - Generate authorization URL
 */
export function startOAuthFlow(
  app: 'instagram' | 'gmail' | 'twitter',
  userId: string,
  redirectUri: string
): { authUrl: string; state: string } {
  const config = OAUTH_CONFIGS[app];
  
  if (!config.clientId) {
    throw new Error(`${app} OAuth not configured. Set ${app.toUpperCase()}_CLIENT_ID in environment.`);
  }
  
  const state = crypto.randomBytes(16).toString('hex');
  const { codeVerifier, codeChallenge } = generatePKCE();
  
  // Store session
  oauthSessions.set(state, {
    state,
    codeVerifier,
    app,
    userId,
    redirectUri,
    createdAt: Date.now(),
  });
  
  // Clean old sessions (>1 hour)
  const oneHourAgo = Date.now() - 3600000;
  for (const [key, session] of oauthSessions.entries()) {
    if (session.createdAt < oneHourAgo) {
      oauthSessions.delete(key);
    }
  }
  
  // Build authorization URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  
  const authUrl = `${config.authUrl}?${params.toString()}`;
  
  console.log(`[OAuth] 🔐 Started ${app} OAuth flow for user ${userId}`);
  
  return { authUrl, state };
}

/**
 * COMPLETE OAUTH FLOW - Exchange code for tokens
 */
export async function completeOAuthFlow(
  code: string,
  state: string
): Promise<{
  success: boolean;
  app?: string;
  userId?: string;
  tokens?: any;
  error?: string;
}> {
  const session = oauthSessions.get(state);
  
  if (!session) {
    return {
      success: false,
      error: 'Invalid OAuth state. Session expired or invalid.',
    };
  }
  
  const config = OAUTH_CONFIGS[session.app as keyof typeof OAUTH_CONFIGS];
  
  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: session.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: session.codeVerifier,
      }),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }
    
    const tokens = await tokenResponse.json();
    
    // Store tokens securely via permissions system
    await grantPermission(
      session.userId,
      session.app,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in * 1000),
        tokenType: tokens.token_type,
      },
      config.scopes,
      {
        oauthCompleted: true,
        grantedAt: Date.now(),
      }
    );
    
    // Clean up session
    oauthSessions.delete(state);
    
    console.log(`[OAuth] ✅ ${session.app} OAuth completed for user ${session.userId}`);
    
    return {
      success: true,
      app: session.app,
      userId: session.userId,
      tokens,
    };
    
  } catch (error: any) {
    console.error(`[OAuth] ❌ OAuth completion error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * REFRESH ACCESS TOKEN - Handle token expiration
 */
export async function refreshAccessToken(
  app: 'instagram' | 'gmail' | 'twitter',
  refreshToken: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  const config = OAUTH_CONFIGS[app];
  
  try {
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    
    if (!tokenResponse.ok) {
      throw new Error('Token refresh failed');
    }
    
    const tokens = await tokenResponse.json();
    
    console.log(`[OAuth] 🔄 Access token refreshed for ${app}`);
    
    return {
      success: true,
      accessToken: tokens.access_token,
    };
    
  } catch (error: any) {
    console.error(`[OAuth] ❌ Token refresh error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

export default {
  startOAuthFlow,
  completeOAuthFlow,
  refreshAccessToken,
  OAUTH_CONFIGS,
};
