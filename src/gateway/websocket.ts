import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { WSMessage, ChatRequest, NexusConfig } from '../types/index.js';
import { ProviderManager } from '../providers/index.js';
import { SkillManager } from '../skills/index.js';
import {
  insertConversation,
  insertMemory,
  insertActivity,
  searchMemoriesByText,
  getRecentConversations,
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
  config: NexusConfig,
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
  config: NexusConfig,
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
            version: '0.1.0',
            provider: config.provider.primary,
            features: ['chat', 'memory', 'skills', 'proactive', 'tools'],
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
  config: NexusConfig,
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
  const relevantMemories = searchMemoriesByText(request.message, 10);

  // Build system prompt
  let systemPrompt = `You are Nexus, a personal AI assistant. You are knowledgeable, helpful, and proactive.`;

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
