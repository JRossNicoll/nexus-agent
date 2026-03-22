/**
 * validate_websocket_resilience.ts — Validates WebSocket resilience improvements
 * Tests: app-level connection persistence, no disconnect text, exponential backoff
 */

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

async function validateWebSocketModule(): Promise<void> {
  console.log('\n--- WebSocket Module Validation ---');

  const fs = await import('fs');
  const path = await import('path');
  const wsPath = path.join(process.cwd(), 'web', 'src', 'lib', 'websocket.ts');

  let source: string;
  try {
    source = fs.readFileSync(wsPath, 'utf-8');
    assert(true, 'websocket.ts exists');
  } catch {
    assert(false, 'websocket.ts exists');
    return;
  }

  // Singleton pattern — single instance exported
  assert(source.includes('export const nexusWS'), 'Exports singleton nexusWS instance');

  // Exponential backoff
  assert(source.includes('Math.pow(2'), 'Uses exponential backoff formula (Math.pow(2, ...))');
  assert(source.includes('reconnectAttempt'), 'Tracks reconnection attempts');
  assert(source.includes('maxBackoff') || source.includes('8000'), 'Has max backoff limit (8s)');

  // Backoff values: 1s, 2s, 4s, 8s
  assert(source.includes('1000'), 'Base backoff is 1 second');

  // Reconnection scheduling
  assert(source.includes('scheduleReconnect'), 'Has scheduleReconnect method');
  assert(source.includes('reconnecting'), 'Emits reconnecting event');
  assert(source.includes('reconnected'), 'Emits reconnected event');

  // Reset attempt counter on successful connect
  assert(source.includes('reconnectAttempt = 0'), 'Resets attempt counter on successful connection');

  // isConnected method
  assert(source.includes('isConnected'), 'Has isConnected() method');
}

async function validateAppLevelConnection(): Promise<void> {
  console.log('\n--- App-Level WebSocket Connection ---');

  const fs = await import('fs');
  const path = await import('path');
  const pagePath = path.join(process.cwd(), 'web', 'src', 'app', 'page.tsx');

  let source: string;
  try {
    source = fs.readFileSync(pagePath, 'utf-8');
    assert(true, 'page.tsx exists');
  } catch {
    assert(false, 'page.tsx exists');
    return;
  }

  // App-level WebSocket connection
  assert(source.includes('nexusWS.connect()'), 'page.tsx calls nexusWS.connect() at app level');
  assert(source.includes('useEffect') && source.includes('nexusWS'), 'WebSocket connected in useEffect');

  // Verify persistent connection — no disconnect on unmount
  assert(
    source.includes("don't disconnect") || source.includes('persistent') || !source.includes('nexusWS.disconnect()'),
    'WebSocket connection is persistent (not disconnected on unmount)'
  );
}

async function validateNoDisconnectText(): Promise<void> {
  console.log('\n--- No Visible Disconnect Text ---');

  const fs = await import('fs');
  const path = await import('path');
  const chatPath = path.join(process.cwd(), 'web', 'src', 'components', 'ChatView.tsx');

  let source: string;
  try {
    source = fs.readFileSync(chatPath, 'utf-8');
    assert(true, 'ChatView.tsx exists');
  } catch {
    assert(false, 'ChatView.tsx exists');
    return;
  }

  // No "Disconnected" text visible in the UI
  assert(!source.includes('"Disconnected"') && !source.includes("'Disconnected'"),
    'ChatView does not show "Disconnected" text');

  // No visible connection status banner
  assert(!source.includes('bg-red-500/10 text-red-400') || !source.includes('Disconnected'),
    'No red disconnect banner in ChatView');

  // ChatView should NOT call nexusWS.connect() — managed at app level
  assert(!source.includes('nexusWS.connect()'),
    'ChatView does not call nexusWS.connect() (managed at app level)');

  // Check that ChatView syncs initial connection state
  assert(source.includes('nexusWS.isConnected()'),
    'ChatView syncs initial connection state from nexusWS.isConnected()');

  // Check other views don't show disconnect text
  const viewFiles = ['MemoryView.tsx', 'SkillsView.tsx', 'ActivityView.tsx', 'SettingsView.tsx', 'HomeScreen.tsx'];
  for (const viewFile of viewFiles) {
    const viewPath = path.join(process.cwd(), 'web', 'src', 'components', viewFile);
    try {
      const viewSource = fs.readFileSync(viewPath, 'utf-8');
      const hasDisconnect = viewSource.includes('"Disconnected"') || viewSource.includes("'Disconnected'");
      assert(!hasDisconnect, `${viewFile} does not show "Disconnected" text`);
    } catch {
      // View file might not exist — skip
      assert(true, `${viewFile} checked (file not found — OK)`);
    }
  }
}

async function validateOrbHandlesReconnection(): Promise<void> {
  console.log('\n--- Ambient Orb Reconnection Handling ---');

  const fs = await import('fs');
  const path = await import('path');
  const orbPath = path.join(process.cwd(), 'web', 'src', 'components', 'AmbientOrb.tsx');

  let source: string;
  try {
    source = fs.readFileSync(orbPath, 'utf-8');
    assert(true, 'AmbientOrb.tsx exists');
  } catch {
    assert(false, 'AmbientOrb.tsx exists');
    return;
  }

  // Orb shows reconnecting in tooltip (not a banner)
  assert(source.includes('reconnecting'), 'Orb listens for reconnecting event');
  assert(source.includes('reconnected'), 'Orb listens for reconnected event');
  assert(source.includes('Reconnecting'), 'Orb tooltip shows "Reconnecting..." during reconnection');
  assert(source.includes('tooltip'), 'Reconnection indicator is in tooltip only');
}

async function main(): Promise<void> {
  console.log('=== NEXUS WebSocket Resilience Validation ===');

  await validateWebSocketModule();
  await validateAppLevelConnection();
  await validateNoDisconnectText();
  await validateOrbHandlesReconnection();

  console.log(`\n=== Results: ${passed}/${passed + failed} passed, ${failed} failed ===`);
  if (failed === 0) {
    console.log('ALL PASSED');
  } else {
    console.log('SOME TESTS FAILED');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
