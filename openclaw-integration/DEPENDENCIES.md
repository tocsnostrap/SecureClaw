# OpenClaw Dependencies Reference

This document lists dependencies from OpenClaw that may be useful for SecureClaw integration.

## Already Installed in SecureClaw

These OpenClaw dependencies are already in SecureClaw's `package.json`:

- ✅ `express` (^5.0.1 in SecureClaw, ^5.2.1 in OpenClaw)
- ✅ `ws` (^8.18.0 in SecureClaw, ^8.19.0 in OpenClaw)
- ✅ `puppeteer` (^23.10.4 in SecureClaw, not in OpenClaw - they use playwright)
- ✅ `dotenv` (via environment management)

## Recommended for Future Integration

### Channel Integrations
If you want to enable specific OpenClaw channel features:

```json
{
  "@slack/bolt": "^4.6.0",
  "@slack/web-api": "^7.14.0",
  "grammy": "^1.40.0",
  "discord-api-types": "^0.38.38",
  "@whiskeysockets/baileys": "7.0.0-rc.9"
}
```

### Agent Runtime
For using OpenClaw's agent system:

```json
{
  "@mariozechner/pi-agent-core": "0.52.9",
  "@mariozechner/pi-ai": "0.52.9",
  "@sinclair/typebox": "0.34.48",
  "ajv": "^8.17.1"
}
```

### Voice Capabilities
For voice wake word and TTS:

```json
{
  "node-edge-tts": "^1.2.10",
  "@homebridge/ciao": "^1.3.5"
}
```

### Browser (Playwright Alternative)
OpenClaw uses Playwright instead of Puppeteer:

```json
{
  "playwright-core": "1.58.2"
}
```

SecureClaw currently uses Puppeteer, which works well. Consider switching only if you need Playwright-specific features.

### Utilities
Useful utilities from OpenClaw:

```json
{
  "chalk": "^5.6.2",
  "commander": "^14.0.3",
  "croner": "^10.0.1",
  "proper-lockfile": "^4.1.2",
  "tslog": "^4.10.2",
  "yaml": "^2.8.2"
}
```

### Document Processing
For PDF and content extraction:

```json
{
  "@mozilla/readability": "^0.6.0",
  "pdfjs-dist": "^5.4.624",
  "sharp": "^0.34.5",
  "markdown-it": "^14.1.1"
}
```

## Not Needed for SecureClaw

These OpenClaw dependencies are specific to their platform and not needed:

- `@agentclientprotocol/sdk` - OpenClaw's protocol
- `@lydell/node-pty` - Terminal emulation
- `@line/bot-sdk` - LINE messaging
- `@larksuiteoapi/node-sdk` - Lark/Feishu
- `@buape/carbon` - Carbon framework
- `sqlite-vec` - Vector database
- `linkedom` - Server-side DOM

## Installation Commands

To add recommended dependencies later:

```bash
# Channel integrations
npm install @slack/bolt grammy

# Agent runtime
npm install @mariozechner/pi-agent-core @mariozechner/pi-ai

# Voice
npm install node-edge-tts

# Utilities
npm install chalk commander croner proper-lockfile tslog yaml

# Document processing
npm install @mozilla/readability pdfjs-dist sharp markdown-it
```

## Current Status

**SecureClaw already has all critical dependencies for basic OpenClaw integration.**

The openclaw-integration directory contains source code that can be adapted as needed. Additional dependencies should only be installed when you're ready to use specific OpenClaw features.

## Next Steps

1. Review specific skills you want to use
2. Check their individual dependencies
3. Install only what you need
4. Test thoroughly before production deployment

## References

- OpenClaw package.json: `/tmp/openclaw/package.json`
- SecureClaw package.json: `/workspace/package.json`
- OpenClaw docs: https://docs.openclaw.ai
