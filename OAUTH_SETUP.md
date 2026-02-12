# 🔐 Real OAuth Setup Guide

## Production OAuth Integration

SecureClaw now has **REAL OAuth 2.0** with Instagram Graph API, Gmail API, and Twitter API v2.

---

## 📋 SETUP OAUTH CREDENTIALS

### 1. Instagram Graph API

**Create App**: https://developers.facebook.com/apps

1. Create new app
2. Add Instagram Graph API product
3. Get Client ID and Client Secret
4. Set redirect URI: `https://your-replit.replit.dev/api/oauth/callback`

**Add to Replit Secrets:**
```
INSTAGRAM_CLIENT_ID=your_client_id
INSTAGRAM_CLIENT_SECRET=your_client_secret
```

### 2. Gmail API (Google Cloud)

**Create Project**: https://console.cloud.google.com

1. Create new project
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Add redirect URI: `https://your-replit.replit.dev/api/oauth/callback`

**Add to Replit Secrets:**
```
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

### 3. Twitter API v2

**Developer Portal**: https://developer.twitter.com

1. Create new app
2. Get API keys
3. Enable OAuth 2.0
4. Add callback: `https://your-replit.replit.dev/api/oauth/callback`

**Add to Replit Secrets:**
```
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
```

---

## 🔗 OAUTH FLOW

### How It Works:

```
1. User: "Grant Instagram access"

2. AI: Generates OAuth URL
   GET /api/oauth/start/instagram?userId=scot

3. Response: 
   {
     "authUrl": "https://api.instagram.com/oauth/authorize?client_id=...",
     "state": "abc123"
   }

4. User clicks link → Instagram login

5. Instagram redirects → /api/oauth/callback?code=...&state=abc123

6. Backend exchanges code for access token

7. Stores encrypted token

8. AI: "All set, Scot! Instagram linked 🔐"
```

---

## 🧪 TEST OAUTH

### Via API:

```bash
# Start OAuth flow
curl "http://localhost:5000/api/oauth/start/instagram?userId=scot"

# Returns authUrl - open in browser
# After auth, redirected to /api/oauth/callback
# Token stored automatically
```

### Via App:

```
"Grant Instagram access"
```

AI will provide OAuth link to click.

---

## ✅ REAL API CALLS

### Instagram Graph API:

- **Post Photo**: Uses real `/me/media` + `/me/media_publish`
- **Get Media**: Fetches actual user posts
- **Insights**: Real engagement metrics

### Gmail API:

- **List Messages**: Real IMAP-style message list
- **Send Email**: Actual email sending
- **Search**: Query inbox with Gmail search syntax

### Twitter API v2:

- **Post Tweet**: Real tweet posting
- **Get Timeline**: User's actual feed
- **Coming**: DMs, replies, mentions

---

## 🎯 FULL PRODUCTION

This is **REAL**, not simulated:

✅ Real OAuth 2.0 with PKCE  
✅ Real Instagram Graph API  
✅ Real Gmail API  
✅ Real Twitter API v2  
✅ Token refresh handling  
✅ Error recovery  
✅ Rate limit ready  

**No simulations. Production-grade.** 🚀

