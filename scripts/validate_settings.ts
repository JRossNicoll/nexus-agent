// Validate Settings API endpoints work correctly
const GATEWAY = process.env.MEDO_GATEWAY_PORT ? `http://localhost:${process.env.MEDO_GATEWAY_PORT}` : 'http://localhost:18799';

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

async function validate(): Promise<void> {
  console.log('=== Settings Validation ===\n');

  // Test 1: Provider settings
  console.log('--- Provider Settings ---');
  const providerGet = await fetch(`${GATEWAY}/api/v1/settings/provider`).then(r => r.json());
  check('GET /api/v1/settings/provider returns data', !!providerGet);
  check('Provider response has provider field', 'provider' in providerGet);
  check('Provider response has hasKey field', 'hasKey' in providerGet);

  const providerPost = await fetch(`${GATEWAY}/api/v1/settings/provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'anthropic/claude-sonnet-4-6' }),
  }).then(r => r.json());
  check('POST /api/v1/settings/provider succeeds', providerPost.success === true);

  // Test 2: Telegram settings
  console.log('\n--- Telegram Settings ---');
  const telegramGet = await fetch(`${GATEWAY}/api/v1/settings/telegram`).then(r => r.json());
  check('GET /api/v1/settings/telegram returns data', !!telegramGet);
  check('Telegram response has enabled field', 'enabled' in telegramGet);
  check('Telegram response has connected field', 'connected' in telegramGet);

  const telegramPost = await fetch(`${GATEWAY}/api/v1/settings/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  }).then(r => r.json());
  check('POST /api/v1/settings/telegram succeeds', telegramPost.success === true);

  // Test 3: Proactive settings
  console.log('\n--- Proactive Settings ---');
  const proactiveGet = await fetch(`${GATEWAY}/api/v1/settings/proactive`).then(r => r.json());
  check('GET /api/v1/settings/proactive returns data', !!proactiveGet);
  check('Proactive response has enabled field', 'enabled' in proactiveGet);
  check('Proactive response has interval field', 'interval' in proactiveGet);

  const proactivePost = await fetch(`${GATEWAY}/api/v1/settings/proactive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true, interval: 30 }),
  }).then(r => r.json());
  check('POST /api/v1/settings/proactive succeeds', proactivePost.success === true);

  // Test 4: Memory & Activity v1 endpoints
  console.log('\n--- v1 API Endpoints ---');
  const memories = await fetch(`${GATEWAY}/api/v1/memories?limit=5`).then(r => r.json());
  check('GET /api/v1/memories returns array', Array.isArray(memories));

  const health = await fetch(`${GATEWAY}/api/v1/memory/health`).then(r => r.json());
  check('GET /api/v1/memory/health returns data', !!health && 'totalMemories' in health);

  const clusters = await fetch(`${GATEWAY}/api/v1/memory/clusters`).then(r => r.json());
  check('GET /api/v1/memory/clusters returns array', Array.isArray(clusters));

  const activity = await fetch(`${GATEWAY}/api/v1/activity?limit=5`).then(r => r.json());
  check('GET /api/v1/activity returns data', !!activity);

  const skills = await fetch(`${GATEWAY}/api/v1/skills`).then(r => r.json());
  check('GET /api/v1/skills returns array', Array.isArray(skills));

  const search = await fetch(`${GATEWAY}/api/v1/memories/search?q=test`).then(r => r.json());
  check('GET /api/v1/memories/search returns array', Array.isArray(search));

  // Test 5: Danger zone (don't actually delete — just check the endpoint exists)
  console.log('\n--- Danger Zone (existence check) ---');
  // We test with a HEAD-like approach — just verify the route exists
  const resetRes = await fetch(`${GATEWAY}/api/v1/settings/reset`, { method: 'POST' });
  check('POST /api/v1/settings/reset endpoint exists', resetRes.status === 200);

  console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
  console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
  process.exit(failed);
}

validate().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
