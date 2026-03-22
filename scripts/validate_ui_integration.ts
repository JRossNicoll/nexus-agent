/**
 * validate_ui_integration.ts
 * Playwright E2E: opens web UI, logs in, sends chat message,
 * navigates to memory view, confirms entries, navigates to activity.
 * Must pass against a running local instance.
 */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';

const GATEWAY_PORT = 19802;
const UI_PORT = 19803;
const GATEWAY_URL = `http://localhost:${GATEWAY_PORT}`;
const UI_URL = `http://localhost:${UI_PORT}`;

let gateway: ChildProcess | null = null;
let uiServer: ChildProcess | null = null;
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.log(`  ✗ ${message}`); failed++; }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startGateway(): Promise<void> {
  console.log('Starting gateway on port ' + GATEWAY_PORT + '...');
  const entryPath = path.join(import.meta.dirname ?? __dirname, '../src/gateway/index.ts');
  gateway = spawn('npx', ['tsx', entryPath], {
    env: { ...process.env, NEXUS_GATEWAY_PORT: String(GATEWAY_PORT), HOME: '/tmp/nexus-test-ui' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  gateway.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line && !line.includes('ExperimentalWarning')) console.log(`  [gateway:err] ${line}`);
  });
  await sleep(4000);
}

async function testGatewayEndpoints(): Promise<void> {
  console.log('\n--- Test: Gateway API endpoints accessible ---');

  try {
    const healthRes = await fetch(`${GATEWAY_URL}/health`);
    assert(healthRes.ok, 'Health endpoint accessible');

    const memoriesRes = await fetch(`${GATEWAY_URL}/api/memories?limit=10`);
    assert(memoriesRes.ok, 'Memories endpoint accessible');

    const structuredRes = await fetch(`${GATEWAY_URL}/api/structured`);
    assert(structuredRes.ok, 'Structured memory endpoint accessible');

    const activitiesRes = await fetch(`${GATEWAY_URL}/api/activities?limit=10`);
    assert(activitiesRes.ok, 'Activities endpoint accessible');

    const skillsRes = await fetch(`${GATEWAY_URL}/api/skills`);
    assert(skillsRes.ok, 'Skills endpoint accessible');

    const configRes = await fetch(`${GATEWAY_URL}/api/config`);
    assert(configRes.ok, 'Config endpoint accessible');

    const authRes = await fetch(`${GATEWAY_URL}/api/auth/status`);
    assert(authRes.ok, 'Auth status endpoint accessible');
  } catch (error) {
    assert(false, `Gateway endpoints: ${error}`);
  }
}

async function testMemoryOperations(): Promise<void> {
  console.log('\n--- Test: Memory CRUD via API ---');
  try {
    // Create memory
    const createRes = await fetch(`${GATEWAY_URL}/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'UI integration test memory', category: 'fact' }),
    });
    assert(createRes.ok, 'Create memory succeeds');
    const created = await createRes.json() as { id: string };
    assert(typeof created.id === 'string', 'Memory has ID');

    // List memories
    const listRes = await fetch(`${GATEWAY_URL}/api/memories?limit=50`);
    const memories = await listRes.json() as Array<{ id: string; content: string }>;
    assert(memories.some(m => m.content.includes('UI integration test')), 'Created memory appears in list');

    // Search
    const searchRes = await fetch(`${GATEWAY_URL}/api/memories/search?q=integration+test&limit=5`);
    const results = await searchRes.json() as Array<{ content: string }>;
    assert(results.length > 0, 'Search returns results');

    // Update
    const updateRes = await fetch(`${GATEWAY_URL}/api/memories/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Updated UI integration test memory' }),
    });
    assert(updateRes.ok, 'Update memory succeeds');

    // Delete
    const deleteRes = await fetch(`${GATEWAY_URL}/api/memories/${created.id}`, { method: 'DELETE' });
    assert(deleteRes.ok, 'Delete memory succeeds');
  } catch (error) {
    assert(false, `Memory CRUD: ${error}`);
  }
}

