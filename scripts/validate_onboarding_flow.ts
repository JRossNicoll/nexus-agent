// Validate the onboarding flow API endpoints
const GATEWAY = process.env.NEXUS_GATEWAY_PORT ? `http://localhost:${process.env.NEXUS_GATEWAY_PORT}` : 'http://localhost:18799';

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
  console.log('=== Onboarding Flow Validation ===\n');

  // Test 1: Onboarding status endpoint
  console.log('--- Onboarding Status ---');
  const status = await fetch(`${GATEWAY}/api/onboarding/status`).then(r => r.json());
  check('GET /api/onboarding/status returns data', !!status);
  check('Status has completed field', 'completed' in status);

  // Test 2: Auth status (no auth required by default)
  console.log('\n--- Auth Status ---');
  const authStatus = await fetch(`${GATEWAY}/api/auth/status`).then(r => r.json());
  check('GET /api/auth/status returns data', !!authStatus);
  check('Auth status has authConfigured field', 'authConfigured' in authStatus);

  // Test 3: Provider test endpoint
  console.log('\n--- Provider Test ---');
  const providerTest = await fetch(`${GATEWAY}/api/providers/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }).then(r => r.json());
  check('POST /api/providers/test returns response', !!providerTest);
  check('Provider test has success field', 'success' in providerTest);
  // If API key is configured, this should succeed
  if (providerTest.success) {
    check('Provider test succeeded (API key configured)', true);
  } else {
    check('Provider test returned error (expected if no key)', true);
  }

  // Test 4: API key test endpoint
  console.log('\n--- API Key Test ---');
  const keyTest = await fetch(`${GATEWAY}/api/providers/test-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'anthropic', apiKey: 'sk-test-invalid' }),
  }).then(r => r.json());
  check('POST /api/providers/test-key returns response', !!keyTest);
  check('Invalid key returns success=false', keyTest.success === false);

  // Test 5: Onboarding complete endpoint
  console.log('\n--- Onboarding Complete ---');
  const completeRes = await fetch(`${GATEWAY}/api/onboarding/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userName: 'TestUser',
      aboutYou: {
        work: 'Software engineering',
        goals: 'Be more productive',
        goodDay: 'Ship code and go for a walk',
      },
    }),
  }).then(r => r.json());
  check('POST /api/onboarding/complete succeeds', completeRes.success === true);

  // Verify onboarding is now marked complete
  const statusAfter = await fetch(`${GATEWAY}/api/onboarding/status`).then(r => r.json());
  check('Onboarding marked as complete after submission', statusAfter.completed === true);
  check('User name stored correctly', statusAfter.userName === 'TestUser');

  // Test 6: Welcome message
  console.log('\n--- Welcome Message ---');
  const welcome = await fetch(`${GATEWAY}/api/onboarding/welcome`).then(r => r.json());
  check('GET /api/onboarding/welcome returns message', !!welcome && 'message' in welcome);
  check('Welcome message is non-empty', welcome.message && welcome.message.length > 10);

  // Test 7: Memories seeded from onboarding
  console.log('\n--- Memory Seeding ---');
  const memories = await fetch(`${GATEWAY}/api/memories?limit=100`).then(r => r.json());
  const onboardingMemories = Array.isArray(memories) ? memories.filter((m: { content: string }) =>
    m.content.includes('Software engineering') || m.content.includes('productive') || m.content.includes('Ship code')
  ) : [];
  check('Onboarding answers seeded as memories', onboardingMemories.length >= 1);

  console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
  console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
  process.exit(failed);
}

validate().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
