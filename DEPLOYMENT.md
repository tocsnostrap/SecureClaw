# 🚀 SecureClaw Stage 2 Deployment Guide

Deploy SecureClaw to production on Replit Reserved VM, DigitalOcean, AWS EC2, or any VPS.

## 📋 Prerequisites

- Node.js 20+
- Git
- Domain name (optional but recommended for SSL)
- API keys for services you want to use

## 🎯 Quick Deploy Options

### Option 1: Replit Reserved VM (Easiest)

1. **Reserve a VM** in your Replit workspace
2. **Configure .env** in Replit Secrets:
   ```bash
   XAI_API_KEY=your_key_here
   SECURECLAW_AUTH_TOKEN=your_token_here
   # Add other keys as needed
   ```
3. **Run deployment:**
   ```bash
   npm run server:build
   pm2 start ecosystem.config.js --env production
   pm2 save
   ```

Your app will be live on your Replit domain!

### Option 2: DigitalOcean/AWS/VPS (Full Control)

1. **Provision VPS:**
   - DigitalOcean: Create Ubuntu 22.04 Droplet ($6/month)
   - AWS EC2: Launch Ubuntu 22.04 t2.micro instance
   - Any VPS: Ubuntu 22.04 LTS

2. **SSH into server:**
   ```bash
   ssh root@your-server-ip
   ```

3. **Run auto-deploy script:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/yourusername/secureclaw/main/deploy.sh | bash
   ```

   Or manually:
   ```bash
   sudo bash deploy.sh
   ```

4. **Configure environment:**
   ```bash
   cd /opt/secureclaw
   nano .env  # Edit with your credentials
   ```

5. **Restart services:**
   ```bash
   pm2 restart all
   ```

### Option 3: Docker (Containerized)

1. **Build image:**
   ```bash
   docker build -t secureclaw:latest .
   ```

2. **Create .env file:**
   ```bash
   cp .env.example .env
   nano .env  # Add your credentials
   ```

3. **Run with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

Your app will run on ports 5000 (API) and 18789 (Gateway).

## 🔑 Required API Keys

### Essential (Core Functionality)
- **xAI Grok API Key**: Get from [x.ai/api](https://x.ai/api)
- **SECURECLAW_AUTH_TOKEN**: Generate a random 32+ character string
- **SESSION_SECRET**: Generate a random 32+ character string
- **PERMISSIONS_KEY**: Generate a random 32-character encryption key

### Push Notifications
- **Firebase FCM**: 
  1. Go to [Firebase Console](https://console.firebase.google.com)
  2. Create project → Add app (iOS/Android)
  3. Download service account JSON
  4. Set `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON`

### Messaging Integrations
- **Telegram**:
  1. Message [@BotFather](https://t.me/BotFather) on Telegram
  2. Create bot: `/newbot`
  3. Copy token to `TELEGRAM_BOT_TOKEN`

- **WhatsApp (Twilio)**:
  1. Sign up at [twilio.com](https://www.twilio.com)
  2. Get Account SID and Auth Token
  3. Get WhatsApp sandbox number or apply for production number
  4. Set webhook to `https://yourdomain.com/api/whatsapp/webhook`

