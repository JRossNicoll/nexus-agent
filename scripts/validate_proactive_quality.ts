import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BASE = process.cwd();
const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:18799';

interface TestResult { name: string; passed: boolean; detail?: string }
const results: TestResult[] = [];
function pass(name: string) { results.push({ name, passed: true }); }
function fail(name: string, detail?: string) { results.push({ name, passed: false, detail }); }

async function main() {
  console.log('\n=== Sprint 5: validate_proactive_quality.ts ===\n');

  // Section 1: Code structure checks
  console.log('Section 1: Quality gate implementation\n');

  const proactiveSrc = fs.readFileSync(path.join(BASE, 'src/proactive/index.ts'), 'utf-8');
  const dbSrc = fs.readFileSync(path.join(BASE, 'src/memory/database.ts'), 'utf-8');
  const chatViewSrc = fs.readFileSync(path.join(BASE, 'web/src/components/ChatView.tsx'), 'utf-8');
  const cssSrc = fs.readFileSync(path.join(BASE, 'web/src/app/globals.css'), 'utf-8');

  // Quality gate function exists
  proactiveSrc.includes('passesQualityGate') ? pass('passesQualityGate function exists') : fail('passesQualityGate function exists');
  proactiveSrc.includes('function passesQualityGate(message') ? pass('passesQualityGate takes message and memories params') : fail('passesQualityGate takes message and memories params');

  // Quality gate checks memory content reference
  proactiveSrc.includes('matchCount >= 3') || proactiveSrc.includes('matchCount >=') ? pass('Quality gate checks word overlap') : fail('Quality gate checks word overlap');
  proactiveSrc.includes('phrases') ? pass('Quality gate checks phrase matches') : fail('Quality gate checks phrase matches');

  // Retry logic: up to 3 attempts
  proactiveSrc.includes('attempt <= 3') || proactiveSrc.includes('attempt < 3') ? pass('Quality gate retries up to 3 times') : fail('Quality gate retries up to 3 times');
  proactiveSrc.includes('PREVIOUS ATTEMPT REJECTED') ? pass('Retry prompt escalates specificity') : fail('Retry prompt escalates specificity');

  // Suppression on all failures
  proactiveSrc.includes('suppressed') || proactiveSrc.includes('all 3 attempts failed') ? pass('Suppresses after 3 failed attempts') : fail('Suppresses after 3 failed attempts');

  // Logging of rejected messages
  proactiveSrc.includes('insertActivity') && proactiveSrc.includes('Quality gate rejected') ? pass('Logs rejected messages') : fail('Logs rejected messages');

  // Section 2: Timing constraints
  console.log('Section 2: Timing constraints\n');

  // Preferred contact window
  dbSrc.includes('getPreferredContactWindow') ? pass('getPreferredContactWindow exists in DB') : fail('getPreferredContactWindow exists in DB');
  dbSrc.includes('setPreferredContactWindow') ? pass('setPreferredContactWindow exists in DB') : fail('setPreferredContactWindow exists in DB');
  dbSrc.includes('preferred_contact_window') ? pass('preferred_contact_window flag key') : fail('preferred_contact_window flag key');

  // Activity timestamps query
  dbSrc.includes('getActivityTimestamps') ? pass('getActivityTimestamps function exists') : fail('getActivityTimestamps function exists');

  // Most active hour calculation
  proactiveSrc.includes('calculatePreferredWindow') ? pass('calculatePreferredWindow function exists') : fail('calculatePreferredWindow function exists');
  proactiveSrc.includes('hourCounts') ? pass('Counts activity per hour') : fail('Counts activity per hour');

  // Contact window check
  proactiveSrc.includes('isInContactWindow') ? pass('isInContactWindow check exists') : fail('isInContactWindow check exists');

  // 2-hour minimum between proactive messages
  dbSrc.includes('getLastProactiveSent') ? pass('getLastProactiveSent exists') : fail('getLastProactiveSent exists');
  dbSrc.includes('setLastProactiveSent') ? pass('setLastProactiveSent exists') : fail('setLastProactiveSent exists');
  proactiveSrc.includes('canSendTimingCheck') ? pass('2-hour timing check function') : fail('2-hour timing check function');
  proactiveSrc.includes('twoHours') || proactiveSrc.includes('2 * 60 * 60') ? pass('2-hour interval enforced') : fail('2-hour interval enforced');

  // lastProactiveSent updated on send
  proactiveSrc.includes('setLastProactiveSent') ? pass('Updates last_proactive_sent timestamp') : fail('Updates last_proactive_sent timestamp');

  // Section 3: Proactive message UI
  console.log('Section 3: Proactive message UI\n');

  // Slide-down animation
  chatViewSrc.includes('isProactive') ? pass('isProactive flag on messages') : fail('isProactive flag on messages');
  chatViewSrc.includes('animate-slideDown') || chatViewSrc.includes('slideDown') ? pass('slideDown animation class applied') : fail('slideDown animation class applied');

  // Blue left border
  chatViewSrc.includes('border-l-2') || chatViewSrc.includes('border-left: 2px') ? pass('2px solid blue left border') : fail('2px solid blue left border');
  chatViewSrc.includes('border-l-[var(--accent)]') || chatViewSrc.includes('border-left-color') ? pass('Blue accent left border color') : fail('Blue accent left border color');

  // "NEXUS reached out" label
  chatViewSrc.includes('NEXUS reached out') ? pass('"NEXUS reached out" label present') : fail('"NEXUS reached out" label present');

  // CSS animation
  cssSrc.includes('slideDown') ? pass('slideDown keyframe in CSS') : fail('slideDown keyframe in CSS');
  cssSrc.includes('200ms') || cssSrc.includes('.2s') ? pass('200ms ease-out animation') : fail('200ms ease-out animation');

  // Section 4: Live API tests
  console.log('Section 4: Live API tests\n');

  try {
    // Test proactive status endpoint
    const statusRes = await fetch(`${GATEWAY}/api/proactive/status`);
    if (statusRes.ok) {
      const status = await statusRes.json() as any;
      pass('Proactive status endpoint responds');
      status.contactWindow !== undefined || status.lastProactiveSent !== undefined
        ? pass('Status includes timing info')
        : fail('Status includes timing info');
    } else {
      fail('Proactive status endpoint responds', `${statusRes.status}`);
    }
  } catch (e: any) {
    fail('Proactive status endpoint responds', e.message);
    fail('Status includes timing info', 'endpoint failed');
  }

  // Print results
  console.log('\n' + '='.repeat(50));
  for (const r of results) {
    console.log(`  ${r.passed ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log('='.repeat(50));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nTotal: ${results.length} tests, ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
