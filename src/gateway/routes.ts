import type { FastifyInstance } from 'fastify';
import type { MedoConfig, HealthResponse } from '../types/index.js';
import { ProviderManager } from '../providers/index.js';
import { SkillManager } from '../skills/index.js';
import {
  getDatabase,
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
  getFirstMessageFlag,
  setFirstMessageFlag,
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
  proactiveWorker?: { getStatus: () => Record<string, unknown>; getConfig: () => Record<string, unknown>; forceProactive?: () => Promise<void> },
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

    // First-message experience: inject onboarding context into system prompt for REST API too
    if (getFirstMessageFlag()) {
      const structured = getAllStructuredMemory();
      const userName = structured.find(s => s.key === 'user.name')?.value;
      const userWork = structured.find(s => s.key === 'user.work')?.value;
      const userGoals = structured.find(s => s.key === 'user.goals')?.value;
      const userGoodDay = structured.find(s => s.key === 'user.goodDay')?.value;
      const addendum = `\n\nIMPORTANT — This is the user's FIRST message after completing onboarding. You must:
1. Answer their question thoroughly
2. Weave in specific details from what they shared during onboarding — NOT as a list, naturally woven into the response
3. End with one proactive observation that makes the user feel understood

Here is what they told you during onboarding:
- Name: ${userName || 'unknown'}
- Work: ${userWork || 'not shared'}
- Goals: ${userGoals || 'not shared'}
- What a good day looks like: ${userGoodDay || 'not shared'}

Reference these details naturally in your response. Do NOT just repeat them back as a list.`;

      // Prepend system message with onboarding context
      const hasSystem = messages.some(m => m.role === 'system');
      if (hasSystem) {
        const sysMsg = messages.find(m => m.role === 'system');
        if (sysMsg) sysMsg.content += addendum;
      } else {
        messages.unshift({ role: 'system', content: `You are Medo, a personal AI assistant.${addendum}` });
      }

      setFirstMessageFlag(false);
    }

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

      const duration_ms = Date.now() - start;
      insertSkillExecution({
        skill_name: skill.config.name,
        triggered_by: 'manual',
        success: true,
        output: response.slice(0, 2000),
        duration_ms,
      });

      // Broadcast skill_execution_complete via WebSocket
      broadcastToClients({
        type: 'skill_execution_complete',
        payload: {
          skill_id: skill.config.name,
          success: true,
          duration_ms,
          output_preview: response.slice(0, 200),
        },
        timestamp: Date.now(),
      });

      return { success: true, output: response };
    } catch (error: unknown) {
      const err = error as { message: string };
      const duration_ms = Date.now() - start;
      insertSkillExecution({
        skill_name: skill.config.name,
        triggered_by: 'manual',
        success: false,
        output: '',
        error: err.message,
        duration_ms,
      });

      // Broadcast failure via WebSocket
      broadcastToClients({
        type: 'skill_execution_complete',
        payload: {
          skill_id: skill.config.name,
          success: false,
          duration_ms,
          output_preview: '',
          error: err.message,
        },
        timestamp: Date.now(),
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

  // Force proactive delivery (only when MEDO_FORCE_PROACTIVE=true)
  app.post('/api/proactive/force', async () => {
    if (process.env.MEDO_FORCE_PROACTIVE !== 'true') {
      return { success: false, error: 'MEDO_FORCE_PROACTIVE env var is not set to true' };
    }
    if (!proactiveWorker || !proactiveWorker.forceProactive) {
      return { success: false, error: 'Proactive worker not available' };
    }
    try {
      await proactiveWorker.forceProactive();
      return { success: true, message: 'Proactive message sent via WebSocket' };
    } catch (error: unknown) {
      const err = error as { message: string };
      return { success: false, error: err.message };
    }
  });

  // Provider test endpoint (uses configured provider) — real API call with max_tokens:1
  app.post('/api/providers/test', async (request) => {
    const body = request.body as { provider?: string };
    const testStart = Date.now();
    try {
      await providerManager.chatComplete(
        [{ role: 'user', content: 'ping' }],
        { max_tokens: 1 },
      );
      const latency = Date.now() - testStart;
      return { success: true, latency_ms: latency, message: `Connected · ${latency}ms`, provider: body.provider ?? config.provider.primary };
    } catch (error: unknown) {
      const err = error as { message: string };
      return { success: false, latency_ms: Date.now() - testStart, message: 'Failed — check your API key', error: err.message };
    }
  });

  // Test an arbitrary API key (for onboarding before config is saved)
  app.post('/api/providers/test-key', async (request) => {
    const body = request.body as { provider: string; apiKey: string };
    if (!body.provider || !body.apiKey) {
      return { success: false, error: 'Provider and API key are required' };
    }
    try {
      if (body.provider === 'anthropic') {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: body.apiKey });
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say hello in one word.' }],
        });
        const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
        return { success: true, response: text.slice(0, 100), provider: 'anthropic' };
      } else if (body.provider === 'openai') {
        const { default: OpenAI } = await import('openai');
        const client = new OpenAI({ apiKey: body.apiKey });
        const res = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say hello in one word.' }],
        });
        return { success: true, response: res.choices[0]?.message?.content?.slice(0, 100) ?? '', provider: 'openai' };
      } else if (body.provider === 'openrouter') {
        const { default: OpenAI } = await import('openai');
        const client = new OpenAI({ apiKey: body.apiKey, baseURL: 'https://openrouter.ai/api/v1' });
        const res = await client.chat.completions.create({
          model: 'anthropic/claude-3.5-sonnet',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say hello in one word.' }],
        });
        return { success: true, response: res.choices[0]?.message?.content?.slice(0, 100) ?? '', provider: 'openrouter' };
      } else {
        return { success: false, error: `Unsupported provider: ${body.provider}` };
      }
    } catch (error: unknown) {
      const err = error as { message: string };
      return { success: false, error: err.message || 'API key test failed' };
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

    // Set first-message flag so the first chat response references onboarding context
    setFirstMessageFlag(true);

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

      // Clean up any remaining ${...} placeholders so they don't get written to disk
      for (const [key, value] of Object.entries(config.provider.apiKeys)) {
        if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
          (config.provider.apiKeys as Record<string, string>)[key] = '';
        }
      }
      if (config.gateway.auth.token.startsWith('${') && config.gateway.auth.token.endsWith('}')) {
        config.gateway.auth.token = '';
      }

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
  app.get('/api/onboarding/welcome', async () => {
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



  // First-message flag endpoint
  app.get('/api/v1/first-message-flag', async () => {
    return { firstMessage: getFirstMessageFlag() };
  });

  app.post('/api/v1/first-message-flag/clear', async () => {
    setFirstMessageFlag(false);
    return { cleared: true };
  });

  // === Settings API (for SettingsView) ===

  // Get current provider settings
  app.get('/api/v1/settings/provider', async () => {
    return {
      provider: config.provider.primary,
      model: config.provider.fallback || config.provider.primary,
      hasKey: Object.values(config.provider.apiKeys).some(k => k && k.length > 5),
    };
  });

  // Update provider settings
  app.post('/api/v1/settings/provider', async (request) => {
    const body = request.body as { provider?: string; model?: string; apiKey?: string };
    if (body.provider) config.provider.primary = body.provider;
    if (body.model) config.provider.fallback = body.model;
    if (body.apiKey) {
      const keyName = (body.provider || config.provider.primary).split('/')[0] || 'default';
      config.provider.apiKeys[keyName] = body.apiKey;
    }
    saveConfig(config);
    return { success: true };
  });

  // Get Telegram settings
  app.get('/api/v1/settings/telegram', async () => {
    return {
      enabled: !!config.channels.telegram?.enabled,
      connected: !!config.channels.telegram?.botToken,
    };
  });

  // Update Telegram settings
  app.post('/api/v1/settings/telegram', async (request) => {
    const body = request.body as { botToken?: string; enabled?: boolean };
    if (!config.channels.telegram) {
      config.channels.telegram = { enabled: false, botToken: '' };
    }
    if (body.botToken !== undefined) config.channels.telegram.botToken = body.botToken;
    if (body.enabled !== undefined) config.channels.telegram.enabled = body.enabled;
    saveConfig(config);
    return { success: true };
  });

  // Get proactive settings
  app.get('/api/v1/settings/proactive', async () => {
    if (proactiveWorker) {
      const workerConfig = proactiveWorker.getConfig();
      return {
        enabled: !!workerConfig.enabled,
        interval: workerConfig.interval || 60,
      };
    }
    return { enabled: false, interval: 60 };
  });

  // Update proactive settings
  app.post('/api/v1/settings/proactive', async (request) => {
    const body = request.body as { enabled?: boolean; interval?: number };
    // Store in structured memory for persistence
    if (body.enabled !== undefined) {
      setStructuredMemory({
        key: 'settings.proactive.enabled',
        value: String(body.enabled),
        type: 'string',
        category: 'preferences',
        updated_at: Date.now(),
        source: 'settings',
      });
    }
    if (body.interval !== undefined) {
      setStructuredMemory({
        key: 'settings.proactive.interval',
        value: String(body.interval),
        type: 'number',
        category: 'preferences',
        updated_at: Date.now(),
        source: 'settings',
      });
    }
    return { success: true };
  });

  // Danger zone: reset all data
  app.post('/api/v1/settings/reset', async () => {
    const database = getDatabase();
    database.exec('DELETE FROM memories');
    database.exec('DELETE FROM conversations');
    database.exec('DELETE FROM structured_memory');
    database.exec('DELETE FROM activity_log');
    database.exec('DELETE FROM tool_calls');
    database.exec('DELETE FROM pending_tasks');
    try { database.exec('DELETE FROM skill_executions'); } catch { /* table may not exist */ }
    return { success: true, message: 'All data has been reset.' };
  });

  // Activity endpoint (for ActivityView)
  app.get('/api/v1/activity', async (request) => {
    const query = request.query as { limit?: string; type?: string };
    const limit = parseInt(query.limit ?? '50', 10);
    const typeFilter = query.type;
    const activities = getActivities(limit, 0, typeFilter);
    return activities;
  });

  // Activity sessions — group activities by 2-hour windows
  app.get('/api/v1/activity/sessions', async (request) => {
    const query = request.query as { limit?: string };
    const limit = parseInt(query.limit ?? '200', 10);
    const activities = getActivities(limit, 0);
    
    // Sort by timestamp descending
    const sorted = [...activities].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    
    // Group into sessions (2-hour window)
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const sessions: Array<{
      id: string;
      startTime: number;
      endTime: number;
      duration: number;
      activities: typeof sorted;
      summary?: string;
    }> = [];
    
    let currentSession: typeof sessions[0] | null = null;
    for (const activity of sorted) {
      const ts = activity.timestamp ?? Date.now();
      if (!currentSession || (currentSession.startTime - ts) > TWO_HOURS) {
        currentSession = {
          id: `session-${sessions.length}`,
          startTime: ts,
          endTime: ts,
          duration: 0,
          activities: [activity],
        };
        sessions.push(currentSession);
      } else {
        currentSession.activities.push(activity);
        currentSession.startTime = Math.min(currentSession.startTime, ts);
        currentSession.endTime = Math.max(currentSession.endTime, ts);
        currentSession.duration = currentSession.endTime - currentSession.startTime;
      }
    }
    
    return sessions;
  });

  // Summarize a session using LLM (with caching)
  const sessionSummaryCache = new Map<string, string>();
  app.post('/api/v1/activity/sessions/summarize', async (request) => {
    const body = request.body as { sessionId: string; activities: Array<{ type: string; summary: string }> };
    
    // Check cache first
    const cached = sessionSummaryCache.get(body.sessionId);
    if (cached) return { summary: cached, cached: true };
    
    try {
      const activityList = body.activities.map(a => `[${a.type}] ${a.summary}`).join('\n');
      const response = await providerManager.chatComplete([
        { role: 'system', content: 'Summarize what was accomplished in this session in a single sentence. Be concise and specific.' },
        { role: 'user', content: activityList },
      ], { max_tokens: 100 });
      
      sessionSummaryCache.set(body.sessionId, response);
      return { summary: response, cached: false };
    } catch {
      return { summary: `${body.activities.length} activities`, cached: false };
    }
  });

  // Memories endpoint (for MemoryView)
  app.get('/api/v1/memories', async (request) => {
    const query = request.query as { limit?: string; offset?: string; category?: string };
    return getMemories(
      parseInt(query.limit ?? '100', 10),
      parseInt(query.offset ?? '0', 10),
      query.category
    );
  });

  // Memory health (for MemoryView stats)
  app.get('/api/v1/memory/health', async () => {
    return getMemoryHealth();
  });

  // Memory clusters (for MemoryView)
  app.get('/api/v1/memory/clusters', async () => {
    const graphData = getMemoryGraphData();
    const clusters = autoClusterMemories(
      graphData.nodes as Array<{ id: string; content: string; category: string }>,
      graphData.edges
    );
    return clusters;
  });

  // Skills endpoint (for SkillsView)
  app.get('/api/v1/skills', async () => {
    const skills = skillManager.getAllSkills();
    return skills.map(s => {
      const executions = getSkillExecutions(s.config.name, 5);
      return {
        name: s.config.name,
        description: s.config.description,
        enabled: s.config.enabled,
        triggers: s.config.triggers,
        tools: s.config.tools,
        lastRun: s.lastRun ?? (executions.length > 0 ? executions[0].timestamp : undefined),
        executions,
        hasNeverRun: executions.length === 0,
      };
    });
  });

  // Memories search (semantic search powered by LLM re-ranking)
  app.get('/api/v1/memories/search', async (request) => {
    const query = request.query as { q: string; limit?: string };
    const searchQuery = query.q;
    const limit = parseInt(query.limit ?? '10', 10);

    if (!searchQuery || !searchQuery.trim()) {
      return getMemories(limit, 0);
    }

    // First: try text-based search for exact/word matches (fast path)
    const textResults = searchMemoriesByText(searchQuery, limit);

    // If provider is available, enhance with LLM semantic re-ranking
    if (providerManager.isConnected()) {
      try {
        // Load a broad set of candidate memories for re-ranking
        const allMemories = getMemories(200, 0);
        if (allMemories.length === 0) return [];

        // Build compact memory list for LLM — include tags for better context
        const memoryList = allMemories
          .map((m, i) => {
            const tags = Array.isArray(m.tags) && m.tags.length > 0 ? ` [${m.tags.join(',')}]` : '';
            return `${i}|${m.content.slice(0, 120)}${tags}`;
          })
          .join('\n');

        const systemPrompt = `You are a semantic memory search engine. Your task is to score memories by how semantically related they are to a search query. Think about the MEANING and TOPIC of each memory, not just keyword overlap. A memory about "TypeScript" or "React" is highly relevant to a query about "programming languages" even if those exact words don't appear. A memory about "running 5km" is relevant to "fitness" even without that word. Score from 0 (unrelated) to 10 (perfect match). Return ONLY valid JSON.`;

        const userPrompt = `Query: "${searchQuery}"

Memories (index|content):
${memoryList}

Return a JSON array of {"i":index,"s":score} for memories with score > 0, sorted by score descending.`;

        const response = await providerManager.chatComplete(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          { max_tokens: 500, temperature: 0 },
        );

        // Parse LLM response — extract JSON array
        const jsonMatch = response.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const scores = JSON.parse(jsonMatch[0]) as Array<{ i: number; s: number }>;
          const ranked = scores
            .filter(s => s.s > 0 && s.i >= 0 && s.i < allMemories.length)
            .sort((a, b) => b.s - a.s)
            .slice(0, limit)
            .map(s => allMemories[s.i]);

          if (ranked.length > 0) return ranked;
        }
      } catch (err) {
        // LLM re-ranking failed — fall through to text results
        console.warn('Semantic search LLM re-ranking failed, using text fallback:', err);
      }
    }

    // Fallback: return text-based results
    return textResults;
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

  const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];
  const stopWords = new Set(['rome','that','this','with','from','they','have','been','also','about','their','which','would','there','could','other','into','more','some','than','them','like','just','over','such','after','most','only','very','when','what','your','will','each','make','were','then','these','know','want','give','well','first','even','where','much','take','come','made','find','back','many','long','great','little','world','still','good','does','help','using','every','uses']);

  // Topic-based clustering using tag and content keywords
  // Step 1: Extract keywords per node
  const nodeKeywords = new Map<string, Set<string>>();
  for (const node of nodes) {
    const words = new Set(
      node.content.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !stopWords.has(w))
    );
    nodeKeywords.set(node.id, words);
  }

  // Step 2: Build strong-edge adjacency (only high-weight edges for clustering)
  const strongThreshold = 0.25;
  const strongAdj = new Map<string, Map<string, number>>();
  for (const node of nodes) strongAdj.set(node.id, new Map());
  for (const e of edges) {
    if (e.weight >= strongThreshold) {
      strongAdj.get(e.source)?.set(e.target, e.weight);
      strongAdj.get(e.target)?.set(e.source, e.weight);
    }
  }

  // Step 3: Greedy modularity-like clustering
  // Start each node in its own cluster, merge most similar pairs
  const nodeCluster = new Map<string, number>();
  let nextClusterId = 0;
  for (const node of nodes) {
    nodeCluster.set(node.id, nextClusterId++);
  }

  // Merge clusters that share strong edges
  let changed = true;
  const maxIterations = 20;
  let iterations = 0;
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    // Find the pair of different clusters with the strongest inter-cluster connection
    const clusterStrength = new Map<string, number>();
    for (const e of edges) {
      const ca = nodeCluster.get(e.source)!;
      const cb = nodeCluster.get(e.target)!;
      if (ca === cb) continue;
      const key = Math.min(ca, cb) + '-' + Math.max(ca, cb);
      clusterStrength.set(key, (clusterStrength.get(key) ?? 0) + e.weight);
    }
    // Find best merge
    let bestKey = '';
    let bestStrength = 0.3; // minimum threshold to merge
    for (const [key, strength] of clusterStrength) {
      if (strength > bestStrength) {
        bestStrength = strength;
        bestKey = key;
      }
    }
    if (bestKey) {
      const [fromStr, toStr] = bestKey.split('-');
      const fromCluster = parseInt(fromStr, 10);
      const toCluster = parseInt(toStr, 10);
      // Count sizes - don't let clusters get too big
      let fromSize = 0, toSize = 0;
      for (const [, c] of nodeCluster) {
        if (c === fromCluster) fromSize++;
        if (c === toCluster) toSize++;
      }
      if (fromSize + toSize <= Math.max(5, Math.ceil(nodes.length * 0.5))) {
        for (const [nid, c] of nodeCluster) {
          if (c === fromCluster) nodeCluster.set(nid, toCluster);
        }
        changed = true;
      }
    }
  }

  // Step 4: Collect clusters
  const clusterMap = new Map<number, string[]>();
  for (const [nid, c] of nodeCluster) {
    if (!clusterMap.has(c)) clusterMap.set(c, []);
    clusterMap.get(c)!.push(nid);
  }

  // Step 5: Generate labels based on common keywords in each cluster
  const clusters: Array<{ id: string; label: string; nodeIds: string[]; color: string }> = [];
  let colorIdx = 0;
  for (const [, memberIds] of clusterMap) {
    if (memberIds.length === 0) continue;
    const clusterNodes = memberIds.map(id => nodes.find(n => n.id === id)!).filter(Boolean);

    // Find words that appear in multiple nodes in this cluster
    const wordFreq = new Map<string, number>();
    for (const cn of clusterNodes) {
      const words = nodeKeywords.get(cn.id) ?? new Set<string>();
      for (const w of words) {
        wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
      }
    }
    // Get top keywords that appear in at least 2 nodes (or just top if small cluster)
    const minFreq = clusterNodes.length > 2 ? 2 : 1;
    const topWords = [...wordFreq.entries()]
      .filter(([, count]) => count >= minFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

    // Fallback to category
    const catCounts = new Map<string, number>();
    for (const cn of clusterNodes) {
      catCounts.set(cn.category, (catCounts.get(cn.category) ?? 0) + 1);
    }
    const topCat = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'General';

    const label = topWords.length > 0
      ? topWords.join(' & ')
      : topCat.charAt(0).toUpperCase() + topCat.slice(1);

    clusters.push({
      id: `cluster-${clusters.length}`,
      label,
      nodeIds: memberIds,
      color: colors[colorIdx % colors.length],
    });
    colorIdx++;
  }

  return clusters;
}