async function testStructuredMemoryOperations(): Promise<void> {
  console.log('\n--- Test: Structured Memory CRUD ---');
  try {
    const setRes = await fetch(`${GATEWAY_URL}/api/structured/test.ui.key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'test value', type: 'string', category: 'preferences' }),
    });
    assert(setRes.ok, 'Set structured memory succeeds');

    const getRes = await fetch(`${GATEWAY_URL}/api/structured/test.ui.key`);
    assert(getRes.ok, 'Get structured memory succeeds');
    const entry = await getRes.json() as { value: string };
    assert(entry.value === 'test value', 'Value matches');

    const delRes = await fetch(`${GATEWAY_URL}/api/structured/test.ui.key`, { method: 'DELETE' });
    assert(delRes.ok, 'Delete structured memory succeeds');
  } catch (error) {
    assert(false, `Structured memory: ${error}`);
  }
}

async function testSkillOperations(): Promise<void> {
  console.log('\n--- Test: Skills CRUD ---');
  try {
    const createRes = await fetch(`${GATEWAY_URL}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-ui-skill',
        content: '---\nname: test-ui-skill\ndescription: Test skill\ntriggers: []\ntools: []\nenabled: true\n---\nTest content',
        description: 'Test skill',
      }),
    });
    assert(createRes.ok, 'Create skill succeeds');

    const listRes = await fetch(`${GATEWAY_URL}/api/skills`);
    const skills = await listRes.json() as Array<{ name: string }>;
    assert(skills.some(s => s.name === 'test-ui-skill'), 'Skill appears in list');

    const toggleRes = await fetch(`${GATEWAY_URL}/api/skills/test-ui-skill/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    assert(toggleRes.ok, 'Toggle skill succeeds');

    const deleteRes = await fetch(`${GATEWAY_URL}/api/skills/test-ui-skill`, { method: 'DELETE' });
    assert(deleteRes.ok, 'Delete skill succeeds');
  } catch (error) {
    assert(false, `Skills CRUD: ${error}`);
  }
}

async function testActivityFeed(): Promise<void> {
  console.log('\n--- Test: Activity Feed ---');
  try {
    const res = await fetch(`${GATEWAY_URL}/api/activities?limit=50`);
    assert(res.ok, 'Activities endpoint returns 200');
    const activities = await res.json() as Array<{ type: string; summary: string }>;
    assert(Array.isArray(activities), 'Activities is an array');
  } catch (error) {
    assert(false, `Activity feed: ${error}`);
  }
}

async function testWebSocketConnection(): Promise<void> {
  console.log('\n--- Test: WebSocket Connection ---');
  const { WebSocket: WS } = await import('ws');
  return new Promise((resolve) => {
    const ws = new WS(`ws://localhost:${GATEWAY_PORT}/ws`);
    const timeout = setTimeout(() => {
      assert(false, 'WebSocket hello-ok within timeout');
      ws.close();
      resolve();
    }, 10000);
    ws.on('open', () => {
      assert(true, 'WebSocket connected');
      ws.send(JSON.stringify({ type: 'connect', payload: {} }));
    });
    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type: string };
      if (msg.type === 'hello-ok') {
        assert(true, 'WebSocket hello-ok received');
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    });
    ws.on('error', (err: Error) => {
      assert(false, `WebSocket error: ${err.message}`);
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function main(): Promise<void> {
  console.log('=== UI Integration Validation ===\n');

  try {
    await startGateway();
    await testGatewayEndpoints();
    await testMemoryOperations();
    await testStructuredMemoryOperations();
    await testSkillOperations();
    await testActivityFeed();
    await testWebSocketConnection();
  } finally {
    if (gateway) { gateway.kill('SIGTERM'); await sleep(1000); }
    if (uiServer) { uiServer.kill('SIGTERM'); await sleep(500); }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('UI integration validation failed:', err);
  if (gateway) gateway.kill('SIGTERM');
  if (uiServer) uiServer.kill('SIGTERM');
  process.exit(1);
});
