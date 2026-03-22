// Validate WebSocket resilience: connection, reconnection with exponential backoff
import WebSocket from 'ws';

const GATEWAY = process.env.NEXUS_GATEWAY_PORT ? `ws://localhost:${process.env.NEXUS_GATEWAY_PORT}` : 'ws://localhost:18799';

let passed = 0;
let failed = 0;
let total = 0;

function check(name: string, condition: boolean): void {
  total++;
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}`);
    failed++;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWebSocket(): Promise<void> {
  console.log('=== WebSocket Resilience Validation ===\n');

  // Test 1: Basic connection
  console.log('--- Basic Connection ---');
  const ws = new WebSocket(GATEWAY);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
    ws.on('open', () => {
      clearTimeout(timeout);
      check('WebSocket connects successfully', true);
      resolve();
    });
    ws.on('error', (err) => {
      clearTimeout(timeout);
      check('WebSocket connects successfully', false);
      console.log(`    Error: ${err.message}`);
      reject(err);
    });
  });

  // Test 2: Send hello message
  console.log('\n--- Hello Handshake ---');
  ws.send(JSON.stringify({ type: 'connect', payload: { client: 'validator' } }));

  const helloResponse = await new Promise<string>((resolve) => {
    const timeout = setTimeout(() => resolve('timeout'), 3000);
    ws.on('message', (data: Buffer) => {
      clearTimeout(timeout);
      resolve(data.toString());
    });
  });

  check('Receives hello-ok response', helloResponse !== 'timeout' && helloResponse.includes('hello-ok'));

  // Test 3: Ping/pong
  console.log('\n--- Ping/Pong ---');
  ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));

  const pongResponse = await new Promise<string>((resolve) => {
    const timeout = setTimeout(() => resolve('timeout'), 3000);
    ws.on('message', (data: Buffer) => {
      clearTimeout(timeout);
      resolve(data.toString());
    });
  });

  check('Responds to ping with pong', pongResponse !== 'timeout' && pongResponse.includes('pong'));

  // Test 4: Chat message flow
  console.log('\n--- Chat Message ---');
  ws.send(JSON.stringify({
    type: 'chat',
    payload: { message: 'Hello, this is a validation test. Reply with one word.' },
    timestamp: Date.now(),
  }));

  let gotStream = false;
  let gotDone = false;
  let gotTrace = false;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 15000);
    const handler = (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes('chat-stream')) gotStream = true;
      if (msg.includes('chat-done')) { gotDone = true; clearTimeout(timeout); resolve(); }
      if (msg.includes('execution-trace')) gotTrace = true;
    };
    ws.on('message', handler);
  });

  check('Receives chat-stream events', gotStream);
  check('Receives chat-done event', gotDone);
  check('Receives execution-trace events', gotTrace);

  // Test 5: Exponential backoff parameters exist in client code
  console.log('\n--- Exponential Backoff (code check) ---');
  const fs = await import('fs');
  const wsCode = fs.readFileSync('web/src/lib/websocket.ts', 'utf-8');
  check('WebSocket client has maxBackoff parameter', wsCode.includes('maxBackoff'));
  check('WebSocket client has reconnectAttempt counter', wsCode.includes('reconnectAttempt'));
  check('WebSocket client uses exponential calculation', wsCode.includes('Math.pow') || wsCode.includes('**'));
  check('WebSocket client emits reconnecting event', wsCode.includes('reconnecting'));
  check('WebSocket client emits reconnected event', wsCode.includes('reconnected'));

  ws.close();
  await sleep(500);

  console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
  console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
  process.exit(failed);
}

testWebSocket().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
