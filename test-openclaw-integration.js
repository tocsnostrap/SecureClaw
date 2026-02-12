/**
 * Test script for OpenClaw integration
 * Run with: node test-openclaw-integration.js
 */

const fs = require('fs');
const path = require('path');

console.log('🦞 OpenClaw Integration Test\n');

// Test 1: Check if openclaw-integration directory exists
console.log('Test 1: Checking openclaw-integration directory...');
const openclawPath = path.join(__dirname, 'openclaw-integration');
if (fs.existsSync(openclawPath)) {
  console.log('✅ openclaw-integration/ directory exists');
} else {
  console.log('❌ openclaw-integration/ directory NOT found');
  process.exit(1);
}

// Test 2: Check if skills directory exists
console.log('\nTest 2: Checking skills directory...');
const skillsPath = path.join(openclawPath, 'skills');
if (fs.existsSync(skillsPath)) {
  const skills = fs.readdirSync(skillsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`✅ Found ${skills.length} OpenClaw skills:`);
  console.log('\nPopular skills:');
  const popularSkills = ['github', 'slack', 'discord', 'weather', 'coding-agent', 'canvas'];
  popularSkills.forEach(skill => {
    if (skills.includes(skill)) {
      console.log(`  ✓ ${skill}`);
    }
  });
  
  console.log(`\nAll skills: ${skills.slice(0, 10).join(', ')}...`);
} else {
  console.log('❌ skills/ directory NOT found');
  process.exit(1);
}

// Test 3: Check if agents directory exists
console.log('\nTest 3: Checking agents directory...');
const agentsPath = path.join(openclawPath, 'agents');
if (fs.existsSync(agentsPath)) {
  const agentFiles = fs.readdirSync(agentsPath).length;
  console.log(`✅ Found agents directory with ${agentFiles} files`);
} else {
  console.log('❌ agents/ directory NOT found');
  process.exit(1);
}

// Test 4: Check documentation
console.log('\nTest 4: Checking documentation...');
const docsToCheck = [
  'OPENCLAW_INTEGRATION.md',
  'openclaw-integration/README.md',
  'openclaw-integration/DEPENDENCIES.md'
];

docsToCheck.forEach(doc => {
  const docPath = path.join(__dirname, doc);
  if (fs.existsSync(docPath)) {
    console.log(`  ✓ ${doc}`);
  } else {
    console.log(`  ✗ ${doc} NOT found`);
  }
});

// Test 5: Check package.json metadata
console.log('\nTest 5: Checking package.json metadata...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
if (packageJson.openclaw) {
  console.log('✅ package.json contains OpenClaw metadata:');
  console.log(`  - Integrated: ${packageJson.openclaw.integrated}`);
  console.log(`  - Version: ${packageJson.openclaw.version}`);
  console.log(`  - Repository: ${packageJson.openclaw.repository}`);
  console.log(`  - Integration date: ${packageJson.openclaw.integration_date}`);
} else {
  console.log('❌ package.json missing OpenClaw metadata');
  process.exit(1);
}

// Test 6: Check integration module
console.log('\nTest 6: Checking integration module...');
const integrationModulePath = path.join(__dirname, 'src', 'integrations', 'openclaw.ts');
if (fs.existsSync(integrationModulePath)) {
  console.log('✅ src/integrations/openclaw.ts exists');
} else {
  console.log('❌ src/integrations/openclaw.ts NOT found');
  process.exit(1);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('🎉 All tests passed!');
console.log('='.repeat(50));
console.log('\nOpenClaw integration is ready to use.');
console.log('\nNext steps:');
console.log('1. Explore skills in: openclaw-integration/skills/');
console.log('2. Read documentation: OPENCLAW_INTEGRATION.md');
console.log('3. Review agents: openclaw-integration/agents/');
console.log('4. Check dependencies: openclaw-integration/DEPENDENCIES.md');
console.log('\n🦞 EXFOLIATE! EXFOLIATE!');
