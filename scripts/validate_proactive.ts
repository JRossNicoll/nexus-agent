/**
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

const TEST_DB = '/tmp/nexus-test-proactive.db';
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
