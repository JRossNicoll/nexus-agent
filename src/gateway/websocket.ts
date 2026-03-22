import type { FastifyInstance } from 'fastify';
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
  getFirstMessageFlag,
  setFirstMessageFlag,
  getAllStructuredMemory,
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

  // Helper to send trace steps
  const trace = (step: string, status: 'active' | 'done' | 'error') => {
    sendToClient(client, {
      type: 'execution-trace',
      id: sessionId,
      payload: { step, status },
      timestamp: Date.now(),
    });
  };

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

  // Helper to emit tool-call events with typed icons
  const emitToolCall = (tool: string, input: Record<string, unknown> = {}) => {
    sendToClient(client, {
      type: 'tool-call',
      payload: { tool, input },
      timestamp: Date.now(),
    });
    broadcastToClients({
      type: 'tool-call',
      payload: { tool, input },
      timestamp: Date.now(),
    });
  };

  // Dynamic trace: understanding the message
  trace('Understanding your message...', 'active');

  // Check for slash commands
  if (request.message.startsWith('/')) {
    const skillName = request.message.slice(1).split(' ')[0];
    const skill = skillManager.getSkill(skillName);
    if (skill) {
      trace(`Running skill: ${skillName}`, 'active');
      sendToClient(client, {
        type: 'tool-call',
        payload: { tool: 'skill_run', input: { name: skillName } },
        timestamp: Date.now(),
      });
    }
  }

  // Check for keyword-triggered skills
  const matchedSkills = skillManager.getSkillsByKeyword(request.message);
  if (matchedSkills.length > 0) {
    trace(`Matched ${matchedSkills.length} skill${matchedSkills.length > 1 ? 's' : ''}: ${matchedSkills.map(s => s.config.name).join(', ')}`, 'active');
  }

  trace('Understanding your message...', 'done');

  // Retrieve relevant memories for context
  trace('Searching your memories...', 'active');
  emitToolCall('memory_read', { query: request.message });
  const relevantMemories = searchMemoriesByText(request.message, 10);

  // Reinforce and pulse memories that are being used
  const usedMemoryIds: string[] = [];
  if (relevantMemories.length > 0) {
    trace(`Found ${relevantMemories.length} relevant memories`, 'done');

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
  } else {
    trace('No matching memories found', 'done');
  }

  // Build system prompt
  let systemPrompt = `You are Medo, a personal AI assistant. You are knowledgeable, helpful, and proactive.

RESPONSE FORMATTING RULES — follow these exactly:

- Write in natural conversational prose. You are a personal assistant having a conversation, not writing a document or report.
- Never use headers (##, ###) in conversational responses. Headers are only appropriate if the user explicitly asks for a document, report, or structured output.
- Use bold (**text**) sparingly — only for genuinely critical information, not for general emphasis. Maximum one or two instances per response.
- Use bullet points only when listing 3 or more genuinely enumerable items. Never use bullets for 1-2 items — write them as a sentence instead.
- Keep responses concise. If you can say it in 2 sentences, do not write 4. Match the length of your response to the complexity of the question — a simple question gets a short answer.
- Never start a response with "Certainly!", "Of course!", "Great question!", "Absolutely!" or any similar filler affirmation. Start directly with the substance of your response.
- When referencing something from memory, weave it naturally into the sentence rather than calling it out explicitly as a memory retrieval.
- Numbers and lists of steps should use numbered lists. Everything else should be prose.`;

  // First-message experience: inject onboarding context into the system prompt
  const isFirstMessage = (request as any).first_message === true || getFirstMessageFlag();
  if (isFirstMessage) {
    const structured = getAllStructuredMemory();
    const userName = structured.find(s => s.key === 'user.name')?.value;
    const userWork = structured.find(s => s.key === 'user.work')?.value;
    const userGoals = structured.find(s => s.key === 'user.goals')?.value;
    const userGoodDay = structured.find(s => s.key === 'user.goodDay')?.value;
    systemPrompt += `\n\nIMPORTANT — This is the user's FIRST message after completing onboarding. You must:
1. Answer their question thoroughly
2. Weave in specific details from what they shared during onboarding — NOT as a list, naturally woven into the response
3. End with one proactive observation that makes the user feel understood

Here is what they told you during onboarding:
- Name: ${userName || 'unknown'}
- Work: ${userWork || 'not shared'}
- Goals: ${userGoals || 'not shared'}
- What a good day looks like: ${userGoodDay || 'not shared'}

Reference these details naturally in your response. Do NOT just repeat them back as a list.`;

    // Clear the flag after injecting
    setFirstMessageFlag(false);
  }

  if (relevantMemories.length > 0) {
    systemPrompt += `\n\nRelevant memories:\n${relevantMemories.map(m => `- ${m.content}`).join('\n')}`;
  }

  if (matchedSkills.length > 0) {
    systemPrompt += `\n\nActive skills:\n${matchedSkills.map(s => `- ${s.config.name}: ${s.content}`).join('\n')}`;
  }

  // Get recent conversation context
  trace('Loading conversation history...', 'active');
  const recentMessages = getRecentConversations(10)
    .reverse()
    .map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));
  trace('Loading conversation history...', 'done');

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...recentMessages,
    { role: 'user' as const, content: request.message },
  ];

  // Send execution trace: calling LLM
  const providerName = config.provider.primary.split('/')[0] || config.provider.primary;
  trace(`Thinking with ${providerName}...`, 'active');

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
    trace(`Response ready (${(latency / 1000).toFixed(1)}s)`, 'done');

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
