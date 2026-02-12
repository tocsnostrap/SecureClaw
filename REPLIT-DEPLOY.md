# 🚀 SecureClaw - Replit Reserved VM Deployment

**Complete guide for deploying SecureClaw on Replit Reserved VM**

---

## ⚡ Quick Deploy (3 Minutes)

### Prerequisites
✅ Replit Reserved VM (not regular Repl)  
✅ xAI API key from [x.ai/api](https://x.ai/api)

### Step 1: Configure Secrets

Go to **Replit Secrets** (🔒 icon in left sidebar) and add:

**REQUIRED:**
```
XAI_API_KEY = your_xai_api_key_here
SECURECLAW_AUTH_TOKEN = your_random_32_char_token_here
SESSION_SECRET = your_random_32_char_secret_here
PERMISSIONS_KEY = your_32_char_encryption_key_here
```

**Generate random tokens:**
```bash
# In Replit Shell, run these to generate secure tokens:
node -e "console.log('SECURECLAW_AUTH_TOKEN=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('PERMISSIONS_KEY=' + require('crypto').randomBytes(16).toString('hex'))"
```

Copy the output and add to Replit Secrets.

**OPTIONAL (Add later for Stage 2 features):**
```
TELEGRAM_BOT_TOKEN = your_telegram_token
TWILIO_ACCOUNT_SID = your_twilio_sid
TWILIO_AUTH_TOKEN = your_twilio_token
FIREBASE_SERVICE_ACCOUNT_JSON = {"type":"service_account",...}
INSTAGRAM_CLIENT_ID = your_instagram_id
INSTAGRAM_CLIENT_SECRET = your_instagram_secret
GOOGLE_CLIENT_ID = your_google_id
GOOGLE_CLIENT_SECRET = your_google_secret
TWITTER_CLIENT_ID = your_twitter_id
TWITTER_CLIENT_SECRET = your_twitter_secret
```

### Step 2: Run Deployment Script

In Replit Shell, run:

```bash
bash deploy-replit.sh
```

**That's it!** The script will:
- ✅ Install dependencies
- ✅ Build the server
- ✅ Install PM2
- ✅ Start all services
- ✅ Verify health

**Expected output:**
```
🎉 DEPLOYMENT COMPLETE!
✅ Services running: secureclaw-server, secureclaw-gateway, secureclaw-cron
✅ Health check PASSED!
```

### Step 3: Get Your Public URL

1. Click **Webview** button in Replit
2. Your SecureClaw is live at: `https://<your-repl>.repl.co`
3. Test it: Visit `https://<your-repl>.repl.co/api/health`

---

## 🔍 Manual Deployment (If Script Fails)

Run these commands one by one:

```bash
# 1. Install dependencies
npm install

# 2. Build server
npm run server:build

# 3. Install PM2 globally
npm install -g pm2

# 4. Create logs directory
mkdir -p logs

# 5. Start services
pm2 start ecosystem.config.js --env production

# 6. Save PM2 config
pm2 save

# 7. Check status
pm2 status

# 8. Test health
curl http://localhost:5000/api/health
```

---

## 📊 Verify Deployment

### Check Services
```bash
pm2 status
```

**Expected output:**
```
┌─────┬────────────────────────┬─────────┬─────────┬─────────┬──────────┐
│ id  │ name                   │ status  │ restart │ uptime  │ cpu      │
├─────┼────────────────────────┼─────────┼─────────┼─────────┼──────────┤
│ 0   │ secureclaw-server      │ online  │ 0       │ 10s     │ 0%       │
│ 1   │ secureclaw-gateway     │ online  │ 0       │ 10s     │ 0%       │
│ 2   │ secureclaw-cron        │ online  │ 0       │ 10s     │ 0%       │
└─────┴────────────────────────┴─────────┴─────────┴─────────┴──────────┘
```

### View Logs
```bash
# All services
pm2 logs

# Specific service
pm2 logs secureclaw-server

# Last 50 lines
pm2 logs --lines 50
```

### Test Health Endpoint
```bash
curl http://localhost:5000/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "SecureClaw Gateway",
  "systems": {
    "ai": true,
    "agents": true,
    "permissions": true,
    "integrations": true
  },
  "agents": {
    "orchestrator": true,
    "scheduler": true,
    "research": true,
    "device": true
  }
}
```

---

## 🎯 Test Your Deployment

### 1. Test API via Webview
Visit in browser: `https://<your-repl>.repl.co/api/health`

### 2. Test Chat Endpoint
```bash
curl -X POST https://<your-repl>.repl.co/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello! Are you operational?"}
    ]
  }'
```

### 3. Test Integration Flow
```bash
npx tsx test-integration.ts
```

---

## 🔧 Common Issues & Fixes

### Issue: "XAI_API_KEY not set"
**Fix:** Add `XAI_API_KEY` to Replit Secrets

### Issue: "Port already in use"
**Fix:**
```bash
pm2 delete all
pm2 start ecosystem.config.js --env production
```

### Issue: Service keeps restarting
**Fix:** Check logs for errors
```bash
pm2 logs secureclaw-server --lines 100
```

### Issue: Build failed
**Fix:** Clean install
```bash
rm -rf node_modules
npm install
npm run server:build
```

### Issue: Can't access from outside Replit
**Fix:** 
- Ensure you're using a **Reserved VM** (not regular Repl)
- Regular Repls may have networking restrictions
- Go to Replit Deployments to configure public access

---

## 📱 Enable Optional Features

### 🤖 Telegram Bot
1. Get token from [@BotFather](https://t.me/BotFather)
2. Add to Replit Secrets: `TELEGRAM_BOT_TOKEN=your_token`
3. Restart: `pm2 restart all`
4. Test: Message your bot `/start`

### 📱 WhatsApp (Twilio)
1. Sign up at [twilio.com](https://twilio.com)
2. Add to Secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
3. Set webhook in Twilio: `https://<your-repl>.repl.co/api/whatsapp/webhook`
4. Restart: `pm2 restart all`

### 📲 Push Notifications (Firebase)
1. Download Firebase service account JSON
2. Add to Secrets: `FIREBASE_SERVICE_ACCOUNT_JSON=<entire_json_string>`
3. Restart: `pm2 restart all`
4. Test: `curl -X POST https://<your-repl>.repl.co/api/notifications/test -H "Content-Type: application/json" -d '{"deviceToken":"test","userName":"Scot"}'`

### 📸 Instagram/Gmail/Twitter OAuth
1. Create OAuth apps in respective developer portals
2. Add client IDs and secrets to Replit Secrets
3. Set redirect URI: `https://<your-repl>.repl.co/api/oauth/callback/<app>`
4. Restart: `pm2 restart all`
5. Test: Visit `https://<your-repl>.repl.co/api/oauth/instagram`

---

## 🎛️ Management Commands

### PM2 Commands
```bash
# View status
pm2 status

# View logs (all services)
pm2 logs

# View logs (specific service)
pm2 logs secureclaw-server

# Real-time monitoring
pm2 monit

# Restart all services
pm2 restart all

# Restart specific service
pm2 restart secureclaw-server

# Stop all services
pm2 stop all

# Delete all processes
pm2 delete all

# Show detailed info
pm2 show secureclaw-server
```

### Update Code
```bash
# Pull latest changes
git pull

# Reinstall dependencies (if package.json changed)
npm install

# Rebuild
npm run server:build

# Restart services
pm2 restart all
```

---

## 📈 Monitoring

### View Real-Time Metrics
```bash
pm2 monit
```

### View Logs in Real-Time
```bash
pm2 logs --lines 20
```

### Check Health
```bash
curl http://localhost:5000/api/health
```

### Check Cron Status
```bash
curl http://localhost:5000/api/cron/status
```

### Check Telegram Status
```bash
curl http://localhost:5000/api/telegram/status
```

---

## 🚀 Your SecureClaw is Live!

**Access points:**
- 🌐 **Web API:** `https://<your-repl>.repl.co`
- 🔌 **WebSocket Gateway:** `wss://<your-repl>.repl.co/ws`
- 🏥 **Health Check:** `https://<your-repl>.repl.co/api/health`
- 📊 **Agent List:** `https://<your-repl>.repl.co/api/agents`
- 📝 **Config:** `https://<your-repl>.repl.co/api/config`

**Services running 24/7:**
- ✅ API Server (port 5000)
- ✅ WebSocket Gateway (port 18789)
- ✅ Autonomous Cron Tasks
- ✅ Telegram Bot (if configured)
- ✅ WhatsApp Integration (if configured)

---

## 📞 Need Help?

- **Documentation:** See `DEPLOYMENT.md` for detailed info
- **Integration Tests:** Run `npx tsx test-integration.ts`
- **View Logs:** `pm2 logs`
- **Check Status:** `pm2 status`

---

## 🎉 Congratulations!

Your SecureClaw autonomous AI assistant is now live and operational on Replit Reserved VM!

**Try it:**
- Send a message via Telegram bot
- Link an app via OAuth
- Execute a task autonomously
- Monitor background cron jobs

**Built with ❤️ using xAI Grok 4**
