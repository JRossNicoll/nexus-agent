/**
 * validate_semantic_search.ts — Validates semantic memory search
 * Tests: LLM-powered re-ranking, "programming languages" finds "TypeScript",
 * search endpoint structure, fallback behavior
 *
 * User test spec: "seed a memory containing the word 'TypeScript',
 * search for 'programming languages', confirm the TypeScript memory
 * appears in the top 3 results."
 */

const GATEWAY = process.env.NEXUS_GATEWAY ?? 'http://localhost:18799';

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

async function seedTestMemories(): Promise<string[]> {
  console.log('\n--- Seeding Test Memories ---');
  const ids: string[] = [];

  // Matches user spec: "seed a memory containing the word 'TypeScript'"
  // Plus non-programming memories to test semantic ranking
  const testMemories = [
    { content: 'I use TypeScript for all my web projects and love its type system', category: 'fact', tags: ['typescript', 'web', 'programming'] },
    { content: 'My favorite recipe is homemade pasta with garlic and olive oil', category: 'preference', tags: ['cooking', 'food'] },
    { content: 'I run 5 kilometers every morning before work to stay healthy', category: 'fact', tags: ['exercise', 'health'] },
    { content: 'I enjoy reading science fiction novels especially by Isaac Asimov', category: 'preference', tags: ['books', 'reading'] },
    { content: 'I have two cats named Luna and Pixel who love to sleep on my keyboard', category: 'fact', tags: ['pets', 'cats'] },
    { content: 'I prefer dark mode themes in all my code editors and terminals', category: 'preference', tags: ['preferences', 'coding'] },
  ];

  for (const mem of testMemories) {
    try {
      const res = await fetch(`${GATEWAY}/api/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mem),
      });
      if (res.ok) {
        const data = await res.json() as { id: string };
        ids.push(data.id);
      }
    } catch {
      // ignore seeding errors
    }
  }

  assert(ids.length >= 4, `Seeded ${ids.length} test memories (need at least 4)`);
  return ids;
}

async function validateSearchEndpoint(): Promise<void> {
  console.log('\n--- Search Endpoint Structure ---');

  // Test basic search endpoint exists
  try {
    const res = await fetch(`${GATEWAY}/api/v1/memories/search?q=test&limit=5`);
    assert(res.ok, 'GET /api/v1/memories/search returns 200');
    const data = await res.json();
    assert(Array.isArray(data), 'Search returns an array');
  } catch (e) {
    assert(false, 'GET /api/v1/memories/search accessible');
    assert(false, 'Search returns an array');
  }

  // Test empty query
  try {
    const res = await fetch(`${GATEWAY}/api/v1/memories/search?q=&limit=5`);
    assert(res.ok, 'Empty query returns 200 (returns recent memories)');
  } catch {
    assert(false, 'Empty query handled gracefully');
  }

  // Test with limit parameter
  try {
    const res = await fetch(`${GATEWAY}/api/v1/memories/search?q=test&limit=3`);
    assert(res.ok, 'Search with limit parameter works');
    const data = await res.json() as unknown[];
    assert(data.length <= 3, `Results respect limit parameter (got ${data.length} <= 3)`);
  } catch {
    assert(false, 'Search with limit parameter works');
  }
}

async function validateSemanticSearch(): Promise<void> {
  console.log('\n--- Semantic Search (LLM Re-ranking) ---');

  // THE KEY TEST: search "programming languages" should find TypeScript
  try {
    const res = await fetch(`${GATEWAY}/api/v1/memories/search?q=programming+languages&limit=10`);
    assert(res.ok, 'Semantic search for "programming languages" returns 200');

    const results = await res.json() as Array<{ content: string; id: string }>;
    assert(results.length > 0, `Semantic search returned ${results.length} results (need > 0)`);

    // Log actual results for debugging
    console.log('    Top results:');
    results.slice(0, 5).forEach((r, i) => {
      console.log(`      ${i + 1}: ${r.content.slice(0, 80)}`);
    });

    // Check if TypeScript memory is in top 3
    const top3Contents = results.slice(0, 3).map(r => r.content.toLowerCase());
    const hasTypeScript = top3Contents.some(c => c.includes('typescript'));
    assert(hasTypeScript, 'TypeScript memory appears in top 3 results for "programming languages"');

    // Check that non-programming memories (cooking, cats, running) are NOT in top 3
    const hasIrrelevant = top3Contents.some(c =>
      c.includes('pasta') || c.includes('cats') || c.includes('kilometers') || c.includes('asimov')
    );
    assert(!hasIrrelevant, 'Non-programming memories are NOT in top 3');

    // TypeScript should rank above cooking/pets/exercise
    const tsIdx = results.findIndex(r => r.content.toLowerCase().includes('typescript'));
    const pastaIdx = results.findIndex(r => r.content.toLowerCase().includes('pasta'));
    if (tsIdx >= 0 && pastaIdx >= 0) {
      assert(tsIdx < pastaIdx, `TypeScript (pos ${tsIdx + 1}) ranks above pasta (pos ${pastaIdx + 1})`);
    } else {
      assert(tsIdx >= 0, 'TypeScript memory found in results');
    }
  } catch (e) {
    console.log(`    Error: ${e}`);
    assert(false, 'Semantic search for "programming languages" works');
    assert(false, 'TypeScript memory appears in top 3');
    assert(false, 'Non-programming memories excluded from top 3');
    assert(false, 'TypeScript ranks above non-programming memories');
  }

  // Test another semantic query: "pets" should find "cats"
  try {
    const res = await fetch(`${GATEWAY}/api/v1/memories/search?q=pets+animals&limit=5`);
    if (res.ok) {
      const results = await res.json() as Array<{ content: string }>;
      const hasCats = results.slice(0, 3).some(r => r.content.toLowerCase().includes('cat'));
      assert(hasCats, 'Search "pets animals" finds cat memory in top 3');
    } else {
      assert(false, 'Search "pets animals" returns 200');
    }
  } catch {
    assert(false, 'Search "pets animals" works');
  }

  // Test exact match still works (fast path)
  try {
    const res = await fetch(`${GATEWAY}/api/v1/memories/search?q=TypeScript&limit=5`);
    if (res.ok) {
      const results = await res.json() as Array<{ content: string }>;
      const hasExact = results.some(r => r.content.includes('TypeScript'));
      assert(hasExact, 'Exact text match "TypeScript" still works');
    } else {
      assert(false, 'Exact text match returns 200');
    }
  } catch {
    assert(false, 'Exact text match works');
  }
}

async function validateSearchSourceCode(): Promise<void> {
  console.log('\n--- Search Implementation Source Validation ---');

  const fs = await import('fs');
  const path = await import('path');
  const routesPath = path.join(process.cwd(), 'src', 'gateway', 'routes.ts');

  let source: string;
  try {
    source = fs.readFileSync(routesPath, 'utf-8');
    assert(true, 'routes.ts exists');
  } catch {
    assert(false, 'routes.ts exists');
    return;
  }

  // Check that v1 search uses LLM re-ranking
  assert(source.includes('semantic search') || source.includes('LLM re-ranking') || source.includes('reRankPrompt') || source.includes('systemPrompt'),
    'Search endpoint uses LLM-based semantic re-ranking');
  assert(source.includes('providerManager.isConnected()'),
    'Search checks if LLM provider is available');
  assert(source.includes('providerManager.chatComplete'),
    'Search uses providerManager.chatComplete for re-ranking');
  assert(source.includes('searchMemoriesByText'),
    'Falls back to text search when LLM unavailable');

  // Check the database search function
  const dbPath = path.join(process.cwd(), 'src', 'memory', 'database.ts');
  try {
    const dbSource = fs.readFileSync(dbPath, 'utf-8');
    assert(dbSource.includes('searchMemoriesByText'), 'database.ts has searchMemoriesByText function');
    assert(dbSource.includes('word') || dbSource.includes('score'), 'Text search uses word-level scoring');
  } catch {
    assert(false, 'database.ts readable');
  }
}

async function cleanupTestMemories(ids: string[]): Promise<void> {
  console.log('\n--- Cleanup ---');
  let cleaned = 0;
  for (const id of ids) {
    try {
      await fetch(`${GATEWAY}/api/memories/${id}`, { method: 'DELETE' });
      cleaned++;
    } catch { /* ignore */ }
  }
  console.log(`  Cleaned up ${cleaned}/${ids.length} test memories`);
}

async function main(): Promise<void> {
  console.log('=== NEXUS Semantic Memory Search Validation ===');

  const seededIds = await seedTestMemories();

  // Small delay to ensure memories are indexed
  await new Promise(r => setTimeout(r, 500));

  await validateSearchEndpoint();
  await validateSemanticSearch();
  await validateSearchSourceCode();
  await cleanupTestMemories(seededIds);

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
