/**
 * validate_onboarding_ux.ts — Validates Sprint 4 onboarding UX improvements
 * Tests: API key guide modal, Telegram skip button, plain English text
 */

const GATEWAY = process.env.MEDO_GATEWAY ?? 'http://localhost:18799';
const WEB_UI = process.env.MEDO_WEB ?? 'http://localhost:18800';

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

async function validateOnboardingEndpoints(): Promise<void> {
  console.log('\n--- Onboarding API Endpoints ---');

  // Test onboarding status endpoint
  try {
    const res = await fetch(`${GATEWAY}/api/onboarding/status`);
    assert(res.ok, 'GET /api/onboarding/status returns 200');
    const data = await res.json() as Record<string, unknown>;
    assert(typeof data.completed === 'boolean', 'Status has completed boolean field');
  } catch (e) {
    assert(false, 'GET /api/onboarding/status accessible');
  }

  // Test provider test endpoint (needed for API key verification in onboarding)
  try {
    const res = await fetch(`${GATEWAY}/api/providers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic', apiKey: 'sk-invalid-test-key' }),
    });
    assert(res.ok || res.status === 400, 'POST /api/providers/test endpoint exists');
    const data = await res.json() as Record<string, unknown>;
    assert(typeof data.success === 'boolean', 'Provider test returns success boolean');
  } catch (e) {
    assert(false, 'POST /api/providers/test accessible');
  }

  // Test onboarding complete endpoint
  try {
    const res = await fetch(`${GATEWAY}/api/onboarding/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: 'TestUser',
        provider: { primary: 'anthropic/claude-sonnet-4-6', apiKey: 'test', keyName: 'anthropic' },
        aboutYou: { work: 'Testing', goals: 'Validate', goodDay: 'All tests pass' },
      }),
    });
    assert(res.ok || res.status === 400, 'POST /api/onboarding/complete endpoint exists');
  } catch (e) {
    assert(false, 'POST /api/onboarding/complete accessible');
  }
}

async function validateOnboardingUISource(): Promise<void> {
  console.log('\n--- Onboarding UI Component Source Validation ---');

  const fs = await import('fs');
  const path = await import('path');
  const onboardingPath = path.join(process.cwd(), 'web', 'src', 'components', 'OnboardingFlow.tsx');

  let source: string;
  try {
    source = fs.readFileSync(onboardingPath, 'utf-8');
    assert(true, 'OnboardingFlow.tsx exists');
  } catch {
    assert(false, 'OnboardingFlow.tsx exists');
    return;
  }

  // Item 1: API key guide modal
  assert(source.includes("I don't have an API key yet") || source.includes("I don\u0026apos;t have an API key yet") || source.includes("I don&apos;t have an API key yet"),
    'Has "I don\'t have an API key yet" button');
  assert(source.includes('showApiKeyGuide'), 'Has showApiKeyGuide state variable');
  assert(source.includes('How to get an API key'), 'Modal has "How to get an API key" title');

  // Check for 5 numbered steps in the modal
  const stepMatches = source.match(/Go to the Anthropic website|Create a free account|Find the API Keys page|Create a new key|Copy and paste the key/g);
  assert(stepMatches !== null && stepMatches.length >= 5, 'Modal has at least 5 numbered guide steps');

  // Check plain English explanations
  assert(source.includes('like a password') || source.includes('permission'), 'Modal explains API key in plain English');
  assert(source.includes('console.anthropic.com'), 'Modal links to Anthropic console');
  assert(source.includes('sk-ant-'), 'Modal mentions the key format (sk-ant-)');

  // Modal close button
  assert(source.includes('Got it, let me enter my key'), 'Modal has "Got it, let me enter my key" close button');

  // Item 1b: Telegram skip button
  assert(source.includes('Skip for now'), 'Telegram step has "Skip for now" button');
  assert(source.includes('set this up later in Settings'), 'Skip button mentions Settings');

  // Item 1c: Telegram explanation
  assert(source.includes('Telegram is a free messaging app'), 'Has plain English explanation of Telegram');
  assert(source.includes('even when this browser tab is closed'), 'Explains why Telegram is useful');

  // Screen structure checks
  assert(source.includes('Welcome to MEDO'), 'Screen 1: Welcome title present');
  assert(source.includes('Choose your brain'), 'Screen 2: Choose your brain title present');
  assert(source.includes('Connect Telegram'), 'Screen 3: Connect Telegram title present');
  assert(source.includes('Tell me about yourself'), 'Screen 4: Tell me about yourself title present');
  assert(source.includes("You're ready") || source.includes("You\u0026apos;re ready") || source.includes("You&apos;re ready"),
    'Screen 5: You\'re ready title present');

  // Design token usage (CSS variables, not hardcoded colors)
  assert(source.includes('var(--accent)'), 'Uses CSS variable for accent color');
  assert(source.includes('var(--bg-surface)'), 'Uses CSS variable for surface background');
  assert(source.includes('var(--bg-raised)'), 'Uses CSS variable for raised background');
}

async function main(): Promise<void> {
  console.log('=== MEDO Onboarding UX Validation ===');

  await validateOnboardingEndpoints();
  await validateOnboardingUISource();

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
