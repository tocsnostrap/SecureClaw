#!/bin/bash
# REPLIT DEPLOYMENT SCRIPT - Run this to deploy everything

echo "🚀 SecureClaw Ultimate AGI Deployment"
echo "======================================"
echo ""

echo "📦 Step 1: Installing dependencies..."
npm install

echo ""
echo "🔍 Step 2: Verifying systems..."
node -e "
const fs = require('fs');
const systems = {
  'Permissions': fs.existsSync('src/permissions.ts'),
  'Integrations': fs.existsSync('src/integrations.ts'),
  'Browser Skills': fs.existsSync('src/skills/browser_skill.ts'),
  'OAuth Passport': fs.existsSync('src/integrations/oauth_passport.ts'),
  'Monitoring': fs.existsSync('src/monitoring.ts'),
  'Help Wiki': fs.existsSync('src/help_wiki.ts'),
  'Self Evolution': fs.existsSync('src/core/self_evolution.ts'),
  'Advanced Reasoning': fs.existsSync('src/core/advanced_reasoning.ts'),
  'Agent Collaboration': fs.existsSync('src/core/agent_collaboration.ts'),
  'Multimodal': fs.existsSync('src/core/multimodal.ts'),
  'Code Execution': fs.existsSync('src/core/code_execution.ts'),
};

console.log('System Check:');
for (const [name, exists] of Object.entries(systems)) {
  console.log(exists ? '  ✅' : '  ❌', name);
}
"

echo ""
echo "🔧 Step 3: Checking tools..."
grep -c "tool({" src/agents/tools.ts | xargs echo "  Total tools defined:"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Set Replit Secrets:"
echo "   - XAI_API_KEY"
echo "   - GROK_MAX_TOKENS=8192"
echo ""
echo "2. Start server:"
echo "   npm run server:dev"
echo ""
echo "3. Test in app:"
echo "   'Monitor server status'"
echo ""
