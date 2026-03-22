import type { FastifyInstance } from 'fastify';
import type { NexusConfig, HealthResponse } from '../types/index.js';
import { ProviderManager } from '../providers/index.js';
import { SkillManager } from '../skills/index.js';
import {
  getMemoryStats,
  getMemories,
  deleteMemory,
  deleteMemoriesByCategory,
  insertMemory,
  searchMemoriesByText,
  getAllStructuredMemory,
  getStructuredMemory,
  setStructuredMemory,
  deleteStructuredMemory,
  getConversations,
  getRecentConversations,
  insertConversation,
  getActivities,
  getToolCalls,
  consolidateMemories,
} from '../memory/database.js';
import { getConnectedClientsCount, broadcastToClients } from './websocket.js';
import { randomUUID } from 'crypto';

const startTime = Date.now();

export function setupRoutes(
  app: FastifyInstance,
  config: NexusConfig,
  providerManager: ProviderManager,
  skillManager: SkillManager,
): void {
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
      version: '0.1.0',
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

    if (body.stream) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const id = `chatcmpl-${randomUUID()}`;
      try {
        for await (const chunk of providerManager.chat(messages, {
          model: body.model,
          max_tokens: body.max_tokens,
          temperature: body.temperature,
        })) {
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
        const content = await providerManager.chatComplete(messages, {
          model: body.model,
          max_tokens: body.max_tokens,
          temperature: body.temperature,
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
        { id: config.provider.primary, object: 'model', owned_by: 'nexus' },
        { id: config.provider.fallback, object: 'model', owned_by: 'nexus' },
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
    };
    const id = insertMemory({
      content: body.content,
      embedding: null,
      category: (body.category ?? 'fact') as 'fact',
      source: (body.source ?? 'manual') as 'manual',
      confidence: body.confidence ?? 1.0,
      tags: body.tags ?? [],
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
    return skillManager.getAllSkills().map(s => ({
      name: s.config.name,
      description: s.config.description,
      enabled: s.config.enabled,
      triggers: s.config.triggers,
      tools: s.config.tools,
      filePath: s.filePath,
      lastRun: s.lastRun,
    }));
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
    const masked = JSON.parse(JSON.stringify(config)) as NexusConfig;
    for (const key of Object.keys(masked.provider.apiKeys)) {
      const val = masked.provider.apiKeys[key];
      if (val && !val.startsWith('http')) {
        masked.provider.apiKeys[key] = val.slice(0, 8) + '****';
      }
    }
    return masked;
  });

  app.put('/api/config', async (request) => {
    const body = request.body as Partial<NexusConfig>;
    Object.assign(config, body);
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
}
