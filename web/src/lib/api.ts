const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:18799';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:18799/ws';

export async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function getWebSocketURL(): string {
  return WS_URL;
}

export function getGatewayURL(): string {
  return GATEWAY_URL;
}

// Memory API
export const memoryAPI = {
  getMemories: (params?: { limit?: number; offset?: number; category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.category) qs.set('category', params.category);
    return fetchAPI<SemanticMemory[]>(`/api/memories?${qs}`);
  },
  searchMemories: (query: string, limit = 10) =>
    fetchAPI<SemanticMemory[]>(`/api/memories/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  createMemory: (data: { content: string; category?: string; tags?: string[] }) =>
    fetchAPI<{ id: string }>('/api/memories', { method: 'POST', body: JSON.stringify(data) }),
  deleteMemory: (id: string) =>
    fetchAPI<{ deleted: boolean }>(`/api/memories/${id}`, { method: 'DELETE' }),
  updateMemory: (id: string, data: { content?: string; category?: string; confidence?: number; tags?: string[] }) =>
    fetchAPI<{ updated: boolean }>('/api/memories/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  consolidate: () =>
    fetchAPI<{ merged: number; flagged: number }>('/api/memories/consolidate', { method: 'POST' }),
  getGraph: (params?: { before?: number; cluster?: string }) => {
    const qs = new URLSearchParams();
    if (params?.before) qs.set('before', String(params.before));
    if (params?.cluster) qs.set('cluster', params.cluster);
    return fetchAPI<MemoryGraphDataWithClusters>(`/api/memories/graph?${qs}`);
  },
  getHealth: () => fetchAPI<MemoryHealth>('/api/memories/health'),
  getTimeline: (before: number, limit = 200) =>
    fetchAPI<SemanticMemory[]>(`/api/memories/timeline?before=${before}&limit=${limit}`),
  reinforce: (id: string) =>
    fetchAPI<{ reinforced: boolean }>(`/api/memories/${id}/reinforce`, { method: 'POST' }),
};

export const structuredAPI = {
  getAll: (category?: string) => {
    const qs = category ? `?category=${category}` : '';
    return fetchAPI<StructuredMemory[]>(`/api/structured${qs}`);
  },
  get: (key: string) => fetchAPI<StructuredMemory>(`/api/structured/${encodeURIComponent(key)}`),
  set: (key: string, data: { value: string; type?: string; category?: string }) =>
    fetchAPI<{ updated: boolean }>(`/api/structured/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (key: string) =>
    fetchAPI<{ deleted: boolean }>(`/api/structured/${encodeURIComponent(key)}`, { method: 'DELETE' }),
};

export const conversationAPI = {
  getRecent: (limit = 50) => fetchAPI<ConversationMessage[]>(`/api/conversations/recent?limit=${limit}`),
  getBySession: (sessionId: string) =>
    fetchAPI<ConversationMessage[]>(`/api/conversations?session_id=${sessionId}`),
};

export const activityAPI = {
  getAll: (params?: { limit?: number; offset?: number; type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.type) qs.set('type', params.type);
    return fetchAPI<ActivityEntry[]>(`/api/activities?${qs}`);
  },
};

export const skillsAPI = {
  getAll: () => fetchAPI<SkillInfo[]>('/api/skills'),
  create: (data: { name: string; content: string; description?: string; triggers?: SkillTrigger[]; tools?: string[] }) =>
    fetchAPI<{ created: boolean }>('/api/skills', { method: 'POST', body: JSON.stringify(data) }),
  update: (name: string, content: string) =>
    fetchAPI<{ updated: boolean }>(`/api/skills/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  delete: (name: string) =>
    fetchAPI<{ deleted: boolean }>(`/api/skills/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  toggle: (name: string, enabled: boolean) =>
    fetchAPI<{ updated: boolean }>(`/api/skills/${encodeURIComponent(name)}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
  generate: (description: string) =>
    fetchAPI<{ success: boolean; generatedSkill?: string; error?: string }>('/api/skills/generate', {
      method: 'POST',
      body: JSON.stringify({ description }),
    }),
  run: (name: string) =>
    fetchAPI<{ success: boolean; output?: string; error?: string }>(`/api/skills/${encodeURIComponent(name)}/run`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getExecutions: (name: string) =>
    fetchAPI<SkillExecution[]>(`/api/skills/${encodeURIComponent(name)}/executions`),
  getSuggestions: () =>
    fetchAPI<{ suggestions: SkillSuggestion[] }>('/api/skills/suggestions'),
};

export const configAPI = {
  get: () => fetchAPI<NexusConfig>('/api/config'),
  update: (data: Partial<NexusConfig>) =>
    fetchAPI<{ updated: boolean }>('/api/config', { method: 'PUT', body: JSON.stringify(data) }),
};

export const healthAPI = {
  get: () => fetchAPI<HealthResponse>('/health'),
};


export const authAPI = {
  setup: (pin: string) =>
    fetchAPI<{ success: boolean }>('/api/auth/setup', { method: 'POST', body: JSON.stringify({ pin }) }),
  verify: (pin: string) =>
    fetchAPI<{ authenticated: boolean; noAuthRequired?: boolean }>('/api/auth/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
};

export const providerAPI = {
  test: (provider?: string) =>
    fetchAPI<{ success: boolean; response?: string; error?: string; provider?: string }>('/api/providers/test', { method: 'POST', body: JSON.stringify({ provider }) }),
  testKey: (provider: string, apiKey: string) =>
    fetchAPI<{ success: boolean; response?: string; error?: string; provider?: string }>('/api/providers/test-key', { method: 'POST', body: JSON.stringify({ provider, apiKey }) }),
};

export const onboardingAPI = {
  getStatus: () =>
    fetchAPI<{ completed: boolean; userName?: string; completedAt?: number }>('/api/onboarding/status'),
  complete: (data: {
    userName: string;
    provider?: { primary: string; apiKey: string; keyName: string };
    channels?: { telegram?: { botToken: string } };
    aboutYou?: { work?: string; goals?: string; goodDay?: string };
  }) =>
    fetchAPI<{ success: boolean }>('/api/onboarding/complete', { method: 'POST', body: JSON.stringify(data) }),
  getWelcome: () =>
    fetchAPI<{ message: string }>('/api/onboarding/welcome'),
};

export const proactiveAPI = {
  getStatus: () =>
    fetchAPI<ProactiveStatus>('/api/proactive/status'),
};
// Types
export interface SemanticMemory {
  id: string;
  content: string;
  category: string;
  source: string;
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
  type: string;
  category: string;
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
  channel: string;
}

export interface ActivityEntry {
  id: string;
  type: string;
  summary: string;
  details: string;
  timestamp: number;
  session_id?: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  enabled: boolean;
  triggers: SkillTrigger[];
  tools: string[];
  filePath: string;
  lastRun?: number;
  executions?: SkillExecution[];
  hasNeverRun?: boolean;
}

export interface SkillExecution {
  id: string;
  skill_name: string;
  triggered_by: string;
  success: boolean;
  output: string;
  error?: string;
  duration_ms: number;
  timestamp: number;
}

export interface SkillSuggestion {
  title: string;
  description: string;
  skillDescription: string;
}

export interface SkillTrigger {
  cron?: string;
  keyword?: string;
}

export interface NexusConfig {
  provider: {
    primary: string;
    fallback: string;
    apiKeys: Record<string, string>;
  };
  gateway: {
    port: number;
    auth: { token: string };
  };
  memory: {
    embeddingModel: string;
    vectorStore: string;
  };
  channels: Record<string, unknown>;
  skills: string[];
  cron: unknown[];
  proactive?: ProactiveSettings;
}

export interface HealthResponse {
  status: string;
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

export interface ProactiveSettings {
  enabled: boolean;
  intervalHours: number;
  confidenceThreshold: number;
  maxPerDay: number;
  patternDetection: boolean;
  dailyBriefing: boolean;
  smartReminders: boolean;
  briefingTime: string;
}

export interface ProactiveStatus {
  enabled: boolean;
  patternDetection: boolean;
  dailyBriefing: boolean;
  smartReminders: boolean;
  lastPatternRun?: number;
  lastBriefing?: number;
  todayMessageCount: number;
}

export interface MemoryGraphData {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
}

export interface MemoryGraphDataWithClusters extends MemoryGraphData {
  clusters?: MemoryCluster[];
}

export interface MemoryCluster {
  id: string;
  label: string;
  nodeIds: string[];
  color: string;
}

export interface MemoryHealth {
  totalMemories: number;
  addedThisWeek: number;
  oldestMemory: number | null;
  mostReferenced: { id: string; content: string; access_count: number } | null;
  staleMemories: number;
  totalConversations: number;
  totalStructured: number;
}

export interface MemoryGraphNode {
  id: string;
  content: string;
  category: string;
  confidence: number;
  source: string;
  created_at: number;
  last_accessed: number;
  access_count: number;
  channel?: string;
  conversation_id?: string;
  tags?: string[];
}

export interface MemoryGraphEdge {
  source: string;
  target: string;
  weight: number;
}
