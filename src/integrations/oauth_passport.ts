/**
 * PASSPORT OAUTH2 INTEGRATION - Seamless App Linking
 * 
 * One-click OAuth flows with auto-refresh
 * Bot acts like employee: grant once, works forever
 */

import passport from 'passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { grantPermission, getDecryptedCredentials } from '../permissions';

// Session store for OAuth states
const oauthSessions = new Map<string, any>();

/**
 * CONFIGURE PASSPORT STRATEGIES
 */
export function configurePassport(): void {
  console.log(`[Passport OAuth] 🔐 Configuring OAuth strategies...`);
  
  // INSTAGRAM (Facebook Graph)
  if (process.env.INSTAGRAM_CLIENT_ID) {
    passport.use('instagram', new OAuth2Strategy({
      authorizationURL: 'https://api.instagram.com/oauth/authorize',
      tokenURL: 'https://api.instagram.com/oauth/access_token',
      clientID: process.env.INSTAGRAM_CLIENT_ID,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || '',
      callbackURL: process.env.OAUTH_REDIRECT_URI + '/instagram',
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      console.log(`[Passport OAuth] ✅ Instagram token acquired`);
      
      return done(null, {
        app: 'instagram',
        accessToken,
        refreshToken,
        profile,
      });
    }));
    
    console.log(`[Passport OAuth] ✅ Instagram strategy configured`);
  }
  
  // GMAIL (Google)
  if (process.env.GOOGLE_CLIENT_ID) {
    passport.use('google', new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.OAUTH_REDIRECT_URI + '/google',
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      console.log(`[Passport OAuth] ✅ Gmail token acquired for ${profile.emails?.[0]?.value}`);
      
      return done(null, {
        app: 'gmail',
        accessToken,
        refreshToken,
        profile,
        email: profile.emails?.[0]?.value,
      });
    }));
    
    console.log(`[Passport OAuth] ✅ Google strategy configured`);
  }
  
  // TWITTER (OAuth 2.0)
  if (process.env.TWITTER_CLIENT_ID) {
    passport.use('twitter', new OAuth2Strategy({
      authorizationURL: 'https://twitter.com/i/oauth2/authorize',
      tokenURL: 'https://api.twitter.com/2/oauth2/token',
      clientID: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
      callbackURL: process.env.OAUTH_REDIRECT_URI + '/twitter',
      scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      console.log(`[Passport OAuth] ✅ Twitter token acquired`);
      
      return done(null, {
        app: 'twitter',
        accessToken,
        refreshToken,
        profile,
      });
    }));
    
    console.log(`[Passport OAuth] ✅ Twitter strategy configured`);
  }
}

/**
 * EXECUTE WITH AUTO-REFRESH - Employee-like behavior
 * 
 * Bot automatically refreshes expired tokens and retries
 */
export async function executeWithApp(
  userId: string,
  app: 'instagram' | 'gmail' | 'twitter',
  action: () => Promise<any>
): Promise<{ success: boolean; data?: any; error?: string; refreshed?: boolean }> {
  console.log(`[OAuth Execute] 🎯 Executing with ${app} for ${userId}...`);
  
  try {
    // Get current credentials
    let creds = getDecryptedCredentials(userId, app);
    
    if (!creds) {
      return {
        success: false,
        error: `No ${app} credentials found. Link app first.`,
      };
    }
    
    // Check if token expired
    const now = Date.now();
    const isExpired = creds.expiresAt && now > creds.expiresAt;
    
    if (isExpired && creds.refreshToken) {
      console.log(`[OAuth Execute] 🔄 Token expired, auto-refreshing...`);
      
      // Auto-refresh token
      const refreshed = await refreshToken(app, creds.refreshToken);
      
      if (refreshed.success) {
        // Update stored credentials
        await grantPermission(
          userId,
          app,
          {
            ...creds,
            accessToken: refreshed.accessToken,
            expiresAt: Date.now() + (refreshed.expiresIn || 3600) * 1000,
          },
          creds.scopes || ['read', 'write']
        );
        
        console.log(`[OAuth Execute] ✅ Token auto-refreshed for ${app}`);
        
        // Retry action with new token
        const result = await action();
        
        return {
          success: true,
          data: result,
          refreshed: true,
        };
      } else {
        return {
          success: false,
          error: `Token refresh failed: ${refreshed.error}. Re-link ${app}.`,
        };
      }
    }
    
    // Token valid, execute action
    const result = await action();
    
    return {
      success: true,
      data: result,
      refreshed: false,
    };
    
  } catch (error: any) {
    console.error(`[OAuth Execute] ❌ Execution error:`, error.message);
    
    // Check if it's an auth error
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      console.log(`[OAuth Execute] 🔄 Auth error, attempting token refresh...`);
      
      const creds = getDecryptedCredentials(userId, app);
      if (creds?.refreshToken) {
        const refreshed = await refreshToken(app, creds.refreshToken);
        
        if (refreshed.success) {
          // Update and retry
          await grantPermission(userId, app, { ...creds, accessToken: refreshed.accessToken }, creds.scopes);
          
          try {
            const result = await action();
            return {
              success: true,
              data: result,
              refreshed: true,
            };
          } catch (retryError: any) {
            return {
              success: false,
              error: retryError.message,
            };
          }
        }
      }
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * REFRESH TOKEN - Get new access token
 */
async function refreshToken(
  app: 'instagram' | 'gmail' | 'twitter',
  refreshToken: string
): Promise<{ success: boolean; accessToken?: string; expiresIn?: number; error?: string }> {
  console.log(`[OAuth Refresh] 🔄 Refreshing ${app} token...`);
  
  const configs: Record<string, any> = {
    instagram: {
      tokenURL: 'https://api.instagram.com/oauth/access_token',
      clientId: process.env.INSTAGRAM_CLIENT_ID,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    },
    gmail: {
      tokenURL: 'https://oauth2.googleapis.com/token',
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    twitter: {
      tokenURL: 'https://api.twitter.com/2/oauth2/token',
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
    },
  };
  
  const config = configs[app];
  
  if (!config.clientId) {
    return {
      success: false,
      error: `${app} OAuth not configured`,
    };
  }
  
  try {
    const response = await fetch(config.tokenURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }
    
    const data = await response.json();
    
    console.log(`[OAuth Refresh] ✅ Token refreshed for ${app}`);
    
    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
    
  } catch (error: any) {
    console.error(`[OAuth Refresh] ❌ Error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * PROACTIVE LINK SUGGESTION - AI suggests linking apps when needed
 */
export function shouldSuggestLinking(
  userId: string,
  app: string,
  action: string
): { suggest: boolean; message: string } {
  const creds = getDecryptedCredentials(userId, app);
  
  if (!creds) {
    return {
      suggest: true,
      message: `Hey Scot, I need ${app} access to ${action}. Want to link it now? Takes 30 seconds! 🔗`,
    };
  }
  
  // Check if token will expire soon (within 1 hour)
  if (creds.expiresAt && (creds.expiresAt - Date.now() < 3600000)) {
    return {
      suggest: false, // Will auto-refresh
      message: `Token expiring soon—I'll auto-refresh it when needed! ✅`,
    };
  }
  
  return {
    suggest: false,
    message: `${app} already linked! Ready to ${action} 🚀`,
  };
}

export default {
  configurePassport,
  executeWithApp,
  shouldSuggestLinking,
};
