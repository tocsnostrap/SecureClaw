#!/bin/bash

###############################################################################
# SecureClaw Deployment Script
# Supports: Replit Reserved VM, DigitalOcean, AWS EC2, or any VPS
###############################################################################

set -e  # Exit on error

echo "🚀 SecureClaw Stage 2 Deployment Starting..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/secureclaw"
REPO_URL="${REPO_URL:-https://github.com/yourusername/secureclaw.git}"
BRANCH="${BRANCH:-main}"
NODE_VERSION="20"

# Function to print colored messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    log_error "Please run as root (sudo)"
    exit 1
fi

# Detect environment
if [ ! -z "$REPL_ID" ]; then
    ENVIRONMENT="replit"
    log_info "Detected Replit environment"
elif [ -f /etc/digitalocean ]; then
    ENVIRONMENT="digitalocean"
    log_info "Detected DigitalOcean"
elif grep -q "Amazon" /etc/issue 2>/dev/null; then
    ENVIRONMENT="aws"
    log_info "Detected AWS EC2"
else
    ENVIRONMENT="generic"
    log_info "Detected generic VPS"
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    log_info "Installing Node.js ${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
fi

# Install pnpm if not present
if ! command -v pnpm &> /dev/null; then
    log_info "Installing pnpm..."
    npm install -g pnpm
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    log_info "Installing PM2..."
    npm install -g pm2
fi

# Install git if not present
if ! command -v git &> /dev/null; then
    log_info "Installing git..."
    apt-get update
    apt-get install -y git
fi

# Create app directory
log_info "Setting up application directory..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Clone or update repository
if [ -d ".git" ]; then
    log_info "Updating existing repository..."
    git fetch origin
    git reset --hard "origin/$BRANCH"
else
    log_info "Cloning repository..."
    git clone -b "$BRANCH" "$REPO_URL" .
fi

# Check for .env file
if [ ! -f ".env" ]; then
    log_warn ".env file not found!"
    if [ -f ".env.example" ]; then
        log_info "Copying .env.example to .env"
        cp .env.example .env
        log_warn "⚠️  IMPORTANT: Edit .env with your actual credentials!"
    else
        log_error "No .env.example found. Please create .env manually."
        exit 1
    fi
fi

# Install dependencies
log_info "Installing dependencies..."
pnpm install --prod

# Build server
log_info "Building server..."
npm run server:build

# Create logs directory
mkdir -p logs

# Setup PM2 startup
log_info "Setting up PM2 to start on boot..."
pm2 startup systemd -u root --hp /root || true

# Stop existing PM2 processes
log_info "Stopping existing PM2 processes..."
pm2 delete all || true

# Start PM2 with ecosystem file
log_info "Starting SecureClaw with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    log_info "Configuring firewall..."
    ufw allow 5000/tcp comment "SecureClaw API"
    ufw allow 18789/tcp comment "SecureClaw Gateway"
    ufw allow 22/tcp comment "SSH"
    ufw --force enable || true
fi

# Display status
log_info "Deployment complete! 🎉"
echo ""
log_info "PM2 Status:"
pm2 status

echo ""
log_info "Logs available at: $APP_DIR/logs/"
log_info "View logs with: pm2 logs"
log_info "View monitoring: pm2 monit"

echo ""
log_info "🌟 SecureClaw is now running!"
log_info "API Server: http://localhost:5000"
log_info "Gateway: ws://localhost:18789"

# Check health endpoint
sleep 5
if curl -f http://localhost:5000/api/health &> /dev/null; then
    log_info "✅ Health check passed!"
else
    log_warn "⚠️  Health check failed. Check logs with: pm2 logs"
fi

# Display next steps
echo ""
echo "============================================="
echo "NEXT STEPS:"
echo "============================================="
echo "1. Edit $APP_DIR/.env with your credentials"
echo "2. Restart services: pm2 restart all"
echo "3. Setup domain/SSL (recommended)"
echo "4. Configure Firebase FCM tokens"
echo "5. Add WhatsApp/Telegram bot tokens"
echo ""
echo "For SSL/HTTPS setup, use certbot:"
echo "  sudo apt install certbot"
echo "  sudo certbot certonly --standalone -d yourdomain.com"
echo ""
echo "Enjoy SecureClaw! 🚀"
