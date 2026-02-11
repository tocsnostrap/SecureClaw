# SecureClaw - Autonomous Secure Personal AI Assistant

## Overview
SecureClaw is a secure, autonomous personal AI assistant powered by xAI's Grok 4 model. It features multi-agent routing, proactive task scheduling, tool calling, biometric authentication, encrypted WebSocket communications, audit logging, and an iOS-focused design.

## Recent Changes
- 2026-02-11: Added multi-agent routing system (orchestrator, scheduler, research, device agents)
- 2026-02-11: Added 10 tools with allowlist security (web_search, summarize, schedule_task, etc.)
- 2026-02-11: Added proactive cron-based task scheduling with templates
- 2026-02-11: Fixed audit logging module instance issue - switched to file-based storage (.audit-log.json) to avoid tsx module duplication between server/ and src/agents/ directories
- 2026-02-11: Added audit logging system for all autonomous actions
- 2026-02-11: Added Agent Hub dashboard in Expo app (agents, tasks, audit views)
- 2026-02-11: Added iOS reference files (VoiceManager.swift, CoreML fallback, WidgetKit)
- 2026-02-11: Updated config.yaml with agent defaults and proactive modes
- 2026-02-11: Initial build - gateway server, xAI integration, Expo mobile app

## Project Architecture

### Backend (Express + WebSocket)
- `server/index.ts` - Main Express server (port 5000)
- `server/routes.ts` - API routes with rate limiting, agent endpoints, WebSocket server at /ws
- `src/agents/agents.ts` - Multi-agent routing system (orchestrator, scheduler, research, device)
- `src/agents/tools.ts` - 10 tool definitions with Zod schemas for agent tool calling
- `src/agents/proactive.ts` - Cron-based proactive task scheduler with templates
- `src/agents/audit-log.ts` - Security audit logging with tool allowlists
- `src/agents/providers/xai.ts` - xAI Grok 4 integration using @ai-sdk/xai

### Frontend (Expo React Native)
- `app/index.tsx` - Lock screen with biometric auth
- `app/conversations.tsx` - Conversation list with Agent Hub navigation
- `app/chat.tsx` - Chat screen with streaming AI, agent indicators, tool call display
- `app/dashboard.tsx` - Agent Hub: agents overview, proactive tasks, audit log viewer
- `lib/auth-context.tsx` - Biometric auth context (expo-local-authentication)
- `lib/chat-context.tsx` - Chat state management with AsyncStorage persistence

### iOS Reference Files
- `ios/SecureClaw/VoiceManager.swift` - Voice wake detection ("hey claw") with on-device recognition
- `ios/SecureClaw/ML/CoreMLFallback.swift` - On-device ML intent classification using NaturalLanguage
- `ios/SecureClaw/Widgets/SecureClawWidget.swift` - WidgetKit dashboard (small/medium widgets)
- `apps/ios/SecureClaw/` - Swift reference implementation (auth, chat, WebSocket)

### Configuration
- `config.yaml` - Full agent config, security settings, proactive modes, tool allowlists
- `certs/` - Self-signed TLS certificates

### Scripts
- `scripts/test-autonomy.sh` - Test suite for autonomous agent flows
- `scripts/test-ai.ts` - Test Grok 4 connectivity

## Key Endpoints
- `POST /api/chat` - Streaming chat with multi-agent routing (SSE, optional `agent` param)
- `GET /api/agents` - List all agents and their tools
- `POST /api/agents/route` - Non-streaming agent routing with tool results
- `GET /api/agents/tasks` - List proactive tasks
- `POST /api/agents/tasks` - Create proactive task (name, cronExpression, agent, prompt)
- `GET /api/agents/tasks/templates` - Get pre-built task templates
- `POST /api/agents/tasks/:id/toggle` - Enable/disable a task
- `POST /api/agents/tasks/:id/run` - Execute a task immediately
- `DELETE /api/agents/tasks/:id` - Delete a task
- `GET /api/audit` - Get audit log (optional: ?limit=50&agent=research)
- `GET /api/audit/stats` - Audit statistics by agent
- `GET /api/health` - Service health with agent status
- `GET /api/config` - Full configuration including agents and tools
- `WS /ws` - WebSocket with agent routing support

## Environment Variables
- `XAI_API_KEY` - Required for xAI Grok 4 AI calls (user's own key)
- `SECURECLAW_AUTH_TOKEN` - Optional WebSocket auth token

## Agents
- **Orchestrator** - Central brain, delegates to other agents, all 10 tools, proactive
- **Scheduler** - Time-based tasks, cron jobs, reminders, proactive
- **Research** - Web search, RSS feeds, summaries, weather, translation
- **Device** - Notifications, reminders, system controls (consent required)

## Tool Allowlist
web_search, summarize, schedule_task, send_notification, get_weather, get_time, read_rss, calculate, translate, set_reminder

## Security Features
- Biometric authentication (Face ID / Touch ID)
- Rate limiting (30 req/min)
- Zod schema validation on all inputs
- Tool allowlist (only 10 approved tools)
- Audit logging for all autonomous actions
- Consent required for device/notification tools
- WebSocket token authentication (min 32 chars)
- Sandbox mode: all | DM Policy: pairing

## User Preferences
- Dark theme (#0D1117 background) with emerald green accent (#00D9A6)
- Space Grotesk font
- Security-first design approach
- Uses @ai-sdk/xai with user's own XAI_API_KEY (not Replit AI integrations)
