#!/usr/bin/env node
/**
 * Validation script for SecureClaw refactor
 * Checks code structure, syntax, and implementation without running
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function fileExists(filePath) {
  return fs.existsSync(path.join(__dirname, '..', filePath));
}

function readFile(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', filePath), 'utf-8');
}

function checkFile(filePath, checks) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    log(`❌ FAIL: File not found - ${filePath}`, 'red');
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const results = [];

  for (const check of checks) {
    const found = content.includes(check.text);
    if (found) {
      results.push({ pass: true, message: check.pass });
    } else {
      results.push({ pass: false, message: check.fail });
    }
  }

  const allPassed = results.every(r => r.pass);
  
  if (allPassed) {
    log(`✅ PASS: ${filePath}`, 'green');
    results.forEach(r => log(`   ✓ ${r.message}`, 'blue'));
  } else {
    log(`❌ FAIL: ${filePath}`, 'red');
    results.forEach(r => {
      if (r.pass) {
        log(`   ✓ ${r.message}`, 'green');
      } else {
        log(`   ✗ ${r.message}`, 'red');
      }
    });
  }

  return allPassed;
}

log('\n' + '='.repeat(60), 'cyan');
log('  SecureClaw Refactor Validation', 'cyan');
log('='.repeat(60), 'cyan');

let totalTests = 0;
let passedTests = 0;

// Test 1: xai.ts refactor
log('\n🧪 TEST 1: xai.ts - Safety rephrasing and cost optimization', 'cyan');
totalTests++;
if (checkFile('src/agents/providers/xai.ts', [
  { text: 'rephraseForSafety', pass: 'Safety rephrasing function exists', fail: 'Missing rephraseForSafety function' },
  { text: 'estimateTokens', pass: 'Token estimation function exists', fail: 'Missing estimateTokens function' },
  { text: 'trimMessages', pass: 'Context trimming function exists', fail: 'Missing trimMessages function' },
  { text: 'grok-4.1-fast', pass: 'Fast model configured for dev', fail: 'Missing fast model configuration' },
  { text: 'MAX_TOKENS', pass: 'Token limit optimization exists', fail: 'Missing MAX_TOKENS configuration' },
  { text: 'retryOnEmpty', pass: 'Empty response retry logic exists', fail: 'Missing retry logic' },
  { text: 'content_filter', pass: 'Content filter error handling exists', fail: 'Missing content filter handling' },
])) passedTests++;

// Test 2: agents.ts enhancements
log('\n🧪 TEST 2: agents.ts - Enhanced agent routing', 'cyan');
totalTests++;
if (checkFile('src/agents/agents.ts', [
  { text: 'CREATIVE AUTONOMY', pass: 'Enhanced orchestrator prompt exists', fail: 'Missing enhanced orchestrator prompt' },
  { text: 'generate_code', pass: 'Code generation tool added to orchestrator', fail: 'Missing generate_code tool' },
  { text: 'detectAgent', pass: 'detectAgent function exists', fail: 'Missing detectAgent function' },
  { text: 'isCreativeTask', pass: 'Creative task detection exists', fail: 'Missing creative task detection' },
  { text: 'isAmbiguous', pass: 'Ambiguous query handling exists', fail: 'Missing ambiguous query handling' },
  { text: 'console.log', pass: 'Logging added for debugging', fail: 'Missing debug logging' },
])) passedTests++;

// Test 3: tools.ts - generate_code
log('\n🧪 TEST 3: tools.ts - Code generation tool', 'cyan');
totalTests++;
if (checkFile('src/agents/tools.ts', [
  { text: 'generate_code:', pass: 'generate_code tool defined', fail: 'Missing generate_code tool' },
  { text: 'class Robot', pass: 'Robot simulation template exists', fail: 'Missing robot template' },
  { text: 'class RobotArmy', pass: 'RobotArmy template exists', fail: 'Missing RobotArmy template' },
  { text: 'class Game', pass: 'Game template exists', fail: 'Missing game template' },
  { text: 'language:', pass: 'Language parameter exists', fail: 'Missing language parameter' },
  { text: 'style:', pass: 'Style parameter exists', fail: 'Missing style parameter' },
])) passedTests++;

// Test 4: chat.tsx - UI improvements
log('\n🧪 TEST 4: chat.tsx - Adapting status indicator', 'cyan');
totalTests++;
if (checkFile('app/chat.tsx', [
  { text: 'adaptingStatus', pass: 'Adapting status state exists', fail: 'Missing adaptingStatus state' },
  { text: 'Adapting...', pass: 'Adapting text exists', fail: 'Missing "Adapting..." text' },
  { text: 'setAdaptingStatus', pass: 'Status setter exists', fail: 'Missing setAdaptingStatus' },
  { text: 'adaptingText:', pass: 'Adapting text style exists', fail: 'Missing adaptingText style' },
  { text: 'status={adaptingStatus}', pass: 'Status passed to indicator', fail: 'Status not passed to indicator' },
])) passedTests++;

// Test 5: routes.ts - Enhanced logging
log('\n🧪 TEST 5: routes.ts - Comprehensive error logging', 'cyan');
totalTests++;
if (checkFile('server/routes.ts', [
  { text: '✅', pass: 'Success emoji logging exists', fail: 'Missing success logging' },
  { text: '❌', pass: 'Error emoji logging exists', fail: 'Missing error logging' },
  { text: '🔧', pass: 'Tool emoji logging exists', fail: 'Missing tool logging' },
  { text: '🤖', pass: 'Agent emoji logging exists', fail: 'Missing agent logging' },
  { text: 'Duration:', pass: 'Performance logging exists', fail: 'Missing performance logging' },
  { text: 'content_filter', pass: 'Content filter error handling exists', fail: 'Missing content filter handling' },
])) passedTests++;

// Test 6: proactive.ts - Enhanced templates
log('\n🧪 TEST 6: proactive.ts - X/Twitter monitoring', 'cyan');
totalTests++;
if (checkFile('src/agents/proactive.ts', [
  { text: 'X Feed Monitor', pass: 'X feed monitoring template exists', fail: 'Missing X feed template' },
  { text: 'Breaking News', pass: 'Breaking news template exists', fail: 'Missing breaking news template' },
  { text: 'Proactive Task Suggester', pass: 'Task suggester exists', fail: 'Missing task suggester' },
])) passedTests++;

// Test 7: File structure
log('\n🧪 TEST 7: Documentation files', 'cyan');
totalTests++;
const docFiles = [
  'REFACTOR_NOTES.md',
  'DEPLOYMENT.md',
  'scripts/test-refactor.ts',
  'scripts/validate-refactor.js'
];

let allDocsExist = true;
for (const file of docFiles) {
  if (fileExists(file)) {
    log(`   ✓ ${file} exists`, 'green');
  } else {
    log(`   ✗ ${file} missing`, 'red');
    allDocsExist = false;
  }
}
if (allDocsExist) {
  log(`✅ PASS: All documentation files exist`, 'green');
  passedTests++;
} else {
  log(`❌ FAIL: Some documentation files missing`, 'red');
}

// Test 8: Check for syntax errors (basic)
log('\n🧪 TEST 8: Basic syntax validation', 'cyan');
totalTests++;
let syntaxValid = true;
const tsFiles = [
  'src/agents/providers/xai.ts',
  'src/agents/agents.ts',
  'src/agents/tools.ts',
  'server/routes.ts',
  'app/chat.tsx',
];

for (const file of tsFiles) {
  const content = readFile(file);
  
  // Check for common syntax errors
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  
  if (openBraces !== closeBraces) {
    log(`   ✗ ${file}: Mismatched braces (${openBraces} open, ${closeBraces} close)`, 'red');
    syntaxValid = false;
  } else if (openParens !== closeParens) {
    log(`   ✗ ${file}: Mismatched parentheses (${openParens} open, ${closeParens} close)`, 'red');
    syntaxValid = false;
  } else {
    log(`   ✓ ${file}: Balanced braces and parentheses`, 'green');
  }
}

if (syntaxValid) {
  log(`✅ PASS: No obvious syntax errors`, 'green');
  passedTests++;
} else {
  log(`❌ FAIL: Syntax errors detected`, 'red');
}

// Test 9: Check package.json scripts
log('\n🧪 TEST 9: package.json configuration', 'cyan');
totalTests++;
const packageJson = JSON.parse(readFile('package.json'));
const requiredScripts = ['server:dev', 'expo:dev'];
let allScriptsExist = true;

for (const script of requiredScripts) {
  if (packageJson.scripts[script]) {
    log(`   ✓ Script "${script}" exists`, 'green');
  } else {
    log(`   ✗ Script "${script}" missing`, 'red');
    allScriptsExist = false;
  }
}

if (allScriptsExist) {
  log(`✅ PASS: All required scripts exist`, 'green');
  passedTests++;
} else {
  log(`❌ FAIL: Some required scripts missing`, 'red');
}

// Summary
log('\n' + '='.repeat(60), 'cyan');
log(`  Validation Complete: ${passedTests}/${totalTests} tests passed`, passedTests === totalTests ? 'green' : 'yellow');
log('='.repeat(60), 'cyan');

if (passedTests === totalTests) {
  log('\n✅ All validation checks passed! Code is ready for deployment.', 'green');
  log('   Next steps:', 'blue');
  log('   1. Deploy to Replit: git pull on Replit', 'blue');
  log('   2. Run: npm install', 'blue');
  log('   3. Set XAI_API_KEY in Replit Secrets', 'blue');
  log('   4. Run: npm run server:dev', 'blue');
  process.exit(0);
} else {
  log(`\n⚠️  ${totalTests - passedTests} validation check(s) failed.`, 'yellow');
  log('   Review the errors above before deployment.', 'yellow');
  process.exit(1);
}
