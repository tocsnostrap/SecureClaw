# SecureClaw - Replit Deployment Guide

## Quick Start (3 minutes)

### 1. Set Required Secrets

Open **Secrets** (lock icon) in your Replit and add:

| Key | Required | Description |
|-----|----------|-------------|
| `XAI_API_KEY` | **Yes** | Your xAI API key from [console.x.ai](https://console.x.ai) |
| `SECURECLAW_API_KEY` | Recommended | API key to protect your endpoints (any random string, 32+ chars) |
| `SESSION_SECRET` | Recommended | Random string for session encryption (32+ chars) |
| `PERMISSIONS_KEY` | Recommended | 32-character key for credential encryption |
| `DATABASE_URL` | Optional | PostgreSQL connection string for persistent storage |

**Generate secure random keys:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Start the Server

```bash
npm run server:dev
```

Or for production:
```bash
npm run server:build && npm run server:prod
```

### 3. Test It

```bash
# Health check
curl http://localhost:5000/api/health

# Chat (add X-API-Key header if SECURECLAW_API_KEY is set)
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"messages":[{"role":"user","content":"Hello, what can you do?"}]}'
```

## Optional Features

### Enable Autonomous Background Loops

Add to Secrets:
```
ENABLE_AUTONOMOUS_LOOPS=true
```

Individual toggles:
- `ENABLE_LEARNING=true` - Continuous learning (every 4 hours)
- `ENABLE_MONITORING=true` - Health monitoring (every 5 minutes)
- `ENABLE_PREDICTION=true` - Predictive preparation (every 30 minutes)
- `ENABLE_EVOLUTION=true` - Self-evolution (every 24 hours, generates code proposals)

### Enable PostgreSQL Persistence

1. Add a PostgreSQL database in Replit (or use external like Neon, Supabase)
2. Set `DATABASE_URL` in Secrets
3. Run schema migration:
```bash
npm run db:push
```

Without DATABASE_URL, the system uses in-memory storage (data lost on restart).

### Enable OAuth App Integrations

For Instagram/Gmail/Twitter integrations, add these Secrets:

```
INSTAGRAM_CLIENT_ID=your_id
INSTAGRAM_CLIENT_SECRET=your_secret
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
TWITTER_CLIENT_ID=your_id
TWITTER_CLIENT_SECRET=your_secret
```

### Token Budget

Control AI response length:
```
GROK_MAX_TOKENS=4096    # Default, good for most tasks
GROK_MAX_TOKENS=8192    # Maximum, for creative/code generation
```

## API Endpoints

### Chat
- `POST /api/chat` - Streaming chat with AI agent
- `POST /api/agents/route` - Non-streaming agent routing

### Agents
- `GET /api/agents` - List available agents
- `GET /api/agents/tasks` - List proactive tasks
- `POST /api/agents/tasks` - Create proactive task
- `GET /api/agents/tasks/templates` - Task templates

### Dashboard
- `GET /api/dashboard/status` - System health
- `GET /api/dashboard/permissions` - App permissions
- `GET /api/dashboard/apps` - Linked apps
- `GET /api/dashboard/help` - Help/wiki search
- `GET /api/dashboard/credits` - Credit balance

### System
- `GET /api/health` - Health check (no auth required)
- `GET /api/config` - System configuration (no auth required)
- `GET /api/autonomous/status` - Autonomous loop status
- `GET /api/audit` - Audit log
- `GET /api/audit/stats` - Audit statistics

### WebSocket
- `ws://localhost:5000/ws` - Real-time chat via WebSocket

## Architecture

```
server/
  index.ts          - Express server, session, passport setup
  routes.ts         - All API routes
  auth-middleware.ts - API key authentication
  storage.ts        - Database connection (PostgreSQL or in-memory)

src/
  agents/
    agents.ts       - Agent routing (orchestrator, scheduler, research, device)
    tools.ts        - 22 AI tools (browser, search, weather, code gen, etc.)
    memory.ts       - Conversation memory & learning
    proactive.ts    - Proactive task scheduling
    audit-log.ts    - Action audit trail
    providers/xai.ts - Grok API client

  core/
    autonomous_loops.ts  - Background loops with circuit breakers
    self_evolution.ts    - AI self-improvement (sandboxed)
    agent_collaboration.ts - Multi-agent swarm
    advanced_reasoning.ts - Chain-of-thought
    code_execution.ts    - Sandboxed JS/Python execution
    multimodal.ts        - Image/voice/video processing
    performance_optimizer.ts - Self-optimization

  skills/
    browser_skill.ts  - Puppeteer automation (Moltbot integration)
    browser_mutex.ts  - Single-tab mutex protocol

  integrations.ts     - App integrations (Instagram, Gmail, Twitter)
  permissions.ts      - Encrypted credential storage
  monitoring.ts       - System health monitoring
  credits.ts          - API usage credits

shared/
  schema.ts           - Drizzle ORM database schema
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `XAI_API_KEY` | (none) | xAI Grok API key |
| `SECURECLAW_API_KEY` | (none) | API authentication key |
| `SESSION_SECRET` | (random) | Session encryption key |
| `PERMISSIONS_KEY` | (derived) | Credential encryption key |
| `DATABASE_URL` | (none) | PostgreSQL connection string |
| `PORT` | 5000 | Server port |
| `NODE_ENV` | development | Environment |
| `GROK_MAX_TOKENS` | 4096 | Max AI response tokens |
| `ENABLE_AUTONOMOUS_LOOPS` | false | Enable background loops |
| `ENABLE_LEARNING` | true | Learning loop (if loops enabled) |
| `ENABLE_MONITORING` | true | Monitoring loop (if loops enabled) |
| `ENABLE_PREDICTION` | true | Prediction loop (if loops enabled) |
| `ENABLE_EVOLUTION` | false | Self-evolution loop |
| `ALLOW_SELF_EVOLUTION` | false | Allow AI to write files |
