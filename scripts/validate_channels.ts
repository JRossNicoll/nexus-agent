/**
 * validate_channels.ts
 * Tests channel integration by simulating inbound messages
 * and verifying they appear in conversation history.
 */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';

const PORT = 19798;
const GATEWAY_URL = `http://localhost:${PORT}`;

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
  console.log('Starting gateway for channel tests...');

  const entryPath = path.join(import.meta.dirname ?? __dirname, '../src/gateway/index.ts');

  gateway = spawn('npx', ['tsx', entryPath], {
    env: {
      ...process.env,
      NEXUS_GATEWAY_PORT: String(PORT),
      HOME: '/tmp/nexus-test-channels',
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

  await sleep(4000);
}

async function testWebhookChannel(): Promise<void> {
  console.log('\n--- Test: Webhook Channel ---');

  // Send a simulated webhook message
  const webhookPayload = {
    source: 'telegram',
    message: 'Hello from simulated Telegram webhook',
    chat_id: 12345,
    timestamp: Date.now(),
  };

  try {
    const response = await fetch(`${GATEWAY_URL}/hooks/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    assert(response.ok, 'Webhook returns 200');

    const result = await response.json() as { received: boolean; hook: string };
    assert(result.received === true, 'Webhook confirms receipt');
    assert(result.hook === 'telegram', 'Hook name is "telegram"');

    // Wait a moment for the message to be stored
    await sleep(1000);

    // Check conversation history
    const convResponse = await fetch(`${GATEWAY_URL}/api/conversations/recent?limit=10`);
    assert(convResponse.ok, 'Conversations endpoint returns 200');

    const conversations = await convResponse.json() as Array<{ channel: string; content: string; role: string }>;
    const webhookMsg = conversations.find(c => c.channel === 'webhook');
    assert(webhookMsg !== undefined, 'Webhook message appears in conversation history');

    if (webhookMsg) {
      assert(webhookMsg.content.includes('telegram'), 'Webhook message content includes source');
      assert(webhookMsg.role === 'user', 'Webhook message has role "user"');
    }
  } catch (error: unknown) {
    const err = error as { message: string };
    assert(false, `Webhook test failed: ${err.message}`);
  }
}

async function testMultipleWebhooks(): Promise<void> {
  console.log('\n--- Test: Multiple Webhook Endpoints ---');

  const hooks = ['github', 'stripe', 'custom-integration'];

  for (const hookName of hooks) {
    try {
      const response = await fetch(`${GATEWAY_URL}/hooks/${hookName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: `test-${hookName}`, data: { key: 'value' } }),
      });

      assert(response.ok, `Webhook /${hookName} returns 200`);

      const result = await response.json() as { hook: string };
      assert(result.hook === hookName, `Webhook returns correct name: ${hookName}`);
    } catch (error: unknown) {
      const err = error as { message: string };
      assert(false, `Webhook ${hookName} failed: ${err.message}`);
    }
  }
}

async function testActivityLogFromWebhooks(): Promise<void> {
  console.log('\n--- Test: Activity Log from Webhooks ---');

  try {
    const response = await fetch(`${GATEWAY_URL}/api/activities?type=channel_message&limit=10`);
    assert(response.ok, 'Activity log endpoint returns 200');

    const activities = await response.json() as Array<{ type: string; summary: string }>;
    const webhookActivities = activities.filter(a => a.summary.includes('Webhook'));
    assert(webhookActivities.length > 0, 'Webhook activities recorded in activity log');
  } catch (error: unknown) {
    const err = error as { message: string };
    assert(false, `Activity log test failed: ${err.message}`);
  }
}

async function main(): Promise<void> {
  console.log('=== Channel Validation ===\n');

  try {
    await startGateway();
    await testWebhookChannel();
    await testMultipleWebhooks();
    await testActivityLogFromWebhooks();
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
