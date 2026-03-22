/**
 * validate_memory.ts
 * Writes 10 synthetic memories, runs semantic search, asserts top result matches,
 * writes structured memory entries, retrieves by key, tests consolidation.
 */

import fs from 'fs';
import {
  initDatabase,
  closeDatabase,
  insertMemory,
  getMemories,
  searchMemoriesByText,
  deleteMemory,
  setStructuredMemory,
  getStructuredMemory,
  getAllStructuredMemory,
  deleteStructuredMemory,
  insertConversation,
  getConversations,
  getRecentConversations,
  getMemoryStats,
  consolidateMemories,
  insertActivity,
  getActivities,
  insertToolCall,
  getToolCalls,
} from '../src/memory/database.js';

const TEST_DB = '/tmp/nexus-test-memory.db';
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

function setup(): void {
  try { fs.unlinkSync(TEST_DB); } catch {}
  initDatabase(TEST_DB);
}

function teardown(): void {
  closeDatabase();
  try { fs.unlinkSync(TEST_DB); } catch {}
}

function testSemanticMemory(): void {
  console.log('\n--- Test: Semantic Memory ---');

  const memories = [
    { content: 'User prefers dark mode for all applications', category: 'preference' as const, source: 'conversation' as const },
    { content: 'User is a software engineer at a startup', category: 'fact' as const, source: 'conversation' as const },
    { content: 'User has a meeting with the CEO on Friday', category: 'event' as const, source: 'conversation' as const },
    { content: 'User likes TypeScript over JavaScript', category: 'preference' as const, source: 'conversation' as const },
    { content: 'User runs 5km every morning before work', category: 'fact' as const, source: 'conversation' as const },
    { content: 'Important deadline: project proposal due next Tuesday', category: 'event' as const, source: 'conversation' as const },
    { content: 'User prefers reading documentation over watching videos', category: 'preference' as const, source: 'conversation' as const },
    { content: 'User has two cats named Luna and Nova', category: 'fact' as const, source: 'conversation' as const },
    { content: 'User is learning Rust on weekends', category: 'fact' as const, source: 'conversation' as const },
    { content: 'User wants to build a personal AI assistant platform', category: 'insight' as const, source: 'conversation' as const },
  ];

  const ids: string[] = [];
  for (const mem of memories) {
    const id = insertMemory({
      content: mem.content,
      embedding: null,
      category: mem.category,
      source: mem.source,
      confidence: 0.9,
      tags: [],
    });
    ids.push(id);
  }

  assert(ids.length === 10, `Inserted 10 memories (got ${ids.length})`);

  // Retrieve all
  const all = getMemories(100);
  assert(all.length === 10, `Retrieved all 10 memories (got ${all.length})`);

  // Text search
  const searchResults = searchMemoriesByText('TypeScript', 5);
  assert(searchResults.length > 0, 'Text search returns results for "TypeScript"');
  assert(
    searchResults[0].content.includes('TypeScript'),
    'Top search result contains "TypeScript"'
  );

  // Search for dark mode
  const darkModeResults = searchMemoriesByText('dark mode', 5);
  assert(darkModeResults.length > 0, 'Text search returns results for "dark mode"');

  // Delete
  const deleted = deleteMemory(ids[0]);
  assert(deleted, 'Successfully deleted a memory');

  const afterDelete = getMemories(100);
  assert(afterDelete.length === 9, `After delete: 9 memories (got ${afterDelete.length})`);

  // Stats
  const stats = getMemoryStats();
  assert(stats.totalMemories === 9, `Stats shows 9 memories (got ${stats.totalMemories})`);
}

function testStructuredMemory(): void {
  console.log('\n--- Test: Structured Memory ---');

  const entries = [
    { key: 'user.name', value: 'Alex Johnson', type: 'string' as const, category: 'identity' as const },
    { key: 'user.email', value: 'alex@example.com', type: 'string' as const, category: 'identity' as const },
    { key: 'user.timezone', value: 'America/New_York', type: 'string' as const, category: 'preferences' as const },
    { key: 'user.language', value: 'English', type: 'string' as const, category: 'preferences' as const },
    { key: 'health.daily_steps_goal', value: '10000', type: 'number' as const, category: 'health' as const },
  ];

  for (const entry of entries) {
    setStructuredMemory({
      ...entry,
      updated_at: Date.now(),
      source: 'test',
    });
  }

  // Retrieve by key
  const name = getStructuredMemory('user.name');
  assert(name !== null, 'Retrieved structured memory by key');
  assert(name?.value === 'Alex Johnson', 'Value matches expected');
  assert(name?.type === 'string', 'Type matches expected');
  assert(name?.category === 'identity', 'Category matches expected');

  // Get all
  const all = getAllStructuredMemory();
  assert(all.length === 5, `Retrieved all 5 structured entries (got ${all.length})`);

  // Get by category
  const identityEntries = getAllStructuredMemory('identity');
  assert(identityEntries.length === 2, `2 identity entries (got ${identityEntries.length})`);

  // Update
  setStructuredMemory({
    key: 'user.name',
    value: 'Alex J.',
    type: 'string',
    category: 'identity',
    updated_at: Date.now(),
    source: 'test',
  });
  const updated = getStructuredMemory('user.name');
  assert(updated?.value === 'Alex J.', 'Updated value matches');

  // Delete
  const deleted = deleteStructuredMemory('user.email');
  assert(deleted, 'Deleted structured memory');

  const afterDelete = getAllStructuredMemory();
  assert(afterDelete.length === 4, `After delete: 4 entries (got ${afterDelete.length})`);
}

