export interface NexusConfig {
  provider: ProviderConfig;
  gateway: GatewayConfig;
  memory: MemoryConfig;
  channels: ChannelsConfig;
  skills: string[];
  cron: CronEntry[];
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
  | 'activity'
  | 'proactive'
  | 'ping'
  | 'pong';

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
