# OpenClaw Integration

This directory contains components from the OpenClaw project (formerly Moltbot, formerly Clawdbot).

## Source Repository

- **GitHub**: https://github.com/openclaw/openclaw
- **Version**: 2026.2.10
- **License**: MIT
- **Cloned**: February 12, 2026

## Contents

### `/skills/` - OpenClaw Skills Library

50+ extensible skills for AI agents:

#### Popular Skills
- `github/` - GitHub API integration
- `slack/` - Slack messaging
- `discord/` - Discord bot operations
- `weather/` - Weather information
- `summarize/` - Content summarization
- `coding-agent/` - AI coding assistant
- `canvas/` - Visual canvas rendering
- `voice-call/` - Voice calling

#### Full List
Run `ls -1 skills/` to see all 50+ available skills.

### `/agents/` - Agent Runtime System

OpenClaw's agent runtime with:
- Multi-agent routing
- Session management
- Tool execution
- Message handling

## Usage

These components are provided as reference and for potential integration into SecureClaw.

To use a skill:

1. Review the skill's source code
2. Check for dependencies
3. Adapt to SecureClaw's architecture
4. Test thoroughly before deploying

## Documentation

- Main docs: https://docs.openclaw.ai
- Skills guide: https://docs.openclaw.ai/tools/skills
- Agent concepts: https://docs.openclaw.ai/concepts/agent

## Notes

- Some skills may require additional dependencies
- Skills are designed for Node.js CLI environments
- Adaptation may be needed for React Native/mobile contexts
- See `/workspace/OPENCLAW_INTEGRATION.md` for full integration guide

## Maintenance

This is a snapshot from OpenClaw 2026.2.10. To update:

```bash
cd /tmp
git clone https://github.com/openclaw/openclaw.git
cd openclaw
git pull origin main
cp -r skills /workspace/openclaw-integration/
cp -r src/agents /workspace/openclaw-integration/
```

## License

OpenClaw is licensed under MIT. This integration maintains license compatibility.
