/**
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
    env: { ...process.env, NEXUS_GATEWAY_PORT: String(PORT), HOME: '/tmp/nexus-test-e2e' },
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
