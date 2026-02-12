# SecureClaw Production Dockerfile
# Multi-stage build for optimized production image

FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build server bundle
RUN npm run server:build

# Production stage
FROM node:20-alpine

# Install PM2 globally
RUN npm install -g pm2 pnpm

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=builder /app/server_dist ./server_dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src

# Create necessary directories
RUN mkdir -p certs logs

# Expose ports
EXPOSE 5000 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
