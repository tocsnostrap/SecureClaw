# SecureClaw - Secure Personal AI Assistant

## Overview
SecureClaw is a secure, iOS-focused personal AI assistant powered by xAI's Grok 4 model. It features biometric authentication, encrypted WebSocket communications, rate limiting, and Zod input validation.

## Recent Changes
- 2026-02-11: Initial build - gateway server, xAI integration, Expo mobile app, iOS Swift reference files

## Project Architecture

### Backend (Express + WebSocket)
- `server/index.ts` - Main Express server (port 5000)
- `server/routes.ts` - API routes with rate limiting, WebSocket server at /ws path
- `src/gateway/server.ts` - Standalone HTTPS WebSocket gateway (port 18789)
- `src/agents/providers/xai.ts` - xAI Grok 4 integration using @ai-sdk/xai

### Frontend (Expo React Native)
- `app/index.tsx` - Lock screen with biometric auth
- `app/conversations.tsx` - Conversation list
- `app/chat.tsx` - Chat screen with streaming AI responses
- `lib/auth-context.tsx` - Biometric auth context (expo-local-authentication)
- `lib/chat-context.tsx` - Chat state management with AsyncStorage persistence

### iOS Reference Files
- `apps/ios/SecureClaw/` - Swift reference implementation
  - `AppDelegate.swift` - Biometric auth on launch
  - `AuthenticationViewController.swift` - Face ID / Touch ID auth
  - `ChatViewController.swift` - Chat UI
  - `WebSocketManager.swift` - Secure WebSocket with cert pinning

### Configuration
- `config.yaml` - Security settings (dmPolicy: pairing, sandbox: all)
- `certs/` - Self-signed TLS certificates

### Scripts
- `scripts/test-ai.ts` - Test Grok 4 connectivity

## Key Endpoints
- `POST /api/chat` - Streaming chat with Grok 4 (SSE)
- `GET /api/health` - Service health check
- `GET /api/config` - Security configuration
- `WS /ws` - WebSocket endpoint with token auth

## Environment Variables
- `XAI_API_KEY` - Required for xAI Grok 4 AI calls
- `SECURECLAW_AUTH_TOKEN` - Optional WebSocket auth token (auto-generated if not set)

## Security Features
- Biometric authentication (Face ID / Touch ID)
- Rate limiting (30 req/min)
- Zod schema validation on all inputs
- Self-signed TLS certificates
- WebSocket token authentication (min 32 chars)
- Sandbox mode: all
- DM Policy: pairing

## User Preferences
- Dark theme with emerald green accent
- Space Grotesk font
- Security-first design approach
