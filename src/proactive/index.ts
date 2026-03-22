import type { NexusConfig } from '../types/index.js';
import { ProviderManager } from '../providers/index.js';
import {
  getRecentConversations,
  getAllStructuredMemory,
  insertConversation,
  insertActivity,
} from '../memory/database.js';

export interface ProactiveConfig {
  enabled: boolean;
  intervalMs: number;       // default 4 hours
  confidenceThreshold: number; // default 0.75
  maxPerDay: number;        // default 3
  preferredChannel: string; // default 'web'
}

const DEFAULT_PROACTIVE_CONFIG: ProactiveConfig = {
  enabled: true,
  intervalMs: 4 * 60 * 60 * 1000, // 4 hours
  confidenceThreshold: 0.75,
  maxPerDay: 3,
  preferredChannel: 'web',
};

export class ProactiveWorker {
  private config: ProactiveConfig;
  private providerManager: ProviderManager;
  private timer: ReturnType<typeof setInterval> | null = null;
  private messagesToday = 0;
  private lastResetDate = '';
  private onMessage: ((message: string, channel: string) => void) | null = null;

  constructor(providerManager: ProviderManager, config?: Partial<ProactiveConfig>) {
    this.config = { ...DEFAULT_PROACTIVE_CONFIG, ...config };
    this.providerManager = providerManager;
  }

  setMessageHandler(handler: (message: string, channel: string) => void): void {
    this.onMessage = handler;
  }

  start(): void {
    if (!this.config.enabled) {
      console.log('Proactive intelligence disabled');
      return;
    }

    console.log(`Proactive worker starting (interval: ${this.config.intervalMs}ms)`);
    this.timer = setInterval(() => {
      this.tick().catch(err => console.error('Proactive worker error:', err));
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private resetDailyCounter(): void {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      this.messagesToday = 0;
      this.lastResetDate = today;
    }
  }

  async tick(): Promise<void> {
    this.resetDailyCounter();

    if (this.messagesToday >= this.config.maxPerDay) {
      console.log('Proactive: daily message limit reached');
      return;
    }

    try {
      const recentConversations = getRecentConversations(20);
      const structuredMemory = getAllStructuredMemory();

      if (recentConversations.length === 0 && structuredMemory.length === 0) {
        return; // Nothing to reason about
      }

      const conversationSummary = recentConversations
        .map(c => `[${c.role}] ${c.content.slice(0, 200)}`)
        .join('\n');

      const memorySummary = structuredMemory
        .slice(0, 20)
        .map(m => `${m.key}: ${m.value}`)
        .join('\n');

      const prompt = `You are a proactive personal AI assistant. Review the user's recent conversations and memory to determine if there's something worth proactively bringing to their attention.

Recent conversations:
${conversationSummary}

Structured memory:
${memorySummary}

Rules:
- Only send a message if you have HIGH confidence it would be useful
- Look for: upcoming deadlines, forgotten tasks, patterns suggesting automation, useful insights
- Rate your confidence from 0 to 1
- If confidence < ${this.config.confidenceThreshold}, respond with just: {"send": false}
- If you have something worth saying, respond with: {"send": true, "confidence": 0.X, "message": "your message"}
- Keep messages under 200 words. Be warm and direct.
- Do NOT repeat information the user already knows unless it's time-sensitive`;

      const response = await this.providerManager.chatComplete([
        { role: 'system', content: prompt },
        { role: 'user', content: 'Analyze and decide if a proactive message is warranted.' },
      ]);

      const parsed = this.parseProactiveResponse(response);
      if (!parsed.send || parsed.confidence < this.config.confidenceThreshold) {
        return;
      }

      // Send the proactive message
      this.messagesToday++;
      const message = parsed.message;

      insertConversation({
        session_id: 'proactive',
        role: 'assistant',
        content: message,
        provider: this.providerManager.getPrimaryName(),
        model: '',
        tokens_used: 0,
        latency_ms: 0,
        timestamp: Date.now(),
        channel: this.config.preferredChannel as 'web',
      });

      insertActivity({
        type: 'proactive',
        summary: `Proactive insight (confidence: ${parsed.confidence})`,
        details: message,
        timestamp: Date.now(),
      });

      this.onMessage?.(message, this.config.preferredChannel);
      console.log(`Proactive message sent (confidence: ${parsed.confidence})`);
    } catch (error) {
      console.error('Proactive worker tick error:', error);
    }
  }

  private parseProactiveResponse(response: string): { send: boolean; confidence: number; message: string } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { send?: boolean; confidence?: number; message?: string };
        return {
          send: parsed.send ?? false,
          confidence: parsed.confidence ?? 0,
          message: parsed.message ?? '',
        };
      }
    } catch {
      // Failed to parse
    }
    return { send: false, confidence: 0, message: '' };
  }

  getStatus(): { enabled: boolean; messagesToday: number; maxPerDay: number; intervalMs: number } {
    return {
      enabled: this.config.enabled,
      messagesToday: this.messagesToday,
      maxPerDay: this.config.maxPerDay,
      intervalMs: this.config.intervalMs,
    };
  }
}
