#!/usr/bin/env python3
"""Write Sprint 3 backend changes."""
import os

BASE = '/home/ubuntu/medo-agent'

def write_file(rel_path, content):
    full = os.path.join(BASE, rel_path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w') as f:
        f.write(content)
    print(f'  Written: {rel_path} ({len(content)} bytes)')

# ============================================================
# 1. Update types/index.ts - add new Sprint 3 types
# ============================================================
write_file('src/types/index.ts', r"""export interface MedoConfig {
  provider: ProviderConfig;
  gateway: GatewayConfig;
  memory: MemoryConfig;
  channels: ChannelsConfig;
  skills: string[];
  cron: CronEntry[];
  proactive?: ProactiveSettingsConfig;
  onboarding?: OnboardingState;
}

export interface OnboardingState {
  completed: boolean;
  userName?: string;
  completedAt?: number;
}

export interface ProactiveSettingsConfig {
  enabled: boolean;
  intervalHours: number;
  confidenceThreshold: number;
  maxPerDay: number;
  briefingTime?: string;
  patternDetection: boolean;
  dailyBriefing: boolean;
  smartReminders: boolean;
}

export interface ProviderConfig {
  primary: string;
  fallback: string;
  apiKeys: Record<string, string>;
}

export interface GatewayConfig {
  port: number;
  auth: {
    token: string;
    pin?: string;
  };
  cors?: {
    origins: string[];
  };
  execAllowlist?: {
    commands: string[];
    directories: string[];
  };
}

export interface MemoryConfig {
  embeddingModel: string;
  vectorStore: string;
}

export interface ChannelsConfig {
  telegram?: TelegramChannelConfig;
  whatsapp?: WhatsAppChannelConfig;
  webhook?: Record<string, WebhookChannelConfig>;
}

export interface TelegramChannelConfig {
  enabled: boolean;
  botToken: string;
}

export interface WhatsAppChannelConfig {
  enabled: boolean;
  sessionPath: string;
}

export interface WebhookChannelConfig {
  enabled: boolean;
  secret?: string;
}

export interface CronEntry {
  name: string;
  schedule: string;
  skill: string;
  enabled: boolean;
}

// Memory types
export interface SemanticMemory {
  id: string;
  content: string;
  embedding: Float32Array | null;
  category: 'fact' | 'preference' | 'event' | 'document' | 'insight';
  source: 'conversation' | 'document' | 'proactive' | 'manual';
  confidence: number;
  created_at: number;
  last_accessed: number;
  access_count: number;
  tags: string[];
  conversation_id?: string;
  channel?: string;
}

export interface StructuredMemory {
  key: string;
  value: string;
  type: 'string' | 'number' | 'date' | 'list' | 'object';
  category: 'identity' | 'preferences' | 'health' | 'finance' | 'relationships' | 'goals';
  updated_at: number;
  source: string;
}

export interface ConversationMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider: string;
  model: string;
  tokens_used: number;
  latency_ms: number;
  timestamp: number;
  channel: 'web' | 'telegram' | 'whatsapp' | 'api' | 'webhook';
}

export interface ToolCall {
  id: string;
  session_id: string;
  tool_name: string;
  input: string;
  output: string;
  duration_ms: number;
  success: boolean;
  timestamp: number;
}

// WebSocket message types
export type WSMessageType =
  | 'connect'
  | 'hello-ok'
  | 'chat'
  | 'chat-stream'
  | 'chat-done'
  | 'chat-error'
  | 'tool-call'
  | 'tool-result'
  | 'memory-update'
  | 'memory-pulse'
  | 'activity'
  | 'proactive'
  | 'ping'
  | 'pong'
  | 'auth-required'
  | 'auth-ok'
  | 'auth-fail'
  | 'thinking'
  | 'execution-trace';

export interface WSMessage {
  type: WSMessageType;
  id?: string;
  payload?: unknown;
  timestamp?: number;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  model?: string;
  channel?: string;
}

export interface ChatStreamChunk {
  content: string;
  done: boolean;
  model?: string;
  provider?: string;
  tokens_used?: number;
  latency_ms?: number;
}

// Provider types
export interface LLMProvider {
  name: string;
  chat(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string>;
  chatComplete(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
  embed?(text: string): Promise<Float32Array>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// Activity log
export interface ActivityEntry {
  id: string;
  type: 'tool_call' | 'proactive' | 'cron' | 'channel_message' | 'memory_write' | 'skill_run' | 'provider_failover';
  summary: string;
  details: string;
  timestamp: number;
  session_id?: string;
}

// Skill types
export interface SkillConfig {
  name: string;
  description: string;
  triggers: SkillTrigger[];
  tools: string[];
  enabled: boolean;
}

export interface SkillTrigger {
  cron?: string;
  keyword?: string;
}

export interface Skill {
  config: SkillConfig;
  content: string;
  filePath: string;
  lastRun?: number;
}

// Skill execution history
export interface SkillExecution {
  id: string;
  skill_name: string;
  triggered_by: 'cron' | 'keyword' | 'manual' | 'api';
  success: boolean;
  output: string;
  error?: string;
  duration_ms: number;
  timestamp: number;
}

// Memory health
export interface MemoryHealth {
  totalMemories: number;
  addedThisWeek: number;
  oldestMemory: number | null;
  mostReferenced: { id: string; content: string; access_count: number } | null;
  staleMemories: number;
  totalConversations: number;
  totalStructured: number;
}

// Memory graph cluster
export interface MemoryCluster {
  id: string;
  label: string;
  nodeIds: string[];
  color: string;
}

// Health response
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  uptime: number;
  provider: {
    primary: string;
    fallback: string;
    connected: boolean;
  };
  memory: {
    totalMemories: number;
    totalConversations: number;
    totalStructured: number;
    dbSizeBytes: number;
  };
  activeCronJobs: number;
  channels: Record<string, boolean>;
  version: string;
}
""")

# ============================================================
# 2. Update memory/database.ts - add memory health, skill execution, etc.
# ============================================================
# Read current file and append new functions
db_append = r"""
// Skill execution history
export function createSkillExecutionsTable(): void {
  const database = getDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS skill_executions (
      id TEXT PRIMARY KEY,
      skill_name TEXT NOT NULL,
      triggered_by TEXT,
      success INTEGER,
      output TEXT,
      error TEXT,
      duration_ms INTEGER,
      timestamp INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_skill_exec_name ON skill_executions(skill_name);
    CREATE INDEX IF NOT EXISTS idx_skill_exec_timestamp ON skill_executions(timestamp);
  `);
}

export function insertSkillExecution(exec: {
  skill_name: string;
  triggered_by: string;
  success: boolean;
  output: string;
  error?: string;
  duration_ms: number;
}): string {
  const database = getDatabase();
  const id = randomUUID();
  database.prepare(`
    INSERT INTO skill_executions (id, skill_name, triggered_by, success, output, error, duration_ms, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, exec.skill_name, exec.triggered_by, exec.success ? 1 : 0, exec.output, exec.error ?? null, exec.duration_ms, Date.now());
  return id;
}

export function getSkillExecutions(skillName: string, limit = 10): Array<{
  id: string; skill_name: string; triggered_by: string; success: boolean;
  output: string; error: string | null; duration_ms: number; timestamp: number;
}> {
  const database = getDatabase();
  const rows = database.prepare(
    'SELECT * FROM skill_executions WHERE skill_name = ? ORDER BY timestamp DESC LIMIT ?'
  ).all(skillName, limit) as Array<Record<string, unknown>>;
  return rows.map(r => ({
    id: r.id as string,
    skill_name: r.skill_name as string,
    triggered_by: r.triggered_by as string,
    success: !!(r.success as number),
    output: r.output as string,
    error: r.error as string | null,
    duration_ms: r.duration_ms as number,
    timestamp: r.timestamp as number,
  }));
}

// Memory health
export function getMemoryHealth(): {
  totalMemories: number;
  addedThisWeek: number;
  oldestMemory: number | null;
  mostReferenced: { id: string; content: string; access_count: number } | null;
  staleMemories: number;
  totalConversations: number;
  totalStructured: number;
} {
  const database = getDatabase();
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  const total = (database.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number }).count;
  const addedThisWeek = (database.prepare('SELECT COUNT(*) as count FROM memories WHERE created_at > ?').get(now - oneWeek) as { count: number }).count;
  const oldest = database.prepare('SELECT MIN(created_at) as oldest FROM memories').get() as { oldest: number | null };
  const mostRef = database.prepare('SELECT id, content, access_count FROM memories ORDER BY access_count DESC LIMIT 1').get() as { id: string; content: string; access_count: number } | undefined;
  const stale = (database.prepare('SELECT COUNT(*) as count FROM memories WHERE created_at < ? AND access_count = 0').get(now - thirtyDays) as { count: number }).count;
  const conversations = (database.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number }).count;
  const structured = (database.prepare('SELECT COUNT(*) as count FROM structured_memory').get() as { count: number }).count;

  return {
    totalMemories: total,
    addedThisWeek,
    oldestMemory: oldest.oldest,
    mostReferenced: mostRef && mostRef.access_count > 0 ? mostRef : null,
    staleMemories: stale,
    totalConversations: conversations,
    totalStructured: structured,
  };
}

// Get memories at a specific point in time (for timeline scrubber)
export function getMemoriesAtTime(beforeTimestamp: number, limit = 200): SemanticMemory[] {
  const database = getDatabase();
  const rows = database.prepare(
    'SELECT * FROM memories WHERE created_at <= ? ORDER BY created_at DESC LIMIT ?'
  ).all(beforeTimestamp, limit) as Array<Record<string, unknown>>;
  return rows.map(rowToSemanticMemory);
}

// Onboarding state
export function getOnboardingState(): { completed: boolean; userName?: string; completedAt?: number } {
  const database = getDatabase();
  try {
    database.exec(`CREATE TABLE IF NOT EXISTS onboarding (
      id TEXT PRIMARY KEY DEFAULT 'default',
      user_name TEXT,
      completed INTEGER DEFAULT 0,
      completed_at INTEGER
    )`);
  } catch { /* already exists */ }
  const row = database.prepare("SELECT * FROM onboarding WHERE id = 'default'").get() as Record<string, unknown> | undefined;
  if (!row) return { completed: false };
  return {
    completed: !!(row.completed as number),
    userName: row.user_name as string | undefined,
    completedAt: row.completed_at as number | undefined,
  };
}

export function setOnboardingComplete(userName: string): void {
  const database = getDatabase();
  try {
    database.exec(`CREATE TABLE IF NOT EXISTS onboarding (
      id TEXT PRIMARY KEY DEFAULT 'default',
      user_name TEXT,
      completed INTEGER DEFAULT 0,
      completed_at INTEGER
    )`);
  } catch { /* already exists */ }
  database.prepare(`
    INSERT OR REPLACE INTO onboarding (id, user_name, completed, completed_at)
    VALUES ('default', ?, 1, ?)
  `).run(userName, Date.now());
}
"""

# Read current database.ts and append
db_path = os.path.join(BASE, 'src/memory/database.ts')
with open(db_path, 'r') as f:
    current_db = f.read()

# Only append if not already added
if 'getMemoryHealth' not in current_db:
    with open(db_path, 'a') as f:
        f.write(db_append)
    print(f'  Appended to: src/memory/database.ts')
else:
    print(f'  Skipped: src/memory/database.ts (already updated)')

# ============================================================
# 3. Update gateway/routes.ts - add new endpoints
# ============================================================
write_file('src/gateway/routes.ts', r"""import type { FastifyInstance } from 'fastify';
import type { MedoConfig, HealthResponse } from '../types/index.js';
import { ProviderManager } from '../providers/index.js';
import { SkillManager } from '../skills/index.js';
import {
  getMemoryStats,
  getMemories,
  getMemoryById,
  updateMemory,
  deleteMemory,
  deleteMemoriesByCategory,
  insertMemory,
  searchMemoriesByText,
  getMemoryGraphData,
  applyConfidenceDecay,
  getAllStructuredMemory,
  getStructuredMemory,
  setStructuredMemory,
  deleteStructuredMemory,
  getConversations,
  getConversationById,
  getRecentConversations,
  insertConversation,
  getActivities,
  getToolCalls,
  consolidateMemories,
  getAuthHash,
  setAuthHash,
  getPendingTasks,
  resolveTask,
  getMemoryHealth,
  getMemoriesAtTime,
  getOnboardingState,
  setOnboardingComplete,
  insertSkillExecution,
  getSkillExecutions,
  createSkillExecutionsTable,
  reinforceMemory,
} from '../memory/database.js';
import bcrypt from 'bcryptjs';
import { getConnectedClientsCount, broadcastToClients } from './websocket.js';
import { saveConfig } from './config.js';
import { randomUUID } from 'crypto';

const startTime = Date.now();

export function setupRoutes(
  app: FastifyInstance,
  config: MedoConfig,
  providerManager: ProviderManager,
  skillManager: SkillManager,
  proactiveWorker?: { getStatus: () => Record<string, unknown>; getConfig: () => Record<string, unknown> },
): void {
  // Ensure skill executions table exists
  try { createSkillExecutionsTable(); } catch { /* ignore */ }

  // Health endpoint
  app.get('/health', async () => {
    const stats = getMemoryStats();
    const cronSkills = skillManager.getCronSkills();

    const health: HealthResponse = {
      status: providerManager.isConnected() ? 'ok' : 'degraded',
      uptime: Date.now() - startTime,
      provider: {
        primary: providerManager.getPrimaryName(),
        fallback: providerManager.getFallbackName(),
        connected: providerManager.isConnected(),
      },
      memory: stats,
      activeCronJobs: cronSkills.length,
      channels: {
        web: true,
        telegram: !!config.channels.telegram?.enabled,
        whatsapp: !!config.channels.whatsapp?.enabled,
      },
      version: '0.2.0',
    };

    return health;
  });

  // OpenAI-compatible chat completions endpoint
  app.post('/v1/chat/completions', async (request, reply) => {
    const body = request.body as {
      messages: Array<{ role: string; content: string }>;
      model?: string;
      stream?: boolean;
      max_tokens?: number;
      temperature?: number;
    };

    const messages = body.messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    // Store user message
    const lastUserMsg = body.messages.filter(m => m.role === 'user').pop();
    if (lastUserMsg) {
      insertConversation({
        session_id: 'api-' + Date.now(),
        role: 'user',
        content: lastUserMsg.content,
        provider: '',
        model: '',
        tokens_used: 0,
        latency_ms: 0,
        timestamp: Date.now(),
        channel: 'api',
      });
    }

    if (body.stream) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const id = `chatcmpl-${randomUUID()}`;
      let fullContent = '';
      const chatStart = Date.now();
      try {
        for await (const chunk of providerManager.chat(messages, {
          model: body.model,
          max_tokens: body.max_tokens,
          temperature: body.temperature,
        })) {
          fullContent += chunk;
          const sseData = {
            id,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: body.model ?? config.provider.primary,
            choices: [{
              index: 0,
              delta: { content: chunk },
              finish_reason: null,
            }],
          };
          reply.raw.write(`data: ${JSON.stringify(sseData)}\n\n`);
        }

        // Store assistant response
        insertConversation({
          session_id: 'api-' + chatStart,
          role: 'assistant',
          content: fullContent,
          provider: providerManager.getPrimaryName(),
          model: body.model ?? config.provider.primary,
          tokens_used: 0,
          latency_ms: Date.now() - chatStart,
          timestamp: Date.now(),
          channel: 'api',
        });

        const doneData = {
          id,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: body.model ?? config.provider.primary,
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop',
          }],
        };
        reply.raw.write(`data: ${JSON.stringify(doneData)}\n\n`);
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      } catch (error: unknown) {
        const err = error as { message: string };
        reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        reply.raw.end();
      }
    } else {
      try {
        const chatStart = Date.now();
        const content = await providerManager.chatComplete(messages, {
          model: body.model,
          max_tokens: body.max_tokens,
          temperature: body.temperature,
        });

        // Store assistant response
        insertConversation({
          session_id: 'api-' + chatStart,
          role: 'assistant',
          content,
          provider: providerManager.getPrimaryName(),
          model: body.model ?? config.provider.primary,
          tokens_used: 0,
          latency_ms: Date.now() - chatStart,
          timestamp: Date.now(),
          channel: 'api',
        });

        return {
          id: `chatcmpl-${randomUUID()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: body.model ?? config.provider.primary,
          choices: [{
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
      } catch (error: unknown) {
        const err = error as { message: string };
        reply.status(500).send({ error: { message: err.message } });
      }
    }
  });

  // OpenAI-compatible models endpoint
  app.get('/v1/models', async () => {
    return {
      object: 'list',
      data: [
        { id: config.provider.primary, object: 'model', owned_by: 'medo' },
        { id: config.provider.fallback, object: 'model', owned_by: 'medo' },
      ],
    };
  });

  // Webhook receiver
  app.post<{ Params: { name: string } }>('/hooks/:name', async (request) => {
    const name = request.params.name;
    const body = request.body;

    insertConversation({
      session_id: `webhook-${name}-${Date.now()}`,
      role: 'user',
      content: JSON.stringify(body),
      provider: '',
      model: '',
      tokens_used: 0,
      latency_ms: 0,
      timestamp: Date.now(),
      channel: 'webhook',
    });

    broadcastToClients({
      type: 'activity',
      payload: {
        type: 'channel_message',
        summary: `Webhook received: ${name}`,
        details: JSON.stringify(body).slice(0, 500),
      },
      timestamp: Date.now(),
    });

    return { received: true, hook: name };
  });

  // === Memory API routes ===

  // Semantic memories
  app.get('/api/memories', async (request) => {
    const query = request.query as { limit?: string; offset?: string; category?: string };
    return getMemories(
      parseInt(query.limit ?? '100', 10),
      parseInt(query.offset ?? '0', 10),
      query.category
    );
  });

  app.post('/api/memories', async (request) => {
    const body = request.body as {
      content: string;
      category?: string;
      source?: string;
      confidence?: number;
      tags?: string[];
      conversation_id?: string;
      channel?: string;
    };
    const id = insertMemory({
      content: body.content,
      embedding: null,
      category: (body.category ?? 'fact') as 'fact',
      source: (body.source ?? 'manual') as 'manual',
      confidence: body.confidence ?? 1.0,
      tags: body.tags ?? [],
      conversation_id: body.conversation_id,
      channel: body.channel,
    });
    return { id };
  });

  app.delete<{ Params: { id: string } }>('/api/memories/:id', async (request) => {
    const deleted = deleteMemory(request.params.id);
    return { deleted };
  });

  app.delete('/api/memories', async (request) => {
    const query = request.query as { category: string };
    const count = deleteMemoriesByCategory(query.category);
    return { deleted: count };
  });

  app.get('/api/memories/search', async (request) => {
    const query = request.query as { q: string; limit?: string };
    return searchMemoriesByText(query.q, parseInt(query.limit ?? '10', 10));
  });

  app.post('/api/memories/consolidate', async () => {
    const result = consolidateMemories();
    return result;
  });

  // Memory graph endpoint with optional clustering
  app.get('/api/memories/graph', async (request) => {
    const query = request.query as { before?: string; cluster?: string };
    let graphData;
    if (query.before) {
      const before = parseInt(query.before, 10);
      const { getMemoryGraphData: getGraph } = await import('../memory/database.js');
      const memories = getMemoriesAtTime(before);
      // Build edges from the time-filtered memories
      const nodes = memories;
      const edges: Array<{ source: string; target: string; weight: number }> = [];
      for (let i = 0; i < nodes.length; i++) {
        const wordsA = new Set(nodes[i].content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        for (let j = i + 1; j < nodes.length; j++) {
          const wordsB = new Set(nodes[j].content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
          let shared = 0;
          for (const w of wordsA) { if (wordsB.has(w)) shared++; }
          const minSize = Math.min(wordsA.size, wordsB.size);
          if (minSize > 0 && shared / minSize > 0.3) {
            edges.push({ source: nodes[i].id, target: nodes[j].id, weight: shared / minSize });
          }
        }
      }
      graphData = { nodes, edges };
    } else {
      graphData = getMemoryGraphData();
    }

    // Auto-clustering: group connected nodes
    if (query.cluster === 'true' || !query.cluster) {
      const clusters = autoClusterMemories(graphData.nodes as Array<{ id: string; content: string; category: string }>, graphData.edges);
      return { ...graphData, clusters };
    }

    return graphData;
  });

  // Memory health endpoint
  app.get('/api/memories/health', async () => {
    return getMemoryHealth();
  });

  // Memory timeline (memories at a point in time)
  app.get('/api/memories/timeline', async (request) => {
    const query = request.query as { before: string; limit?: string };
    const before = parseInt(query.before, 10);
    return getMemoriesAtTime(before, parseInt(query.limit ?? '200', 10));
  });

  // Reinforce a memory (used when memory is referenced in response)
  app.post<{ Params: { id: string } }>('/api/memories/:id/reinforce', async (request) => {
    reinforceMemory(request.params.id);
    broadcastToClients({
      type: 'memory-pulse',
      payload: { memoryId: request.params.id },
      timestamp: Date.now(),
    });
    return { reinforced: true };
  });

  // Update a memory
  app.put<{ Params: { id: string } }>('/api/memories/:id', async (request) => {
    const body = request.body as {
      content?: string;
      category?: string;
      confidence?: number;
      tags?: string[];
    };
    const updated = updateMemory(request.params.id, body);
    return { updated };
  });

  // Get a single memory by ID
  app.get<{ Params: { id: string } }>('/api/memories/:id', async (request) => {
    const memory = getMemoryById(request.params.id);
    if (!memory) return { error: 'Not found' };
    return memory;
  });

  // Get conversation by ID (for provenance)
  app.get<{ Params: { id: string } }>('/api/conversations/:id', async (request) => {
    const conv = getConversationById(request.params.id);
    if (!conv) return { error: 'Not found' };
    return conv;
  });

  // Apply confidence decay
  app.post('/api/memories/decay', async () => {
    const affected = applyConfidenceDecay();
    return { affected };
  });

  // Structured memory
  app.get('/api/structured', async (request) => {
    const query = request.query as { category?: string };
    return getAllStructuredMemory(query.category);
  });

  app.get<{ Params: { key: string } }>('/api/structured/:key', async (request) => {
    const entry = getStructuredMemory(request.params.key);
    if (!entry) {
      return { error: 'Not found' };
    }
    return entry;
  });

  app.put<{ Params: { key: string } }>('/api/structured/:key', async (request) => {
    const body = request.body as {
      value: string;
      type?: string;
      category?: string;
    };
    setStructuredMemory({
      key: request.params.key,
      value: body.value,
      type: (body.type ?? 'string') as 'string',
      category: (body.category ?? 'preferences') as 'preferences',
      updated_at: Date.now(),
      source: 'api',
    });
    return { updated: true };
  });

  app.delete<{ Params: { key: string } }>('/api/structured/:key', async (request) => {
    const deleted = deleteStructuredMemory(request.params.key);
    return { deleted };
  });

  // Conversations
  app.get('/api/conversations', async (request) => {
    const query = request.query as { session_id?: string; limit?: string; offset?: string };
    return getConversations(
      query.session_id,
      parseInt(query.limit ?? '50', 10),
      parseInt(query.offset ?? '0', 10)
    );
  });

  app.get('/api/conversations/recent', async (request) => {
    const query = request.query as { limit?: string };
    return getRecentConversations(parseInt(query.limit ?? '20', 10));
  });

  // Activities
  app.get('/api/activities', async (request) => {
    const query = request.query as { limit?: string; offset?: string; type?: string };
    return getActivities(
      parseInt(query.limit ?? '100', 10),
      parseInt(query.offset ?? '0', 10),
      query.type
    );
  });

  // Tool calls
  app.get('/api/tool-calls', async (request) => {
    const query = request.query as { session_id?: string; limit?: string };
    return getToolCalls(query.session_id, parseInt(query.limit ?? '50', 10));
  });

  // Skills API
  app.get('/api/skills', async () => {
    const skills = skillManager.getAllSkills();
    return skills.map(s => {
      const executions = getSkillExecutions(s.config.name, 10);
      return {
        name: s.config.name,
        description: s.config.description,
        enabled: s.config.enabled,
        triggers: s.config.triggers,
        tools: s.config.tools,
        filePath: s.filePath,
        lastRun: s.lastRun ?? (executions.length > 0 ? executions[0].timestamp : undefined),
        executions,
        hasNeverRun: executions.length === 0,
      };
    });
  });

  app.post('/api/skills', async (request) => {
    const body = request.body as {
      name: string;
      content: string;
      description?: string;
      triggers?: Array<{ cron?: string; keyword?: string }>;
      tools?: string[];
      enabled?: boolean;
    };
    const filePath = skillManager.createSkill(body.name, body.content, {
      name: body.name,
      description: body.description ?? '',
      triggers: body.triggers ?? [],
      tools: body.tools ?? [],
      enabled: body.enabled !== false,
    });
    return { created: true, filePath };
  });

  // Skill builder: generate skill from natural language description
  app.post('/api/skills/generate', async (request) => {
    const body = request.body as { description: string };
    if (!body.description) {
      return { error: 'Description is required' };
    }

    try {
      const prompt = `You are a skill generator for the MEDO personal AI agent. A skill is a markdown file with YAML frontmatter. Generate a skill based on this user description:

"${body.description}"

Return ONLY valid markdown with YAML frontmatter in this format:
---
name: skill-name-here
description: Short description
triggers:
  - keyword: "trigger phrase"
tools: []
enabled: true
---

Skill instructions go here. Write clear, actionable instructions the AI agent should follow when this skill is triggered.

Remember: the skill content is instructions for the AI, not code. Be specific and helpful.`;

      const generatedCode = await providerManager.chatComplete(
        [{ role: 'user', content: prompt }],
        { max_tokens: 1000 },
      );

      return { success: true, generatedSkill: generatedCode };
    } catch (error: unknown) {
      const err = error as { message: string };
      return { success: false, error: err.message };
    }
  });

  // Skill execution history
  app.get<{ Params: { name: string } }>('/api/skills/:name/executions', async (request) => {
    return getSkillExecutions(request.params.name, 10);
  });

  // Run a skill manually
  app.post<{ Params: { name: string } }>('/api/skills/:name/run', async (request) => {
    const skill = skillManager.getSkill(request.params.name);
    if (!skill) return { error: 'Skill not found' };

    const start = Date.now();
    try {
      const response = await providerManager.chatComplete(
        [
          { role: 'system', content: `You are executing the skill "${skill.config.name}": ${skill.content}` },
          { role: 'user', content: `Execute this skill now. Follow the instructions precisely.` },
        ],
        { max_tokens: 1000 },
      );

      insertSkillExecution({
        skill_name: skill.config.name,
        triggered_by: 'manual',
        success: true,
        output: response.slice(0, 2000),
        duration_ms: Date.now() - start,
      });

      return { success: true, output: response };
    } catch (error: unknown) {
      const err = error as { message: string };
      insertSkillExecution({
        skill_name: skill.config.name,
        triggered_by: 'manual',
        success: false,
        output: '',
        error: err.message,
        duration_ms: Date.now() - start,
      });
      return { success: false, error: err.message };
    }
  });

  app.put<{ Params: { name: string } }>('/api/skills/:name', async (request) => {
    const body = request.body as { content: string };
    const updated = skillManager.updateSkill(request.params.name, body.content);
    return { updated };
  });

  app.delete<{ Params: { name: string } }>('/api/skills/:name', async (request) => {
    const deleted = skillManager.deleteSkill(request.params.name);
    return { deleted };
  });

  app.post<{ Params: { name: string } }>('/api/skills/:name/toggle', async (request) => {
    const body = request.body as { enabled: boolean };
    const updated = skillManager.toggleSkill(request.params.name, body.enabled);
    return { updated };
  });

  // Config API
  app.get('/api/config', async () => {
    // Return config with masked API keys
    const masked = JSON.parse(JSON.stringify(config)) as MedoConfig;
    for (const key of Object.keys(masked.provider.apiKeys)) {
      const val = masked.provider.apiKeys[key];
      if (val && !val.startsWith('http') && !val.startsWith('$')) {
        masked.provider.apiKeys[key] = val.slice(0, 8) + '****';
      }
    }
    return masked;
  });

  app.put('/api/config', async (request) => {
    const body = request.body as Partial<MedoConfig>;
    Object.assign(config, body);
    saveConfig(config);
    return { updated: true };
  });

  // Stats endpoint
  app.get('/api/stats', async () => {
    return {
      ...getMemoryStats(),
      connectedClients: getConnectedClientsCount(),
      uptime: Date.now() - startTime,
    };
  });

  // Pending tasks
  app.get('/api/tasks', async () => {
    return getPendingTasks();
  });

  app.post<{ Params: { id: string } }>('/api/tasks/:id/resolve', async (request) => {
    resolveTask(request.params.id);
    return { resolved: true };
  });

  // Auth endpoints
  app.post('/api/auth/setup', async (request) => {
    const body = request.body as { pin: string };
    if (!body.pin || body.pin.length < 4) {
      return { error: 'PIN must be at least 4 characters' };
    }
    const hash = bcrypt.hashSync(body.pin, 10);
    setAuthHash(hash);
    return { success: true };
  });

  app.post('/api/auth/verify', async (request) => {
    const body = request.body as { pin: string };
    const hash = getAuthHash();
    if (!hash) {
      return { authenticated: true, noAuthRequired: true };
    }
    const valid = bcrypt.compareSync(body.pin, hash);
    return { authenticated: valid };
  });

  app.get('/api/auth/status', async () => {
    const hash = getAuthHash();
    return { authConfigured: !!hash };
  });

  // Proactive status
  app.get('/api/proactive/status', async () => {
    if (proactiveWorker) {
      return proactiveWorker.getStatus();
    }
    return { enabled: false };
  });

  // Provider test endpoint
  app.post('/api/providers/test', async (request) => {
    const body = request.body as { provider?: string };
    try {
      const response = await providerManager.chatComplete(
        [{ role: 'user', content: 'Say hello in exactly one word.' }],
        { max_tokens: 10 },
      );
      return { success: true, response: response.slice(0, 100), provider: body.provider ?? config.provider.primary };
    } catch (error: unknown) {
      const err = error as { message: string };
      return { success: false, error: err.message };
    }
  });

  // === Onboarding API ===
  app.get('/api/onboarding/status', async () => {
    return getOnboardingState();
  });

  app.post('/api/onboarding/complete', async (request) => {
    const body = request.body as {
      userName: string;
      provider?: { primary: string; apiKey: string; keyName: string };
      channels?: { telegram?: { botToken: string } };
      aboutYou?: { work?: string; goals?: string; goodDay?: string };
    };

    // Save user name
    setOnboardingComplete(body.userName);

    // Store user info in structured memory
    setStructuredMemory({
      key: 'user.name',
      value: body.userName,
      type: 'string',
      category: 'identity',
      updated_at: Date.now(),
      source: 'onboarding',
    });

    // Update provider config if provided
    if (body.provider) {
      config.provider.primary = body.provider.primary;
      config.provider.apiKeys[body.provider.keyName] = body.provider.apiKey;
      saveConfig(config);
    }

    // Set up Telegram if provided
    if (body.channels?.telegram?.botToken) {
      config.channels.telegram = {
        enabled: true,
        botToken: body.channels.telegram.botToken,
      };
      saveConfig(config);
    }

    // Store "about you" responses as semantic memories
    if (body.aboutYou) {
      if (body.aboutYou.work) {
        insertMemory({
          content: `User's work: ${body.aboutYou.work}`,
          embedding: null,
          category: 'fact',
          source: 'manual',
          confidence: 1.0,
          tags: ['onboarding', 'work'],
        });
        setStructuredMemory({
          key: 'user.work',
          value: body.aboutYou.work,
          type: 'string',
          category: 'identity',
          updated_at: Date.now(),
          source: 'onboarding',
        });
      }
      if (body.aboutYou.goals) {
        insertMemory({
          content: `User's goals: ${body.aboutYou.goals}`,
          embedding: null,
          category: 'fact',
          source: 'manual',
          confidence: 1.0,
          tags: ['onboarding', 'goals'],
        });
        setStructuredMemory({
          key: 'user.goals',
          value: body.aboutYou.goals,
          type: 'string',
          category: 'goals',
          updated_at: Date.now(),
          source: 'onboarding',
        });
      }
      if (body.aboutYou.goodDay) {
        insertMemory({
          content: `What a good day looks like for the user: ${body.aboutYou.goodDay}`,
          embedding: null,
          category: 'preference',
          source: 'manual',
          confidence: 1.0,
          tags: ['onboarding', 'lifestyle'],
        });
        setStructuredMemory({
          key: 'user.goodDay',
          value: body.aboutYou.goodDay,
          type: 'string',
          category: 'preferences',
          updated_at: Date.now(),
          source: 'onboarding',
        });
      }
    }

    return { success: true };
  });

  // Generate welcome message based on onboarding data
  app.post('/api/onboarding/welcome', async () => {
    const state = getOnboardingState();
    if (!state.completed) {
      return { message: 'Welcome to MEDO! Complete onboarding to get started.' };
    }

    const memories = getMemories(20);
    const memoryContext = memories.map(m => m.content).join('\n');

    try {
      const response = await providerManager.chatComplete([
        {
          role: 'system',
          content: `You are Medo, a personal AI assistant. The user just completed onboarding. Their name is ${state.userName}. Here is what you know about them:\n${memoryContext}\n\nGenerate a warm, personalized welcome message that demonstrates you actually read and remembered what they told you. Keep it under 150 words. Be friendly and helpful. Reference specific things they mentioned.`,
        },
        { role: 'user', content: 'Send me a welcome message.' },
      ], { max_tokens: 300 });

      // Store the welcome message
      insertConversation({
        session_id: 'onboarding-welcome',
        role: 'assistant',
        content: response,
        provider: providerManager.getPrimaryName(),
        model: config.provider.primary,
        tokens_used: 0,
        latency_ms: 0,
        timestamp: Date.now(),
        channel: 'web',
      });

      return { message: response };
    } catch (error: unknown) {
      const err = error as { message: string };
      return { message: `Welcome to MEDO, ${state.userName}! I'm ready to help you. ${err.message ? '' : ''}` };
    }
  });

  // Skill suggestion based on conversation patterns
  app.get('/api/skills/suggestions', async () => {
    const recent = getRecentConversations(50);
    if (recent.length < 5) {
      return { suggestions: [] };
    }

    try {
      const conversationSummary = recent
        .filter(c => c.role === 'user')
        .slice(0, 20)
        .map(c => c.content)
        .join('\n');

      const response = await providerManager.chatComplete([
        {
          role: 'system',
          content: `Analyze these user messages and suggest up to 3 skills (automations) that could help them. For each suggestion, provide a JSON array with objects having "title", "description", and "skillDescription" fields. Return ONLY the JSON array, no other text.`,
        },
        { role: 'user', content: conversationSummary },
      ], { max_tokens: 500 });

      try {
        const suggestions = JSON.parse(response);
        return { suggestions: Array.isArray(suggestions) ? suggestions : [] };
      } catch {
        return { suggestions: [] };
      }
    } catch {
      return { suggestions: [] };
    }
  });
}

// Auto-cluster memories based on shared words/edges
function autoClusterMemories(
  nodes: Array<{ id: string; content: string; category: string }>,
  edges: Array<{ source: string; target: string; weight: number }>,
): Array<{ id: string; label: string; nodeIds: string[]; color: string }> {
  if (nodes.length === 0) return [];

  // Simple connected-components clustering
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const clusters: Array<{ id: string; label: string; nodeIds: string[]; color: string }> = [];
  const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];
  let colorIdx = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) continue;

    const cluster: string[] = [];
    const queue = [node.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      cluster.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }

    if (cluster.length > 0) {
      // Generate label from most common category and keywords
      const clusterNodes = cluster.map(id => nodes.find(n => n.id === id)!).filter(Boolean);
      const categories = clusterNodes.map(n => n.category);
      const topCategory = categories.sort((a, b) =>
        categories.filter(c => c === b).length - categories.filter(c => c === a).length
      )[0] ?? 'General';

      // Extract common keywords
      const allWords = clusterNodes.flatMap(n =>
        n.content.toLowerCase().split(/\s+/).filter(w => w.length > 4)
      );
      const wordCounts = new Map<string, number>();
      for (const w of allWords) {
        wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
      }
      const topWords = [...wordCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([w]) => w);

      const label = topWords.length > 0
        ? topWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' & ')
        : topCategory.charAt(0).toUpperCase() + topCategory.slice(1);

      clusters.push({
        id: `cluster-${clusters.length}`,
        label,
        nodeIds: cluster,
        color: colors[colorIdx % colors.length],
      });
      colorIdx++;
    }
  }

  return clusters;
}
""")

# ============================================================
# 4. Update gateway/websocket.ts - add execution trace events
# ============================================================
write_file('src/gateway/websocket.ts', r"""import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { WSMessage, ChatRequest, MedoConfig } from '../types/index.js';
import { ProviderManager } from '../providers/index.js';
import { SkillManager } from '../skills/index.js';
import {
  insertConversation,
  insertMemory,
  insertActivity,
  searchMemoriesByText,
  getRecentConversations,
  reinforceMemory,
} from '../memory/database.js';
import { getToolDefinitions } from '../tools/index.js';
import { ProactiveWorker } from '../proactive/index.js';
import { randomUUID } from 'crypto';
import { resolveEnvVar } from './config.js';

let proactiveWorkerRef: ProactiveWorker | null = null;

export function setProactiveWorker(worker: ProactiveWorker): void {
  proactiveWorkerRef = worker;
}

interface ConnectedClient {
  ws: WebSocket;
  authenticated: boolean;
  id: string;
}

const clients: Map<string, ConnectedClient> = new Map();

export function setupWebSocket(
  app: FastifyInstance,
  config: MedoConfig,
  providerManager: ProviderManager,
  skillManager: SkillManager,
): void {
  app.get('/ws', { websocket: true }, (socket) => {
    const clientId = randomUUID();
    const client: ConnectedClient = {
      ws: socket as unknown as WebSocket,
      authenticated: false,
      id: clientId,
    };
    clients.set(clientId, client);

    console.log(`WebSocket client connected: ${clientId}`);

    const rawSocket = socket as unknown as WebSocket;

    rawSocket.on('message', async (data: Buffer | string) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        await handleMessage(client, message, config, providerManager, skillManager);
      } catch (error) {
        sendToClient(client, {
          type: 'chat-error',
          payload: { error: 'Invalid message format' },
          timestamp: Date.now(),
        });
      }
    });

    rawSocket.on('close', () => {
      clients.delete(clientId);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });

    rawSocket.on('error', (error: Error) => {
      console.error(`WebSocket error for ${clientId}:`, error.message);
      clients.delete(clientId);
    });
  });
}

async function handleMessage(
  client: ConnectedClient,
  message: WSMessage,
  config: MedoConfig,
  providerManager: ProviderManager,
  skillManager: SkillManager,
): Promise<void> {
  switch (message.type) {
    case 'connect': {
      const token = resolveEnvVar(config.gateway.auth.token);
      const providedToken = (message.payload as { token?: string })?.token;

      // Allow connection if no token configured or token matches
      if (!token || providedToken === token) {
        client.authenticated = true;
        sendToClient(client, {
          type: 'hello-ok',
          payload: {
            version: '0.2.0',
            provider: config.provider.primary,
            features: ['chat', 'memory', 'skills', 'proactive', 'tools', 'onboarding', 'skill-builder', 'execution-trace'],
          },
          timestamp: Date.now(),
        });
      } else {
        sendToClient(client, {
          type: 'chat-error',
          payload: { error: 'Authentication failed' },
          timestamp: Date.now(),
        });
      }
      break;
    }

    case 'chat': {
      if (!client.authenticated) {
        sendToClient(client, {
          type: 'chat-error',
          payload: { error: 'Not authenticated' },
          timestamp: Date.now(),
        });
        return;
      }

      const chatReq = message.payload as ChatRequest;
      await handleChat(client, chatReq, config, providerManager, skillManager);
      break;
    }

    case 'ping': {
      sendToClient(client, { type: 'pong', timestamp: Date.now() });
      break;
    }

    default:
      sendToClient(client, {
        type: 'chat-error',
        payload: { error: `Unknown message type: ${message.type}` },
        timestamp: Date.now(),
      });
  }
}

async function handleChat(
  client: ConnectedClient,
  request: ChatRequest,
  config: MedoConfig,
  providerManager: ProviderManager,
  skillManager: SkillManager,
): Promise<void> {
  const sessionId = request.session_id ?? randomUUID();
  const channel = (request.channel ?? 'web') as 'web';
  const startTime = Date.now();

  // Store user message
  insertConversation({
    session_id: sessionId,
    role: 'user',
    content: request.message,
    provider: '',
    model: '',
    tokens_used: 0,
    latency_ms: 0,
    timestamp: Date.now(),
    channel,
  });

  // Send execution trace: starting
  sendToClient(client, {
    type: 'execution-trace',
    id: sessionId,
    payload: { step: 'Analyzing your message...', status: 'active' },
    timestamp: Date.now(),
  });

  // Check for slash commands
  if (request.message.startsWith('/')) {
    const skillName = request.message.slice(1).split(' ')[0];
    const skill = skillManager.getSkill(skillName);
    if (skill) {
      sendToClient(client, {
        type: 'tool-call',
        payload: { tool: 'skill_run', input: { name: skillName } },
        timestamp: Date.now(),
      });
    }
  }

  // Check for keyword-triggered skills
  const matchedSkills = skillManager.getSkillsByKeyword(request.message);

  // Retrieve relevant memories for context
  sendToClient(client, {
    type: 'execution-trace',
    id: sessionId,
    payload: { step: 'Searching memories for relevant context...', status: 'active' },
    timestamp: Date.now(),
  });

  const relevantMemories = searchMemoriesByText(request.message, 10);

  // Reinforce and pulse memories that are being used
  const usedMemoryIds: string[] = [];
  if (relevantMemories.length > 0) {
    sendToClient(client, {
      type: 'execution-trace',
      id: sessionId,
      payload: { step: `Found ${relevantMemories.length} relevant memories`, status: 'done' },
      timestamp: Date.now(),
    });

    for (const mem of relevantMemories.slice(0, 5)) {
      reinforceMemory(mem.id);
      usedMemoryIds.push(mem.id);
    }

    // Broadcast memory pulse for all used memories
    broadcastToClients({
      type: 'memory-pulse',
      payload: { memoryIds: usedMemoryIds },
      timestamp: Date.now(),
    });
  }

  // Build system prompt
  let systemPrompt = `You are Medo, a personal AI assistant. You are knowledgeable, helpful, and proactive.`;

  if (relevantMemories.length > 0) {
    systemPrompt += `\n\nRelevant memories:\n${relevantMemories.map(m => `- ${m.content}`).join('\n')}`;
  }

  if (matchedSkills.length > 0) {
    systemPrompt += `\n\nActive skills:\n${matchedSkills.map(s => `- ${s.config.name}: ${s.content}`).join('\n')}`;
  }

  // Get recent conversation context
  const recentMessages = getRecentConversations(10)
    .reverse()
    .map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...recentMessages,
    { role: 'user' as const, content: request.message },
  ];

  // Send execution trace: calling LLM
  sendToClient(client, {
    type: 'execution-trace',
    id: sessionId,
    payload: { step: `Generating response with ${config.provider.primary}...`, status: 'active' },
    timestamp: Date.now(),
  });

  try {
    let fullResponse = '';

    for await (const chunk of providerManager.chat(messages, {
      model: request.model,
      tools: getToolDefinitions(),
    })) {
      fullResponse += chunk;
      sendToClient(client, {
        type: 'chat-stream',
        id: sessionId,
        payload: { content: chunk, done: false },
        timestamp: Date.now(),
      });
    }

    const latency = Date.now() - startTime;

    // Send execution trace: done
    sendToClient(client, {
      type: 'execution-trace',
      id: sessionId,
      payload: { step: `Response generated in ${latency}ms`, status: 'done' },
      timestamp: Date.now(),
    });

    // Store assistant response
    insertConversation({
      session_id: sessionId,
      role: 'assistant',
      content: fullResponse,
      provider: providerManager.getPrimaryName(),
      model: request.model ?? '',
      tokens_used: 0,
      latency_ms: latency,
      timestamp: Date.now(),
      channel,
    });

    // Store as semantic memory
    if (fullResponse.length > 50) {
      insertMemory({
        content: `User: ${request.message}\nAssistant: ${fullResponse.slice(0, 500)}`,
        embedding: null,
        category: 'fact',
        source: 'conversation',
        confidence: 0.8,
        tags: [],
        conversation_id: sessionId,
        channel,
      });
    }

    // Extract tasks for smart reminders
    if (proactiveWorkerRef) {
      proactiveWorkerRef.extractAndStoreTasks(request.message, sessionId, channel);
    }

    sendToClient(client, {
      type: 'chat-done',
      id: sessionId,
      payload: {
        content: fullResponse,
        done: true,
        model: request.model ?? config.provider.primary,
        provider: providerManager.getPrimaryName(),
        latency_ms: latency,
        usedMemoryIds,
      },
      timestamp: Date.now(),
    });

    insertActivity({
      type: 'channel_message',
      summary: `Chat response (${latency}ms)`,
      details: fullResponse.slice(0, 500),
      timestamp: Date.now(),
      session_id: sessionId,
    });
  } catch (error: unknown) {
    const err = error as { message: string };
    sendToClient(client, {
      type: 'execution-trace',
      id: sessionId,
      payload: { step: `Error: ${err.message}`, status: 'error' },
      timestamp: Date.now(),
    });
    sendToClient(client, {
      type: 'chat-error',
      id: sessionId,
      payload: { error: err.message },
      timestamp: Date.now(),
    });
  }
}

function sendToClient(client: ConnectedClient, message: WSMessage): void {
  try {
    const rawSocket = client.ws as unknown as WebSocket;
    if (rawSocket.readyState === 1) { // WebSocket.OPEN
      rawSocket.send(JSON.stringify(message));
    }
  } catch (error) {
    console.error('Failed to send to client:', error);
  }
}

export function broadcastToClients(message: WSMessage): void {
  for (const client of clients.values()) {
    if (client.authenticated) {
      sendToClient(client, message);
    }
  }
}

export function getConnectedClientsCount(): number {
  return clients.size;
}
""")

print('\nAll Sprint 3 backend files written!')
