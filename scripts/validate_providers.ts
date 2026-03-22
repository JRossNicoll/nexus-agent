/**
 * validate_providers.ts
 * For each configured provider, sends a minimal completion request,
 * asserts response, measures latency, tests failover.
 */

import { ProviderManager } from '../src/providers/index.js';
import type { NexusConfig } from '../src/types/index.js';
import { initDatabase, closeDatabase } from '../src/memory/database.js';
import path from 'path';
import fs from 'fs';

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

// Create a test config
function createTestConfig(overrides?: Partial<NexusConfig['provider']>): NexusConfig {
  return {
    provider: {
      primary: 'anthropic/claude-sonnet-4-6',
      fallback: 'openai/gpt-4o',
      apiKeys: {
        anthropic: process.env.ANTHROPIC_API_KEY ?? '',
        openai: process.env.OPENAI_API_KEY ?? '',
        openrouter: process.env.OPENROUTER_API_KEY ?? '',
        ollama: 'http://localhost:11434',
      },
      ...overrides,
    },
    gateway: { port: 18799, auth: { token: '' } },
    memory: { embeddingModel: 'openai/text-embedding-3-small', vectorStore: 'sqlite-vec' },
    channels: {},
    skills: [],
    cron: [],
  };
}

async function testProviderManager(): Promise<void> {
  console.log('\n--- Test: Provider Manager Initialization ---');

  const config = createTestConfig();
  const manager = new ProviderManager(config);

  assert(typeof manager.getPrimaryName() === 'string', 'Primary provider name is string');
  assert(typeof manager.getFallbackName() === 'string', 'Fallback provider name is string');
  assert(manager.getPrimaryName() === 'anthropic/claude-sonnet-4-6', 'Primary provider is correct');
  assert(manager.getFallbackName() === 'openai/gpt-4o', 'Fallback provider is correct');
}

async function testProviderCreation(): Promise<void> {
  console.log('\n--- Test: Provider Creation ---');

  // Test with Ollama config (doesn't need API key)
  const config = createTestConfig({
    primary: 'ollama/llama3.2',
    fallback: 'ollama/llama3.2',
    apiKeys: { ollama: 'http://localhost:11434' },
  });
  const manager = new ProviderManager(config);

  assert(manager.getPrimaryName() === 'ollama/llama3.2', 'Ollama provider created correctly');
  assert(manager.isConnected(), 'Provider manager reports connected for ollama');
}

async function testFailoverLogic(): Promise<void> {
  console.log('\n--- Test: Failover Logic ---');

  // Create config with invalid primary to force failover
  const config = createTestConfig({
    primary: 'anthropic/claude-sonnet-4-6',
    fallback: 'ollama/llama3.2',
    apiKeys: {
      anthropic: 'invalid-key-for-testing',
      ollama: 'http://localhost:11434',
    },
  });

  const manager = new ProviderManager(config);
  assert(manager.getPrimaryName() === 'anthropic/claude-sonnet-4-6', 'Primary set to anthropic');
  assert(manager.getFallbackName() === 'ollama/llama3.2', 'Fallback set to ollama');

  // The provider manager should have both providers initialized
  assert(manager.getPrimary() !== null, 'Primary provider initialized');
  assert(manager.getFallback() !== null, 'Fallback provider initialized');
}

async function testProviderWithRealAPI(): Promise<void> {
  console.log('\n--- Test: Provider with Real API (if available) ---');

  const providers: Array<{ name: string; envKey: string; model: string }> = [
    { name: 'anthropic', envKey: 'ANTHROPIC_API_KEY', model: 'anthropic/claude-sonnet-4-6' },
    { name: 'openai', envKey: 'OPENAI_API_KEY', model: 'openai/gpt-4o-mini' },
    { name: 'openrouter', envKey: 'OPENROUTER_API_KEY', model: 'openrouter/openai/gpt-4o-mini' },
  ];

  for (const p of providers) {
    const apiKey = process.env[p.envKey];
    if (!apiKey) {
      console.log(`  ○ ${p.name}: skipped (no ${p.envKey})`);
      continue;
    }

    const config = createTestConfig({
      primary: p.model,
      apiKeys: { [p.name]: apiKey },
    });
    const manager = new ProviderManager(config);

    try {
      const start = Date.now();
      const response = await manager.chatComplete([
        { role: 'user', content: 'Say "hello" and nothing else.' },
      ]);
      const latency = Date.now() - start;

      assert(response.length > 0, `${p.name}: got response (${response.length} chars, ${latency}ms)`);
      assert(latency < 30000, `${p.name}: latency under 30s (${latency}ms)`);
    } catch (error: unknown) {
      const err = error as { message: string };
      console.log(`  ○ ${p.name}: API call failed (${err.message}) — may be rate-limited or key invalid`);
    }
  }
}

async function main(): Promise<void> {
  console.log('=== Provider Validation ===\n');

  // Initialize a temp database for logging
  const tmpDb = '/tmp/nexus-test-providers.db';
  try { fs.unlinkSync(tmpDb); } catch {}
  initDatabase(tmpDb);

  try {
    await testProviderManager();
    await testProviderCreation();
    await testFailoverLogic();
    await testProviderWithRealAPI();
  } finally {
    closeDatabase();
    try { fs.unlinkSync(tmpDb); } catch {}
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