function testConversationHistory(): void {
  console.log('\n--- Test: Conversation History ---');

  const sessionId = 'test-session-1';

  insertConversation({
    session_id: sessionId,
    role: 'user',
    content: 'Hello, what can you help me with?',
    provider: '',
    model: '',
    tokens_used: 0,
    latency_ms: 0,
    timestamp: Date.now() - 2000,
    channel: 'web',
  });

  insertConversation({
    session_id: sessionId,
    role: 'assistant',
    content: 'I can help with many things! I have access to tools, memory, and skills.',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    tokens_used: 42,
    latency_ms: 350,
    timestamp: Date.now() - 1000,
    channel: 'web',
  });

  insertConversation({
    session_id: sessionId,
    role: 'user',
    content: 'Can you remember that I prefer dark mode?',
    provider: '',
    model: '',
    tokens_used: 0,
    latency_ms: 0,
    timestamp: Date.now(),
    channel: 'web',
  });

  // Retrieve
  const conversations = getConversations(sessionId);
  assert(conversations.length === 3, `3 messages in session (got ${conversations.length})`);

  // Recent
  const recent = getRecentConversations(2);
  assert(recent.length === 2, `Got 2 recent messages (got ${recent.length})`);

  // Check channel
  assert(conversations[0].channel === 'web', 'Channel is "web"');
}

function testConsolidation(): void {
  console.log('\n--- Test: Memory Consolidation ---');

  // Add duplicate memories
  insertMemory({
    content: 'User prefers dark mode for all applications',
    embedding: null,
    category: 'preference',
    source: 'conversation',
    confidence: 0.9,
    tags: [],
  });

  // Exact duplicate (case-insensitive)
  insertMemory({
    content: 'user prefers dark mode for all applications',
    embedding: null,
    category: 'preference',
    source: 'conversation',
    confidence: 0.8,
    tags: [],
  });

  const beforeCount = getMemories(200).length;
  const result = consolidateMemories();

  assert(result.merged > 0, `Consolidation merged ${result.merged} duplicates`);
  assert(typeof result.flagged === 'number', 'Consolidation reports flagged count');

  const afterCount = getMemories(200).length;
  assert(afterCount < beforeCount, `Memory count reduced (${beforeCount} → ${afterCount})`);
}

function testActivityLog(): void {
  console.log('\n--- Test: Activity Log ---');

  insertActivity({
    type: 'tool_call',
    summary: 'Executed web_search',
    details: '{"query": "weather today"}',
    timestamp: Date.now(),
    session_id: 'test-session-1',
  });

  insertActivity({
    type: 'proactive',
    summary: 'Proactive insight about deadline',
    details: 'Your project deadline is tomorrow',
    timestamp: Date.now(),
  });

  const activities = getActivities(10);
  assert(activities.length >= 2, `At least 2 activities (got ${activities.length})`);

  const toolActivities = getActivities(10, 0, 'tool_call');
  assert(toolActivities.length >= 1, 'Filtered tool_call activities');
}

function testToolCalls(): void {
  console.log('\n--- Test: Tool Calls ---');

  insertToolCall({
    session_id: 'test-session-1',
    tool_name: 'web_search',
    input: '{"query": "test"}',
    output: '{"results": []}',
    duration_ms: 150,
    success: true,
    timestamp: Date.now(),
  });

  const calls = getToolCalls('test-session-1');
  assert(calls.length >= 1, 'Tool call recorded');
  assert(calls[0].tool_name === 'web_search', 'Tool name matches');
  assert(calls[0].success === true, 'Success flag correct');
}

function main(): void {
  console.log('=== Memory Validation ===\n');

  setup();

  try {
    testSemanticMemory();
    testStructuredMemory();
    testConversationHistory();
    testConsolidation();
    testActivityLog();
    testToolCalls();
  } finally {
    teardown();
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
