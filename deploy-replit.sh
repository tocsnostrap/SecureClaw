#!/bin/bash

###############################################################################
# SecureClaw Replit Reserved VM Deployment
# One-command deployment script for Replit
###############################################################################

set -e  # Exit on error

echo "🚀 =============================================="
echo "🚀 SECURECLAW REPLIT DEPLOYMENT"
echo "🚀 =============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Step 1: Verify environment
log_info "Step 1: Verifying environment..."
if [ -z "$REPL_ID" ]; then
    log_warn "Not running on Replit, but continuing..."
else
    log_info "Detected Replit environment: $REPL_ID"
fi

NODE_VERSION=$(node --version)
log_info "Node.js version: $NODE_VERSION"

# Step 2: Check for .env or Replit Secrets
log_info "Step 2: Checking environment configuration..."
if [ ! -f ".env" ] && [ -z "$XAI_API_KEY" ]; then
    log_error "No .env file found and XAI_API_KEY not in environment!"
    log_warn "Please create .env file or set variables in Replit Secrets"
    echo ""
    echo "REQUIRED: Copy .env.example to .env and fill in these values:"
    echo "  - XAI_API_KEY (get from x.ai)"
    echo "  - SECURECLAW_AUTH_TOKEN (32+ random chars)"
    echo "  - SESSION_SECRET (32+ random chars)"
    echo "  - PERMISSIONS_KEY (32 chars)"
    echo ""
    echo "Then run this script again."
    exit 1
fi

if [ -f ".env" ]; then
    log_info ".env file found"
else
    log_info "Using Replit Secrets (environment variables)"
fi

# Step 3: Install dependencies
log_info "Step 3: Installing dependencies..."
npm install

# Step 4: Build server
log_info "Step 4: Building server..."
npm run server:build

# Step 5: Install PM2
log_info "Step 5: Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    log_info "PM2 installed"
else
    log_info "PM2 already installed"
fi

# Step 6: Create logs directory
log_info "Step 6: Creating logs directory..."
mkdir -p logs

# Step 7: Stop existing PM2 processes
log_info "Step 7: Cleaning up existing processes..."
pm2 delete all 2>/dev/null || true

# Step 8: Start services
log_info "Step 8: Starting SecureClaw services with PM2..."
pm2 start ecosystem.config.js --env production

# Step 9: Save PM2 config
log_info "Step 9: Saving PM2 configuration..."
pm2 save

# Step 10: Setup PM2 startup (may not work in Replit, but try anyway)
log_info "Step 10: Setting up PM2 startup..."
pm2 startup || log_warn "PM2 startup registration skipped (Replit handles this)"

# Step 11: Wait for services to start
log_info "Step 11: Waiting for services to initialize..."
sleep 5

# Step 12: Check PM2 status
log_info "Step 12: Checking service status..."
pm2 status

# Step 13: Test health endpoint
log_info "Step 13: Testing health endpoint..."
sleep 2

if curl -f http://localhost:5000/api/health &> /dev/null; then
    log_info "✅ Health check PASSED!"
else
    log_warn "⚠️  Health check failed. Check logs with: pm2 logs"
fi

# Step 14: Display summary
echo ""
echo "=============================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=============================================="
echo ""
log_info "Services running:"
pm2 list

echo ""
log_info "View logs: pm2 logs"
log_info "Monitoring: pm2 monit"
log_info "Restart all: pm2 restart all"

echo ""
log_info "Your SecureClaw URLs (Replit will provide public URLs):"
echo "  • API: https://<your-repl>.repl.co"
echo "  • Gateway: wss://<your-repl>.repl.co/ws"
echo "  • Health: https://<your-repl>.repl.co/api/health"

echo ""
log_info "Next steps:"
echo "  1. Go to Replit Webview to get your public URL"
echo "  2. Test: curl https://<your-url>/api/health"
echo "  3. Configure OAuth redirects (if using integrations)"
echo "  4. Test Telegram bot (if enabled)"
echo "  5. Set up WhatsApp webhook (if using Twilio)"

echo ""
log_info "Optional: Run integration tests"
echo "  npx tsx test-integration.ts"

echo ""
echo "🚀 SecureClaw is live! Enjoy your autonomous AI assistant!"
echo ""
