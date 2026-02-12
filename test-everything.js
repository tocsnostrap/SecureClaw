#!/usr/bin/env node
/**
 * TEST IF EVERYTHING ACTUALLY LOADS
 */

console.log('🧪 Testing SecureClaw Systems...\n');

async function testSystems() {
  const results = [];
  
  // Test 1: Tools file
  console.log('1. Loading tools...');
  try {
    const tools = await import('./src/agents/tools.ts');
    const toolCount = Object.keys(tools.agentTools).length;
    console.log(`   ✅ ${toolCount} tools loaded`);
    console.log(`   Tools: ${Object.keys(tools.agentTools).join(', ')}`);
    results.push({ system: 'Tools', status: 'OK', count: toolCount });
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
    results.push({ system: 'Tools', status: 'FAILED', error: e.message });
  }
  
  // Test 2: Agents
  console.log('\n2. Loading agents...');
  try {
    const agents = await import('./src/agents/agents.ts');
    console.log(`   ✅ Agents loaded`);
    results.push({ system: 'Agents', status: 'OK' });
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
    results.push({ system: 'Agents', status: 'FAILED', error: e.message });
  }
  
  // Test 3: Permissions
  console.log('\n3. Loading permissions...');
  try {
    const perms = await import('./src/permissions.ts');
    console.log(`   ✅ Permissions loaded`);
    results.push({ system: 'Permissions', status: 'OK' });
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
    results.push({ system: 'Permissions', status: 'FAILED', error: e.message });
  }
  
  // Test 4: Integrations
  console.log('\n4. Loading integrations...');
  try {
    const integ = await import('./src/integrations.ts');
    console.log(`   ✅ Integrations loaded`);
    results.push({ system: 'Integrations', status: 'OK' });
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
    results.push({ system: 'Integrations', status: 'FAILED', error: e.message });
  }
  
  // Test 5: OAuth Passport
  console.log('\n5. Loading OAuth Passport...');
  try {
    const oauth = await import('./src/integrations/oauth_passport.ts');
    console.log(`   ✅ OAuth Passport loaded`);
    results.push({ system: 'OAuth', status: 'OK' });
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
    results.push({ system: 'OAuth', status: 'FAILED', error: e.message });
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY:');
  const passed = results.filter(r => r.status === 'OK').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n🚨 ERRORS TO FIX:');
    results.filter(r => r.status === 'FAILED').forEach(r => {
      console.log(`   ${r.system}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL SYSTEMS OPERATIONAL!');
    console.log('\n📱 Ready for Replit:');
    console.log('1. npm install');
    console.log('2. npm run server:dev (Terminal 1)');
    console.log('3. npm run expo:dev (Terminal 2)');
  }
}

testSystems().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
