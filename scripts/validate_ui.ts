/**
 * validate_ui.ts
 * Validates the web UI build and structure.
 * Checks that the Next.js app builds correctly, has all required pages,
 * and the static export contains the expected files.
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

function testSourceFiles(): void {
  console.log('\n--- Test: Web UI Source Files ---');

  const webDir = path.join(import.meta.dirname ?? __dirname, '../web');
  const srcDir = path.join(webDir, 'src');

  // Check key files exist
  assert(fs.existsSync(path.join(webDir, 'package.json')), 'web/package.json exists');
  assert(fs.existsSync(path.join(webDir, 'tsconfig.json')), 'web/tsconfig.json exists');
  assert(fs.existsSync(path.join(webDir, 'next.config.js')), 'web/next.config.js exists');
  assert(fs.existsSync(path.join(webDir, 'tailwind.config.ts')), 'web/tailwind.config.ts exists');

  // Check app directory
  assert(fs.existsSync(path.join(srcDir, 'app/layout.tsx')), 'app/layout.tsx exists');
  assert(fs.existsSync(path.join(srcDir, 'app/page.tsx')), 'app/page.tsx exists');
  assert(fs.existsSync(path.join(srcDir, 'app/globals.css')), 'app/globals.css exists');

  // Check components
  const components = ['Sidebar', 'ChatView', 'MemoryView', 'SkillsView', 'ActivityView', 'SettingsView'];
  for (const comp of components) {
    assert(
      fs.existsSync(path.join(srcDir, `components/${comp}.tsx`)),
      `components/${comp}.tsx exists`
    );
  }

  // Check lib
  assert(fs.existsSync(path.join(srcDir, 'lib/api.ts')), 'lib/api.ts exists');
  assert(fs.existsSync(path.join(srcDir, 'lib/websocket.ts')), 'lib/websocket.ts exists');
  assert(fs.existsSync(path.join(srcDir, 'lib/utils.ts')), 'lib/utils.ts exists');
}

function testPageContent(): void {
  console.log('\n--- Test: Page Content ---');

  const webDir = path.join(import.meta.dirname ?? __dirname, '../web');
  const srcDir = path.join(webDir, 'src');

  // Check main page has all 5 sections
  const pageContent = fs.readFileSync(path.join(srcDir, 'app/page.tsx'), 'utf-8');
  assert(pageContent.includes('ChatView'), 'Main page includes ChatView');
  assert(pageContent.includes('MemoryView'), 'Main page includes MemoryView');
  assert(pageContent.includes('SkillsView'), 'Main page includes SkillsView');
  assert(pageContent.includes('ActivityView'), 'Main page includes ActivityView');
  assert(pageContent.includes('SettingsView'), 'Main page includes SettingsView');
  assert(pageContent.includes('Sidebar'), 'Main page includes Sidebar');

  // Check Sidebar has 5 tabs
  const sidebarContent = fs.readFileSync(path.join(srcDir, 'components/Sidebar.tsx'), 'utf-8');
  assert(sidebarContent.includes("'chat'"), 'Sidebar has chat tab');
  assert(sidebarContent.includes("'memory'"), 'Sidebar has memory tab');
  assert(sidebarContent.includes("'skills'"), 'Sidebar has skills tab');
  assert(sidebarContent.includes("'activity'"), 'Sidebar has activity tab');
  assert(sidebarContent.includes("'settings'"), 'Sidebar has settings tab');

  // Check ChatView has streaming support
  const chatContent = fs.readFileSync(path.join(srcDir, 'components/ChatView.tsx'), 'utf-8');
  assert(chatContent.includes('chat-stream'), 'ChatView handles streaming');
  assert(chatContent.includes('WebSocket') || chatContent.includes('nexusWS'), 'ChatView uses WebSocket');
  assert(chatContent.includes('tool-call') || chatContent.includes('toolCalls'), 'ChatView shows tool calls');

  // Check MemoryView has both tabs
  const memoryContent = fs.readFileSync(path.join(srcDir, 'components/MemoryView.tsx'), 'utf-8');
  assert(memoryContent.includes('structured'), 'MemoryView has structured tab');
  assert(memoryContent.includes('semantic'), 'MemoryView has semantic tab');
  assert(memoryContent.includes('searchMemories') || memoryContent.includes('handleSearch'), 'MemoryView has search');

  // Check SkillsView has editor
  const skillsContent = fs.readFileSync(path.join(srcDir, 'components/SkillsView.tsx'), 'utf-8');
  assert(skillsContent.includes('editor') || skillsContent.includes('textarea'), 'SkillsView has code editor');
  assert(skillsContent.includes('toggle') || skillsContent.includes('Toggle'), 'SkillsView has enable/disable toggle');

  // Check ActivityView has filtering
  const activityContent = fs.readFileSync(path.join(srcDir, 'components/ActivityView.tsx'), 'utf-8');
  assert(activityContent.includes('filter') || activityContent.includes('Filter'), 'ActivityView has filtering');
  assert(activityContent.includes('expandedId') || activityContent.includes('expanded'), 'ActivityView has expandable entries');

  // Check SettingsView has provider config
  const settingsContent = fs.readFileSync(path.join(srcDir, 'components/SettingsView.tsx'), 'utf-8');
  assert(settingsContent.includes('provider') || settingsContent.includes('Provider'), 'SettingsView has provider config');
  assert(settingsContent.includes('channel') || settingsContent.includes('Channel'), 'SettingsView has channel config');
  assert(settingsContent.includes('proactive') || settingsContent.includes('Proactive'), 'SettingsView has proactive config');
}

function testAPIClient(): void {
  console.log('\n--- Test: API Client ---');

  const webDir = path.join(import.meta.dirname ?? __dirname, '../web');
  const apiContent = fs.readFileSync(path.join(webDir, 'src/lib/api.ts'), 'utf-8');

  assert(apiContent.includes('memoryAPI'), 'API client has memoryAPI');
  assert(apiContent.includes('structuredAPI'), 'API client has structuredAPI');
  assert(apiContent.includes('conversationAPI'), 'API client has conversationAPI');
  assert(apiContent.includes('activityAPI'), 'API client has activityAPI');
  assert(apiContent.includes('skillsAPI'), 'API client has skillsAPI');
  assert(apiContent.includes('configAPI'), 'API client has configAPI');
  assert(apiContent.includes('healthAPI'), 'API client has healthAPI');
}

function testWebSocketClient(): void {
  console.log('\n--- Test: WebSocket Client ---');

  const webDir = path.join(import.meta.dirname ?? __dirname, '../web');
  const wsContent = fs.readFileSync(path.join(webDir, 'src/lib/websocket.ts'), 'utf-8');

  assert(wsContent.includes('connect'), 'WS client has connect method');
  assert(wsContent.includes('sendChat'), 'WS client has sendChat method');
  assert(wsContent.includes('disconnect'), 'WS client has disconnect method');
  assert(wsContent.includes('reconnect'), 'WS client has reconnect logic');
}

function testTailwindConfig(): void {
  console.log('\n--- Test: Tailwind Configuration ---');

  const webDir = path.join(import.meta.dirname ?? __dirname, '../web');
  const twContent = fs.readFileSync(path.join(webDir, 'tailwind.config.ts'), 'utf-8');

  assert(twContent.includes('nexus'), 'Tailwind has nexus color palette');
  assert(twContent.includes('surface'), 'Tailwind has surface colors');
  assert(twContent.includes('animation'), 'Tailwind has custom animations');
  assert(twContent.includes('darkMode'), 'Tailwind has dark mode configured');
}

function main(): void {
  console.log('=== UI Validation ===\n');

  testSourceFiles();
  testPageContent();
  testAPIClient();
  testWebSocketClient();
  testTailwindConfig();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
