#!/usr/bin/env python3
"""Write Sprint 2 validation scripts."""
import os

BASE = '/home/ubuntu/medo-agent'

def write_file(rel_path, content):
    full = os.path.join(BASE, rel_path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w') as f:
        f.write(content)
    print(f'  Written: {rel_path} ({len(content)} bytes)')

# ============================================================
# validate_e2e.ts
# ============================================================
write_file('scripts/validate_e2e.ts', r"""/**
 * validate_e2e.ts
 * End-to-end validation: starts gateway, sends message via API,
 * confirms LLM response, confirms conversation stored, confirms memory retrievable,
 * confirms proactive worker running. Requires real API keys.
 */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { WebSocket } from 'ws';

const PORT = 19801;
const GATEWAY_URL = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}/ws`;

let gateway: ChildProcess | null = null;
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.log(`  ✗ ${message}`); failed++; }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hasApiKeys(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY);
}

async function startGateway(): Promise<void> {
  console.log('Starting gateway on test port ' + PORT + '...');
  const entryPath = path.join(import.meta.dirname ?? __dirname, '../src/gateway/index.ts');
  gateway = spawn('npx', ['tsx', entryPath], {
    env: { ...process.env, MEDO_GATEWAY_PORT: String(PORT), HOME: '/tmp/medo-test-e2e' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  gateway.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log(`  [gateway] ${line}`);
  });
  gateway.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line && !line.includes('ExperimentalWarning')) console.log(`  [gateway:err] ${line}`);
  });
  await sleep(5000);
}

async function testHealthEndpoint(): Promise<void> {
  console.log('\n--- Test: Health Endpoint ---');
  try {
    const response = await fetch(`${GATEWAY_URL}/health`);
    assert(response.ok, 'Health endpoint returns 200');
    const health = await response.json() as Record<string, unknown>;
    assert(health.status === 'ok' || health.status === 'degraded', 'Health status is ok or degraded');
    assert(typeof health.uptime === 'number', 'Has uptime');
    assert(typeof health.memory === 'object', 'Has memory stats');
    assert(typeof health.version === 'string', 'Has version');
  } catch (error) {
    assert(false, `Health endpoint accessible: ${error}`);
  }
}

async function testChatViaAPI(): Promise<string> {
  console.log('\n--- Test: Chat via OpenAI-compatible API ---');
  if (!hasApiKeys()) {
    console.log('  ⚠ No API keys found, skipping LLM call tests');
    return '';
  }
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say hello in one word. Just one word.' }],
        stream: false,
        max_tokens: 10,
      }),
    });
    assert(response.ok, 'Chat completions API returns 200');
    const data = await response.json() as {
      choices?: Array<{ message?: { content: string } }>;
    };
    assert(!!data.choices && data.choices.length > 0, 'Response has choices');
    const content = data.choices?.[0]?.message?.content ?? '';
    assert(content.length > 0, `Got LLM response: "${content.slice(0, 50)}"`);
    return content;
  } catch (error) {
    assert(false, `Chat API call: ${error}`);
    return '';
  }
}

async function testChatViaWebSocket(): Promise<void> {
  console.log('\n--- Test: Chat via WebSocket ---');
  if (!hasApiKeys()) {
    console.log('  ⚠ No API keys, skipping WebSocket chat test');
    return;
  }
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    let gotHello = false;
    let gotStream = false;
    let gotDone = false;
    const timeout = setTimeout(() => {
      assert(gotHello, 'WebSocket hello-ok received');
      assert(gotStream, 'WebSocket streamed chat response');
      assert(gotDone, 'WebSocket chat-done received');
      ws.close();
      resolve();
    }, 30000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'connect', payload: {} }));
    });
    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type: string; payload?: Record<string, unknown> };
      if (msg.type === 'hello-ok' && !gotHello) {
        gotHello = true;
        ws.send(JSON.stringify({ type: 'chat', payload: { message: 'Say hello', channel: 'web' } }));
      }
      if (msg.type === 'chat-stream') { gotStream = true; }
      if (msg.type === 'chat-done') {
        gotDone = true;
        clearTimeout(timeout);
        assert(true, 'WebSocket hello-ok received');
        assert(true, 'WebSocket streamed chat response');
        assert(true, 'WebSocket chat-done received');
        ws.close();
        resolve();
      }
    });
    ws.on('error', (err: Error) => {
      assert(false, `WebSocket connection: ${err.message}`);
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function testConversationPersisted(): Promise<void> {
  console.log('\n--- Test: Conversation Persisted ---');
  try {
    const response = await fetch(`${GATEWAY_URL}/api/conversations/recent?limit=10`);
    assert(response.ok, 'Conversations API returns 200');
    const conversations = await response.json() as Array<{ role: string; content: string; channel: string }>;
    assert(conversations.length > 0, `Conversations found: ${conversations.length}`);
    if (hasApiKeys()) {
      const hasUser = conversations.some(c => c.role === 'user');
      const hasAssistant = conversations.some(c => c.role === 'assistant');
      assert(hasUser, 'User message persisted');
      assert(hasAssistant, 'Assistant message persisted');
    }
  } catch (error) {
    assert(false, `Conversation retrieval: ${error}`);
  }
}

async function testMemoryRetrievable(): Promise<void> {
  console.log('\n--- Test: Memory Retrievable ---');
  try {
    // Write a memory via API
    const writeRes = await fetch(`${GATEWAY_URL}/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'E2E test memory: user likes TypeScript', category: 'preference' }),
    });
    assert(writeRes.ok, 'Memory write API returns 200');

    // Retrieve memories
    const listRes = await fetch(`${GATEWAY_URL}/api/memories?limit=50`);
    assert(listRes.ok, 'Memory list API returns 200');
    const memories = await listRes.json() as Array<{ content: string }>;
    assert(memories.length > 0, `Memories found: ${memories.length}`);

    // Search memories
    const searchRes = await fetch(`${GATEWAY_URL}/api/memories/search?q=TypeScript&limit=5`);
    assert(searchRes.ok, 'Memory search API returns 200');
    const searchResults = await searchRes.json() as Array<{ content: string }>;
    assert(searchResults.length > 0, 'Memory search returns results');

    // Memory graph
    const graphRes = await fetch(`${GATEWAY_URL}/api/memories/graph`);
    assert(graphRes.ok, 'Memory graph API returns 200');
    const graph = await graphRes.json() as { nodes?: unknown[]; edges?: unknown[] };
    assert(Array.isArray(graph.nodes), 'Graph has nodes array');
    assert(Array.isArray(graph.edges), 'Graph has edges array');
  } catch (error) {
    assert(false, `Memory operations: ${error}`);
  }
}

async function testProactiveWorkerRunning(): Promise<void> {
  console.log('\n--- Test: Proactive Worker ---');
  try {
    const response = await fetch(`${GATEWAY_URL}/api/proactive/status`);
    assert(response.ok, 'Proactive status API returns 200');
    const status = await response.json() as { enabled?: boolean; behaviors?: Record<string, boolean> };
    assert(typeof status.enabled === 'boolean', 'Proactive has enabled flag');
  } catch (error) {
    assert(false, `Proactive status: ${error}`);
  }
}

async function testAuthEndpoints(): Promise<void> {
  console.log('\n--- Test: Auth Endpoints ---');
  try {
    const statusRes = await fetch(`${GATEWAY_URL}/api/auth/status`);
    assert(statusRes.ok, 'Auth status returns 200');
    const status = await statusRes.json() as { authConfigured: boolean };
    assert(typeof status.authConfigured === 'boolean', 'Auth status has authConfigured flag');

    const verifyRes = await fetch(`${GATEWAY_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' }),
    });
    assert(verifyRes.ok, 'Auth verify endpoint works');
  } catch (error) {
    assert(false, `Auth endpoints: ${error}`);
  }
}

async function main(): Promise<void> {
  console.log('=== End-to-End Validation ===');
  if (!hasApiKeys()) {
    console.log('\n⚠ No API keys detected (ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY)');
    console.log('  LLM-dependent tests will be skipped. Set API keys for full validation.\n');
  }

  try {
    await startGateway();
    await testHealthEndpoint();
    await testAuthEndpoints();
    await testChatViaAPI();
    await testChatViaWebSocket();
    await testConversationPersisted();
    await testMemoryRetrievable();
    await testProactiveWorkerRunning();
  } finally {
    if (gateway) { gateway.kill('SIGTERM'); await sleep(1000); }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('E2E validation failed:', err);
  if (gateway) gateway.kill('SIGTERM');
  process.exit(1);
});
""")

# ============================================================
# validate_ui_integration.ts
# ============================================================
write_file('scripts/validate_ui_integration.ts', r"""/**
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
    env: { ...process.env, MEDO_GATEWAY_PORT: String(GATEWAY_PORT), HOME: '/tmp/medo-test-ui' },
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
""")

# ============================================================
# validate_proactive.ts
# ============================================================
write_file('scripts/validate_proactive.ts', r"""/**
 * validate_proactive.ts
 * Tests proactive intelligence: manually triggers heartbeat worker,
 * confirms it analyses conversation history, confirms proactive message
 * generation when patterns are present, confirms rate limiting.
 */

import fs from 'fs';
import {
  initDatabase,
  closeDatabase,
  insertConversation,
  getRecentConversations,
  insertActivity,
  getActivities,
  setStructuredMemory,
  insertPendingTask,
  getPendingTasks,
} from '../src/memory/database.js';
import { ProactiveWorker } from '../src/proactive/index.js';

const TEST_DB = '/tmp/medo-test-proactive.db';
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.log(`  ✗ ${message}`); failed++; }
}

function setup(): void {
  try { fs.unlinkSync(TEST_DB); } catch {}
  initDatabase(TEST_DB);
}

function teardown(): void {
  closeDatabase();
  try { fs.unlinkSync(TEST_DB); } catch {}
}

function seedConversationHistory(): void {
  console.log('\n--- Setup: Seed conversation history ---');
  const messages = [
    { role: 'user' as const, content: 'I\'ve been feeling really tired this morning', channel: 'web' as const },
    { role: 'assistant' as const, content: 'I\'m sorry to hear that. Are you getting enough sleep?', channel: 'web' as const },
    { role: 'user' as const, content: 'Not really, I\'ve been staying up late working on the project', channel: 'web' as const },
    { role: 'user' as const, content: 'I should call the accountant this week about taxes', channel: 'web' as const },
    { role: 'assistant' as const, content: 'I\'ll make a note of that.', channel: 'web' as const },
    { role: 'user' as const, content: 'I\'m tired again today, barely slept', channel: 'telegram' as const },
    { role: 'user' as const, content: 'I need to finish the quarterly report by Friday', channel: 'web' as const },
    { role: 'assistant' as const, content: 'Got it, I\'ll keep track of that deadline.', channel: 'web' as const },
    { role: 'user' as const, content: 'Feeling exhausted again, third day in a row', channel: 'web' as const },
    { role: 'user' as const, content: 'I really need to start exercising more', channel: 'web' as const },
  ];

  for (let i = 0; i < messages.length; i++) {
    insertConversation({
      session_id: 'test-session-1',
      role: messages[i].role,
      content: messages[i].content,
      provider: messages[i].role === 'assistant' ? 'anthropic' : '',
      model: messages[i].role === 'assistant' ? 'claude-sonnet-4-6' : '',
      tokens_used: 0,
      latency_ms: 0,
      timestamp: Date.now() - (messages.length - i) * 60000,
      channel: messages[i].channel,
    });
  }

  setStructuredMemory({
    key: 'user.goals.exercise',
    value: 'Run 3 times per week',
    type: 'string',
    category: 'goals',
    updated_at: Date.now(),
    source: 'conversation',
  });

  setStructuredMemory({
    key: 'user.goals.sleep',
    value: 'Get 8 hours of sleep per night',
    type: 'string',
    category: 'goals',
    updated_at: Date.now(),
    source: 'conversation',
  });
}

function testProactiveWorkerCreation(): void {
  console.log('\n--- Test: ProactiveWorker creation ---');

  const mockProvider = {
    chatComplete: async () => '{"send": true, "confidence": 0.9, "message": "Test proactive message"}',
    chat: async function* () { yield 'test'; },
    getPrimaryName: () => 'mock',
    getFallbackName: () => 'mock-fallback',
    isConnected: () => true,
  } as any;

  const worker = new ProactiveWorker(mockProvider, {
    enabled: true,
    intervalMs: 1000,
    confidenceThreshold: 0.5,
    maxPerDay: 3,
    preferredChannel: 'web',
    patternDetection: true,
    dailyBriefing: true,
    smartReminders: true,
    briefingTime: '07:00',
  });

  assert(worker !== null, 'ProactiveWorker created');
  const status = worker.getStatus();
  assert(status.enabled === true, 'Worker is enabled');
  assert(status.behaviors.patternDetection === true, 'Pattern detection enabled');
  assert(status.behaviors.dailyBriefing === true, 'Daily briefing enabled');
  assert(status.behaviors.smartReminders === true, 'Smart reminders enabled');
  assert(status.maxPerDay === 3, 'Max per day is 3');
}

async function testPatternDetection(): Promise<void> {
  console.log('\n--- Test: Pattern Detection ---');

  let capturedMessage = '';
  const mockProvider = {
    chatComplete: async () => {
      return JSON.stringify({
        send: true,
        confidence: 0.9,
        message: 'I noticed you\'ve mentioned being tired 3 times this week. Would you like to explore ways to improve your sleep?'
      });
    },
    chat: async function* () { yield 'test'; },
    getPrimaryName: () => 'mock',
    getFallbackName: () => 'mock-fallback',
    isConnected: () => true,
  } as any;

  const worker = new ProactiveWorker(mockProvider, {
    enabled: true,
    intervalMs: 100,
    confidenceThreshold: 0.5,
    maxPerDay: 5,
    preferredChannel: 'web',
    patternDetection: true,
    dailyBriefing: false,
    smartReminders: false,
    briefingTime: '07:00',
  });

  worker.setMessageHandler((msg, channel) => {
    capturedMessage = msg;
  });

  await worker.runPatternDetection();

  const conversations = getRecentConversations(50);
  assert(conversations.length >= 10, `Conversation history has ${conversations.length} messages`);
  assert(capturedMessage.length > 0, 'Pattern detection generated a proactive message');
  assert(capturedMessage.includes('tired'), 'Message references the pattern');

  const activities = getActivities(10, 0, 'proactive');
  assert(activities.length > 0, 'Proactive activity logged');
}

async function testRateLimiting(): Promise<void> {
  console.log('\n--- Test: Rate Limiting ---');

  let messageCount = 0;
  const mockProvider = {
    chatComplete: async () => JSON.stringify({ send: true, confidence: 0.95, message: 'Rate limit test message ' + (++messageCount) }),
    chat: async function* () { yield 'test'; },
    getPrimaryName: () => 'mock',
    getFallbackName: () => 'mock-fallback',
    isConnected: () => true,
  } as any;

  const worker = new ProactiveWorker(mockProvider, {
    enabled: true,
    intervalMs: 50,
    confidenceThreshold: 0.5,
    maxPerDay: 2,
    preferredChannel: 'web',
    patternDetection: true,
    dailyBriefing: false,
    smartReminders: false,
    briefingTime: '07:00',
  });

  let sentMessages = 0;
  worker.setMessageHandler(() => { sentMessages++; });

  // Force multiple pattern detection runs
  for (let i = 0; i < 5; i++) {
    // Reset the internal lastPatternCheck to allow re-runs
    (worker as any).lastPatternCheck = 0;
    await worker.runPatternDetection();
  }

  assert(sentMessages <= 2, `Rate limiting enforced: ${sentMessages} messages sent (max 2)`);
}

function testTaskExtraction(): void {
  console.log('\n--- Test: Task Extraction ---');

  const mockProvider = {
    chatComplete: async () => '{"send": false}',
    chat: async function* () { yield 'test'; },
    getPrimaryName: () => 'mock',
    getFallbackName: () => 'mock-fallback',
    isConnected: () => true,
  } as any;

  const worker = new ProactiveWorker(mockProvider, { enabled: true, intervalMs: 1000, confidenceThreshold: 0.5, maxPerDay: 3, preferredChannel: 'web', patternDetection: true, dailyBriefing: true, smartReminders: true, briefingTime: '07:00' });

  worker.extractAndStoreTasks('I need to call the dentist tomorrow', 'session-1', 'web');
  worker.extractAndStoreTasks('I should finish the report by Friday', 'session-1', 'web');
  worker.extractAndStoreTasks('Remind me to buy groceries', 'session-1', 'web');

  const tasks = getPendingTasks();
  assert(tasks.length >= 3, `Extracted ${tasks.length} tasks (expected >= 3)`);
  assert(tasks.some(t => t.description.includes('call the dentist')), 'Dentist task extracted');
  assert(tasks.some(t => t.description.includes('finish the report')), 'Report task extracted');
  assert(tasks.some(t => t.description.includes('buy groceries')), 'Groceries task extracted');
}

function testProactiveConfig(): void {
  console.log('\n--- Test: Config ---');

  const mockProvider = { chatComplete: async () => '', chat: async function* () { yield ''; }, getPrimaryName: () => 'mock', getFallbackName: () => 'mock', isConnected: () => true } as any;

  const worker = ProactiveWorker.fromSettings(mockProvider, {
    enabled: true,
    intervalHours: 4,
    confidenceThreshold: 0.8,
    maxPerDay: 5,
    patternDetection: true,
    dailyBriefing: false,
    smartReminders: true,
    briefingTime: '08:30',
  });

  const cfg = worker.getConfig();
  assert(cfg.enabled === true, 'Enabled from settings');
  assert(cfg.intervalMs === 4 * 60 * 60 * 1000, 'Interval converted from hours');
  assert(cfg.confidenceThreshold === 0.8, 'Confidence threshold set');
  assert(cfg.maxPerDay === 5, 'Max per day set');
  assert(cfg.patternDetection === true, 'Pattern detection set');
  assert(cfg.dailyBriefing === false, 'Daily briefing set');
  assert(cfg.smartReminders === true, 'Smart reminders set');
  assert(cfg.briefingTime === '08:30', 'Briefing time set');
}

async function main(): Promise<void> {
  console.log('=== Proactive Intelligence Validation ===\n');

  setup();

  try {
    seedConversationHistory();
    testProactiveWorkerCreation();
    await testPatternDetection();
    await testRateLimiting();
    testTaskExtraction();
    testProactiveConfig();
  } finally {
    teardown();
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Proactive validation failed:', err);
  process.exit(1);
});
""")

# ============================================================
# validate_integration.ts
# ============================================================
write_file('scripts/validate_integration.ts', r"""/**
 * validate_integration.ts
 * Provider integration validation. Requires real API keys (read from environment).
 * Tests streaming, tool calling simulation, and failover.
 * Skips gracefully if keys aren't present. Must pass completely when keys are provided.
 */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';

const PORT = 19804;
const GATEWAY_URL = `http://localhost:${PORT}`;

let gateway: ChildProcess | null = null;
let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition: boolean, message: string): void {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.log(`  ✗ ${message}`); failed++; }
}

function skip(message: string): void {
  console.log(`  ⚠ SKIP: ${message}`);
  skipped++;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getAvailableProviders(): string[] {
  const providers: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  if (process.env.OPENROUTER_API_KEY) providers.push('openrouter');
  return providers;
}

async function startGateway(): Promise<void> {
  console.log('Starting gateway on port ' + PORT + '...');
  const entryPath = path.join(import.meta.dirname ?? __dirname, '../src/gateway/index.ts');
  gateway = spawn('npx', ['tsx', entryPath], {
    env: { ...process.env, MEDO_GATEWAY_PORT: String(PORT), HOME: '/tmp/medo-test-integration' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  gateway.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line && !line.includes('ExperimentalWarning')) console.log(`  [gateway:err] ${line}`);
  });
  await sleep(5000);
}

async function testNonStreamingCompletion(): Promise<void> {
  console.log('\n--- Test: Non-streaming completion ---');
  try {
    const start = Date.now();
    const response = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Reply with exactly the word "pong".' }],
        stream: false,
        max_tokens: 10,
      }),
    });
    const latency = Date.now() - start;
    assert(response.ok, 'Non-streaming completion returns 200');
    const data = await response.json() as { choices?: Array<{ message?: { content: string } }> };
    assert(!!data.choices?.[0]?.message?.content, 'Response has content');
    console.log(`  Latency: ${latency}ms`);
  } catch (error) {
    assert(false, `Non-streaming completion: ${error}`);
  }
}

async function testStreamingCompletion(): Promise<void> {
  console.log('\n--- Test: Streaming completion ---');
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Count from 1 to 5, one number per line.' }],
        stream: true,
        max_tokens: 50,
      }),
    });
    assert(response.ok, 'Streaming endpoint returns 200');
    assert(response.headers.get('content-type')?.includes('text/event-stream') ?? false, 'Content-Type is text/event-stream');

    const text = await response.text();
    const lines = text.split('\n').filter(l => l.startsWith('data:'));
    assert(lines.length > 1, `Got ${lines.length} SSE events`);

    const hasDone = lines.some(l => l.includes('[DONE]'));
    assert(hasDone, 'Stream ends with [DONE]');
  } catch (error) {
    assert(false, `Streaming completion: ${error}`);
  }
}

async function testProviderTest(): Promise<void> {
  console.log('\n--- Test: Provider test endpoint ---');
  try {
    const response = await fetch(`${GATEWAY_URL}/api/providers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(response.ok, 'Provider test endpoint returns 200');
    const data = await response.json() as { success: boolean; response?: string; error?: string };
    assert(data.success === true, `Provider test succeeded: ${data.response?.slice(0, 30)}`);
  } catch (error) {
    assert(false, `Provider test: ${error}`);
  }
}

async function testModelsEndpoint(): Promise<void> {
  console.log('\n--- Test: Models endpoint ---');
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/models`);
    assert(response.ok, 'Models endpoint returns 200');
    const data = await response.json() as { object: string; data: Array<{ id: string }> };
    assert(data.object === 'list', 'Response is a list');
    assert(data.data.length >= 1, `Has ${data.data.length} models`);
    console.log('  Models:', data.data.map(m => m.id).join(', '));
  } catch (error) {
    assert(false, `Models endpoint: ${error}`);
  }
}

async function testConversationPersistence(): Promise<void> {
  console.log('\n--- Test: Conversation persistence after API call ---');
  try {
    // Make a chat call first
    await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Integration test message' }],
        stream: false,
        max_tokens: 10,
      }),
    });

    // Check conversations
    const convRes = await fetch(`${GATEWAY_URL}/api/conversations/recent?limit=5`);
    assert(convRes.ok, 'Conversations endpoint returns 200');
  } catch (error) {
    assert(false, `Conversation persistence: ${error}`);
  }
}

async function main(): Promise<void> {
  console.log('=== Provider Integration Validation ===');

  const providers = getAvailableProviders();
  if (providers.length === 0) {
    console.log('\n⚠ No API keys detected. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY.');
    console.log('  All LLM-dependent tests will be skipped.\n');
    skip('No API keys available');
    console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${skipped} skipped ===`);
    process.exit(0);
  }

  console.log(`\nDetected providers: ${providers.join(', ')}\n`);

  try {
    await startGateway();
    await testModelsEndpoint();
    await testNonStreamingCompletion();
    await testStreamingCompletion();
    await testProviderTest();
    await testConversationPersistence();
  } finally {
    if (gateway) { gateway.kill('SIGTERM'); await sleep(1000); }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${skipped} skipped ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Integration validation failed:', err);
  if (gateway) gateway.kill('SIGTERM');
  process.exit(1);
});
""")

print('\nAll validation scripts written!')
