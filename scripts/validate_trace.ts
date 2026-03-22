// Validate dynamic execution trace events via WebSocket
import WebSocket from 'ws';

const GATEWAY_WS = process.env.NEXUS_GATEWAY_PORT ? `ws://localhost:${process.env.NEXUS_GATEWAY_PORT}` : 'ws://localhost:18799';

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

async function validate(): Promise<void> {
  console.log('=== Execution Trace Validation ===\n');

  // Connect via WebSocket
  console.log('--- WebSocket Connection ---');
  const ws = new WebSocket(GATEWAY_WS);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
    ws.on('open', () => { clearTimeout(timeout); resolve(); });
    ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
  check('WebSocket connected', true);

  // Send hello
  ws.send(JSON.stringify({ type: 'connect', payload: { client: 'trace-validator' } }));
  await sleep(500);

  // Send a chat message and collect all trace events
  console.log('\n--- Dynamic Execution Trace ---');
  const traceEvents: Array<{ step: string; status: string }> = [];
  const otherEvents: string[] = [];
  let gotChatDone = false;

  const messageHandler = (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'execution-trace') {
        traceEvents.push(msg.payload);
      } else if (msg.type === 'chat-done') {
        gotChatDone = true;
      } else {
        otherEvents.push(msg.type);
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.on('message', messageHandler);

  // Send chat message
  ws.send(JSON.stringify({
    type: 'chat',
    payload: { message: 'What is the capital of France? Answer in one word.' },
    timestamp: Date.now(),
  }));

  // Wait for response to complete
  const maxWait = 20000;
  const startTime = Date.now();
  while (!gotChatDone && Date.now() - startTime < maxWait) {
    await sleep(200);
  }

  check('Chat completed (chat-done received)', gotChatDone);
  check('Received execution trace events', traceEvents.length > 0);

  // Check for dynamic trace steps
  const steps = traceEvents.map(e => e.step);
  const statuses = traceEvents.map(e => e.status);

  console.log(`\n  Trace steps received (${traceEvents.length}):`);
  for (const e of traceEvents) {
    console.log(`    [${e.status}] ${e.step}`);
  }

  // Verify we get understanding step
  check('Has "Understanding" trace step', steps.some(s => s.toLowerCase().includes('understanding') || s.toLowerCase().includes('analyz')));

  // Verify we get memory search step
  check('Has memory search trace step', steps.some(s => s.toLowerCase().includes('memor') || s.toLowerCase().includes('search')));

  // Verify we get thinking/generating step
  check('Has thinking/generating trace step', steps.some(s => s.toLowerCase().includes('think') || s.toLowerCase().includes('generat') || s.toLowerCase().includes('response')));

  // Verify we get both active and done statuses
  check('Has active status traces', statuses.includes('active'));
  check('Has done status traces', statuses.includes('done'));

  // Verify trace events have more than just 3 fixed steps (dynamic)
  const uniqueStepTexts = new Set(steps);
  check('Trace has multiple unique step descriptions', uniqueStepTexts.size >= 3);

  // Verify no technical jargon in trace steps
  const hasJargon = steps.some(s => s.includes('WebSocket') || s.includes('database'));
  check('Trace steps use plain language (no jargon)', !hasJargon);

  // Check execution-trace is in backend websocket code
  console.log('\n--- Backend Trace Implementation ---');
  const fs = await import('fs');
  const wsCode = fs.readFileSync('src/gateway/websocket.ts', 'utf-8');
  check('Backend sends execution-trace events', wsCode.includes("'execution-trace'"));
  check('Backend has trace helper function', wsCode.includes('const trace'));
  check('Backend sends dynamic step descriptions', wsCode.includes('Understanding your message') || wsCode.includes('Searching your memories'));

  ws.close();
  await sleep(500);

  console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
  console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
  process.exit(failed);
}

validate().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