### OAuth App Integrations
- **Instagram** (via Facebook):
  1. [Facebook Developers](https://developers.facebook.com)
  2. Create app → Add Instagram Basic Display
  3. Add redirect URI: `https://yourdomain.com/api/oauth/callback/instagram`

- **Gmail** (via Google):
  1. [Google Cloud Console](https://console.cloud.google.com)
  2. Enable Gmail API
  3. Create OAuth credentials
  4. Add redirect URI: `https://yourdomain.com/api/oauth/callback/google`

- **Twitter**:
  1. [Twitter Developer Portal](https://developer.twitter.com)
  2. Create app → OAuth 2.0
  3. Add redirect URI: `https://yourdomain.com/api/oauth/callback/twitter`

## 🔒 SSL/HTTPS Setup (Production)

### Using Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be at:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem

# Copy to app directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/secureclaw/certs/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/secureclaw/certs/key.pem

# Restart services
pm2 restart all
```

### Auto-renewal
```bash
# Add to crontab
sudo crontab -e

# Add this line (renew every 2 months):
0 0 1 */2 * certbot renew --post-hook "cp /etc/letsencrypt/live/yourdomain.com/*.pem /opt/secureclaw/certs/ && pm2 restart all"
```

## 📊 Monitoring & Management

### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs

# View real-time monitoring
pm2 monit

# Restart all
pm2 restart all

# Stop all
pm2 stop all

# Save configuration
pm2 save

# View startup script
pm2 startup
```

### Health Check
```bash
# Check if API is responding
curl http://localhost:5000/api/health

# Should return:
# {"status":"ok","service":"SecureClaw Gateway","systems":{...}}
```

### Logs Location
- PM2 logs: `/opt/secureclaw/logs/`
- Gateway: `logs/gateway-out.log`, `logs/gateway-error.log`
- Server: `logs/server-out.log`, `logs/server-error.log`
- Cron: `logs/cron-out.log`, `logs/cron-error.log`

## 🌐 Domain & DNS Setup

1. **Point domain to server:**
   ```
   A Record: @ → your-server-ip
   A Record: www → your-server-ip
   ```

2. **Update .env:**
   ```bash
   DOMAIN=yourdomain.com
   OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/callback
   ```

3. **Configure OAuth redirects** in each provider's dashboard

## 🔥 Firewall Configuration

```bash
# Allow HTTP, HTTPS, SSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp

# Allow SecureClaw ports
sudo ufw allow 5000/tcp
sudo ufw allow 18789/tcp

# Enable firewall
sudo ufw enable
```

## 🧪 Testing the Deployment

### 1. Health Check
```bash
curl https://yourdomain.com/api/health
```

### 2. Test Push Notification
```bash
curl -X POST https://yourdomain.com/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{"deviceToken":"YOUR_DEVICE_TOKEN","userName":"Scot"}'
```

### 3. Test OAuth Flow
Visit: `https://yourdomain.com/api/oauth/instagram`

### 4. Test Telegram Bot
Message your bot on Telegram: `/start`

### 5. Test WhatsApp
Send message to your Twilio WhatsApp number

## 🚨 Troubleshooting

### Services won't start
```bash
# Check logs
pm2 logs

# Check if ports are in use
sudo lsof -i :5000
sudo lsof -i :18789

# Restart services
pm2 restart all
```

### OAuth not working
- Check redirect URIs match exactly
- Verify client IDs/secrets in .env
- Check logs: `pm2 logs secureclaw-server`

### Push notifications not sending
- Verify Firebase credentials
- Check device token is registered
- Test with `/api/notifications/test`

### Telegram bot not responding
- Verify bot token
- Check bot is running: `curl localhost:5000/api/telegram/status`
- Restart: `pm2 restart secureclaw-server`

### WhatsApp not working
- Verify Twilio credentials
- Check webhook is configured in Twilio dashboard
- Test signature validation is passing

## 📈 Performance Optimization

### Enable PM2 Cluster Mode (for high traffic)
```javascript
// In ecosystem.config.js, change:
instances: 'max',  // Use all CPU cores
exec_mode: 'cluster',
```

### Database Connection Pooling
```bash
# In .env, optimize PostgreSQL:
DATABASE_URL=postgresql://user:pass@localhost:5432/secureclaw?pool_size=20
```

### Enable Caching (Redis - Optional)
```bash
# Install Redis
sudo apt install redis-server

# Add to .env
REDIS_URL=redis://localhost:6379
```

## 🔄 Updates & Maintenance

### Pull latest changes
```bash
cd /opt/secureclaw
git pull origin main
npm install
npm run server:build
pm2 restart all
```

### Backup data
```bash
# Backup permissions and audit logs
cp /opt/secureclaw/.permissions.json ~/backups/
cp /opt/secureclaw/.audit-log.json ~/backups/

# Backup database (if using PostgreSQL)
pg_dump secureclaw > ~/backups/secureclaw_$(date +%Y%m%d).sql
```

## 💡 Stage 3 Roadmap (Future)

- Multi-user support with user dashboard
- Advanced analytics and insights
- Custom app integration SDK
- Voice commands via Siri/Google Assistant
- Workflow builder (visual automation)
- Team collaboration features

## 🆘 Support

- Documentation: [docs.secureclaw.ai](https://docs.secureclaw.ai)
- Issues: [GitHub Issues](https://github.com/yourusername/secureclaw/issues)
- Community: [Discord](https://discord.gg/secureclaw)

---

**Built with ❤️ by SecureClaw Team**

Powered by xAI Grok 4 • Forked from OpenClaw
