/**
 * validate_gateway.ts
 * Starts the gateway, connects via WebSocket, sends a connect frame,
 * asserts hello-ok response, sends a chat message, checks /health endpoint.
 */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { WebSocket } from 'ws';

const PORT = 19799; // Use a test port to avoid conflicts
const GATEWAY_URL = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}/ws`;

let gateway: ChildProcess | null = null;
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

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startGateway(): Promise<void> {
  console.log('Starting gateway on test port...');

  const entryPath = path.join(import.meta.dirname ?? __dirname, '../src/gateway/index.ts');

  gateway = spawn('npx', ['tsx', entryPath], {
    env: {
      ...process.env,
      MEDO_GATEWAY_PORT: String(PORT),
      HOME: '/tmp/medo-test-gateway',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  gateway.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log(`  [gateway] ${line}`);
  });

  gateway.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line && !line.includes('ExperimentalWarning')) {
      console.log(`  [gateway:err] ${line}`);
    }
  });

  // Wait for gateway to start
  await sleep(4000);
}

async function testHealthEndpoint(): Promise<void> {
  console.log('\n--- Test: Health Endpoint ---');

  try {
    const response = await fetch(`${GATEWAY_URL}/health`);
    assert(response.ok, 'Health endpoint returns 200');

    const health = await response.json() as Record<string, unknown>;
    assert(typeof health.status === 'string', 'Health has status field');
    assert(typeof health.uptime === 'number', 'Health has uptime field');
    assert(typeof health.provider === 'object' && health.provider !== null, 'Health has provider field');
    assert(typeof health.memory === 'object' && health.memory !== null, 'Health has memory field');
    assert(typeof health.activeCronJobs === 'number', 'Health has activeCronJobs field');
    assert(typeof health.version === 'string', 'Health has version field');

    const provider = health.provider as Record<string, unknown>;
    assert(typeof provider.primary === 'string', 'Provider has primary field');
    assert(typeof provider.fallback === 'string', 'Provider has fallback field');

    const memory = health.memory as Record<string, unknown>;
    assert(typeof memory.totalMemories === 'number', 'Memory has totalMemories');
    assert(typeof memory.totalConversations === 'number', 'Memory has totalConversations');
  } catch (error) {
    assert(false, `Health endpoint accessible: ${error}`);
  }
}

async function testWebSocket(): Promise<void> {
  console.log('\n--- Test: WebSocket Connection ---');

  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    let helloReceived = false;

    const timeout = setTimeout(() => {
      assert(false, 'WebSocket response within timeout');
      ws.close();
      resolve();
    }, 10000);

    ws.on('open', () => {
      assert(true, 'WebSocket connected');
      ws.send(JSON.stringify({ type: 'connect', payload: {} }));
    });

    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type: string; payload?: Record<string, unknown>; timestamp?: number };

      if (msg.type === 'hello-ok' && !helloReceived) {
        helloReceived = true;
        assert(true, 'Received hello-ok response');
        assert(typeof msg.payload === 'object', 'hello-ok has payload');
        assert(typeof msg.timestamp === 'number', 'hello-ok has timestamp');

        const payload = msg.payload as Record<string, unknown>;
        assert(typeof payload.version === 'string', 'hello-ok payload has version');
        assert(Array.isArray(payload.features), 'hello-ok payload has features array');

        // Test ping
        ws.send(JSON.stringify({ type: 'ping' }));
      }

      if (msg.type === 'pong') {
        assert(true, 'Received pong response');
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    });

    ws.on('error', (error: Error) => {
      assert(false, `WebSocket error: ${error.message}`);
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function testOpenAICompatibleAPI(): Promise<void> {
  console.log('\n--- Test: OpenAI-Compatible API ---');

  try {
    // Test models endpoint
    const modelsRes = await fetch(`${GATEWAY_URL}/v1/models`);
    assert(modelsRes.ok, 'Models endpoint returns 200');
    const models = await modelsRes.json() as { object: string; data: unknown[] };
    assert(models.object === 'list', 'Models response has object: list');
    assert(Array.isArray(models.data), 'Models response has data array');
  } catch (error) {
    assert(false, `OpenAI API accessible: ${error}`);
  }
}

async function testWebhookEndpoint(): Promise<void> {
  console.log('\n--- Test: Webhook Endpoint ---');

  try {
    const response = await fetch(`${GATEWAY_URL}/hooks/test-hook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'test', data: 'hello' }),
    });
    assert(response.ok, 'Webhook endpoint returns 200');

    const result = await response.json() as { received: boolean; hook: string };
    assert(result.received === true, 'Webhook confirms receipt');
    assert(result.hook === 'test-hook', 'Webhook returns hook name');
  } catch (error) {
    assert(false, `Webhook endpoint accessible: ${error}`);
  }
}

async function main(): Promise<void> {
  console.log('=== Gateway Validation ===\n');

  try {
    await startGateway();
    await testHealthEndpoint();
    await testWebSocket();
    await testOpenAICompatibleAPI();
    await testWebhookEndpoint();
  } finally {
    if (gateway) {
      gateway.kill('SIGTERM');
      await sleep(1000);
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Validation failed:', err);
  if (gateway) gateway.kill('SIGTERM');
  process.exit(1);
});
