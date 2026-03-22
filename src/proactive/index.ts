import type { ProactiveSettingsConfig } from '../types/index.js';
import { ProviderManager } from '../providers/index.js';
import {
  getRecentConversations,
  getAllStructuredMemory,
  getPendingTasks,
  markTaskFollowedUp,
  insertConversation,
  insertActivity,
  insertPendingTask,
  getMemories,
  getActivityTimestamps,
  getPreferredContactWindow,
  setPreferredContactWindow,
  getLastProactiveSent,
  setLastProactiveSent,
} from '../memory/database.js';

export interface ProactiveConfig {
  enabled: boolean;
  intervalMs: number;
  confidenceThreshold: number;
  maxPerDay: number;
  preferredChannel: string;
  patternDetection: boolean;
  dailyBriefing: boolean;
  smartReminders: boolean;
  briefingTime: string;
}

const DEFAULT_PROACTIVE_CONFIG: ProactiveConfig = {
  enabled: true,
  intervalMs: 6 * 60 * 60 * 1000,
  confidenceThreshold: 0.75,
  maxPerDay: 3,
  preferredChannel: 'web',
  patternDetection: true,
  dailyBriefing: true,
  smartReminders: true,
  briefingTime: '07:00',
};

/**
 * Quality gate: checks that a proactive message references at least one memory's actual content.
 * Returns true if the message contains a direct reference to at least one memory's content.
 */
export function passesQualityGate(message: string, memories: Array<{ content: string }>): boolean {
  if (!message || memories.length === 0) return false;
  const msgLower = message.toLowerCase();

  for (const mem of memories) {
    // Extract meaningful phrases from the memory (at least 4 words long)
    const words = mem.content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    // Check if at least 3 significant words from the memory appear in the message
    let matchCount = 0;
    for (const word of words) {
      if (msgLower.includes(word)) matchCount++;
    }
    // A memory is "referenced" if 3+ significant words appear, or if a substantial substring matches
    if (matchCount >= 3) return true;

    // Also check for longer phrase matches (6+ char substrings)
    const phrases = mem.content.split(/[.!?;,]/).map(p => p.trim().toLowerCase()).filter(p => p.length > 15);
    for (const phrase of phrases) {
      if (msgLower.includes(phrase)) return true;
    }
  }
  return false;
}

/**
 * Calculate the user's most active 2-hour window from activity timestamps.
 */
function calculatePreferredWindow(timestamps: number[]): { startHour: number; endHour: number } {
  // Count activity per hour over the past 14 days
  const hourCounts = new Array(24).fill(0);
  for (const ts of timestamps) {
    const hour = new Date(ts).getHours();
    hourCounts[hour]++;
  }

  // Find the 2-hour block with most activity
  let bestStart = 9; // default: 9-11
  let bestCount = 0;
  for (let h = 0; h < 24; h++) {
    const count = hourCounts[h] + hourCounts[(h + 1) % 24];
    if (count > bestCount) {
      bestCount = count;
      bestStart = h;
    }
  }

  return { startHour: bestStart, endHour: (bestStart + 2) % 24 };
}

/**
 * Check if the current time is within the preferred contact window.
 */
function isInContactWindow(): boolean {
  const window = getPreferredContactWindow();
  if (!window) return true; // No window set, allow any time
  const currentHour = new Date().getHours();
  if (window.startHour <= window.endHour) {
    return currentHour >= window.startHour && currentHour < window.endHour;
  }
  // Wraps around midnight
  return currentHour >= window.startHour || currentHour < window.endHour;
}

/**
 * Check if enough time has passed since the last proactive message (2 hours minimum).
 */
function canSendTimingCheck(): boolean {
  const lastSent = getLastProactiveSent();
  const twoHours = 2 * 60 * 60 * 1000;
  return (Date.now() - lastSent) >= twoHours;
}

export class ProactiveWorker {
  private config: ProactiveConfig;
  private providerManager: ProviderManager;
  private patternTimer: ReturnType<typeof setInterval> | null = null;
  private briefingTimer: ReturnType<typeof setInterval> | null = null;
  private reminderTimer: ReturnType<typeof setInterval> | null = null;
  private windowTimer: ReturnType<typeof setInterval> | null = null;
  private messagesToday = 0;
  private lastResetDate = '';
  private lastPatternCheck = 0;
  private lastBriefingSent = '';
  private onMessage: ((message: string, channel: string) => void) | null = null;

  constructor(providerManager: ProviderManager, config?: Partial<ProactiveConfig>) {
    this.config = { ...DEFAULT_PROACTIVE_CONFIG, ...config };
    this.providerManager = providerManager;
  }

  static fromSettings(providerManager: ProviderManager, settings?: ProactiveSettingsConfig): ProactiveWorker {
    const config: Partial<ProactiveConfig> = {};
    if (settings) {
      config.enabled = settings.enabled;
      config.intervalMs = settings.intervalHours * 60 * 60 * 1000;
      config.confidenceThreshold = settings.confidenceThreshold;
      config.maxPerDay = settings.maxPerDay;
      config.patternDetection = settings.patternDetection;
      config.dailyBriefing = settings.dailyBriefing;
      config.smartReminders = settings.smartReminders;
      if (settings.briefingTime) config.briefingTime = settings.briefingTime;
    }
    return new ProactiveWorker(providerManager, config);
  }

  setMessageHandler(handler: (message: string, channel: string) => void): void {
    this.onMessage = handler;
  }

  start(): void {
    if (!this.config.enabled) {
      console.log('Proactive intelligence disabled');
      return;
    }
    console.log('Proactive worker starting (pattern: ' + this.config.intervalMs + 'ms, briefing: ' + this.config.briefingTime + ')');

    // Recalculate preferred contact window every hour
    this.updateContactWindow();
    this.windowTimer = setInterval(() => this.updateContactWindow(), 60 * 60 * 1000);

    if (this.config.patternDetection) {
      this.patternTimer = setInterval(() => {
        this.runPatternDetection().catch(err => console.error('Pattern detection error:', err));
      }, this.config.intervalMs);
    }

    if (this.config.dailyBriefing) {
      this.briefingTimer = setInterval(() => {
        this.checkBriefingTime().catch(err => console.error('Briefing error:', err));
      }, 60 * 1000);
    }

    if (this.config.smartReminders) {
      this.reminderTimer = setInterval(() => {
        this.checkReminders().catch(err => console.error('Reminder error:', err));
      }, 2 * 60 * 60 * 1000);
    }
  }

  stop(): void {
    if (this.patternTimer) { clearInterval(this.patternTimer); this.patternTimer = null; }
    if (this.briefingTimer) { clearInterval(this.briefingTimer); this.briefingTimer = null; }
    if (this.reminderTimer) { clearInterval(this.reminderTimer); this.reminderTimer = null; }
    if (this.windowTimer) { clearInterval(this.windowTimer); this.windowTimer = null; }
  }

  private updateContactWindow(): void {
    try {
      const timestamps = getActivityTimestamps(14);
      if (timestamps.length >= 5) {
        const window = calculatePreferredWindow(timestamps);
        setPreferredContactWindow(window.startHour, window.endHour);
      }
    } catch (err) {
      console.error('Failed to update contact window:', err);
    }
  }

  private resetDailyCounter(): void {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      this.messagesToday = 0;
      this.lastResetDate = today;
    }
  }

  private canSendMessage(): boolean {
    // MEDO_FORCE_PROACTIVE=true bypasses all timing checks (testing only)
    if (process.env.MEDO_FORCE_PROACTIVE === 'true') return true;
    this.resetDailyCounter();
    if (this.messagesToday >= this.config.maxPerDay) return false;
    if (!canSendTimingCheck()) return false;
    if (!isInContactWindow()) return false;
    return true;
  }

  async runPatternDetection(): Promise<void> {
    if (!this.canSendMessage()) return;
    const now = Date.now();
    if (now - this.lastPatternCheck < this.config.intervalMs * 0.9) return;
    this.lastPatternCheck = now;

    try {
      const recentConversations = getRecentConversations(30);
      const structuredMemory = getAllStructuredMemory();
      const memories = getMemories(50);
      if (recentConversations.length < 3) return;

      const conversationSummary = recentConversations
        .map(c => '[' + c.role + '/' + c.channel + '] ' + c.content.slice(0, 200))
        .join('\n');
      const memorySummary = structuredMemory
        .slice(0, 20)
        .map(m => m.key + ': ' + m.value)
        .join('\n');
      const memoryContents = memories.slice(0, 30)
        .map(m => '- ' + m.content.slice(0, 150))
        .join('\n');

      // Quality gate: up to 3 attempts
      for (let attempt = 1; attempt <= 3; attempt++) {
        const prompt = 'You are a proactive personal AI assistant analyzing patterns.\n\n'
          + 'Recent conversations (last 30):\n' + conversationSummary + '\n\n'
          + 'Structured memory:\n' + memorySummary + '\n\n'
          + 'Available memories:\n' + memoryContents + '\n\n'
          + 'Identify patterns or insights the user has not asked about. Examples:\n'
          + '- "You\'ve mentioned feeling tired 4 times this week"\n'
          + '- "You have 3 tasks you said you\'d do that haven\'t been mentioned since"\n\n'
          + 'Rules:\n'
          + '- CRITICAL: You MUST reference a specific memory by its actual content — not a generic observation\n'
          + '- Include direct quotes or specific details from the memories listed above\n'
          + '- Only surface genuinely useful, non-obvious patterns\n'
          + '- Rate confidence 0-1\n'
          + '- If confidence < ' + this.config.confidenceThreshold + ': {"send": false}\n'
          + '- If worth saying: {"send": true, "confidence": 0.X, "message": "your message"}\n'
          + '- Under 200 words. Warm and direct.'
          + (attempt > 1 ? '\n\nPREVIOUS ATTEMPT REJECTED: Your message was too generic. You MUST quote or directly reference specific content from the memories listed above. Be concrete and specific.' : '');

        const response = await this.providerManager.chatComplete([
          { role: 'system', content: prompt },
          { role: 'user', content: 'Analyze recent patterns.' },
        ]);

        const parsed = this.parseProactiveResponse(response);
        if (parsed.send && parsed.confidence >= this.config.confidenceThreshold) {
          // Quality gate check
          if (passesQualityGate(parsed.message, memories)) {
            await this.sendProactiveMessage(parsed.message, parsed.confidence, 'pattern_detection');
            return;
          }
          console.log(`Proactive quality gate failed (attempt ${attempt}/3): message too generic`);
          insertActivity({
            type: 'proactive',
            summary: `Quality gate rejected (attempt ${attempt}/3)`,
            details: parsed.message.slice(0, 200),
            timestamp: Date.now(),
          });
        } else {
          // LLM said don't send, respect that
          return;
        }
      }

      // All 3 attempts failed quality gate — suppress entirely
      console.log('Proactive message suppressed: all 3 attempts failed quality gate');
      insertActivity({
        type: 'proactive',
        summary: 'Message suppressed: failed quality gate 3 times',
        details: 'All attempts were too generic to send',
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Pattern detection error:', error);
    }
  }

  private async checkBriefingTime(): Promise<void> {
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const today = now.toISOString().split('T')[0];
    if (timeStr !== this.config.briefingTime || this.lastBriefingSent === today) return;
    if (!this.canSendMessage()) return;
    this.lastBriefingSent = today;

    try {
      const recentConversations = getRecentConversations(20);
      const structuredMemory = getAllStructuredMemory();
      const pendingTasks = getPendingTasks();

      const conversationSummary = recentConversations
        .slice(0, 10).map(c => '[' + c.role + '] ' + c.content.slice(0, 150)).join('\n');
      const memorySummary = structuredMemory
        .filter(m => m.category === 'goals' || m.category === 'preferences')
        .slice(0, 10).map(m => m.key + ': ' + m.value).join('\n');
      const tasksSummary = pendingTasks
        .map(t => '- ' + t.description + ' (mentioned ' + new Date(t.mentioned_at).toLocaleDateString() + ')')
        .join('\n');

      const prompt = 'You are a thoughtful AI assistant delivering a morning briefing. Be warm.\n\n'
        + 'Recent conversations:\n' + (conversationSummary || '(none)') + '\n\n'
        + 'User goals/preferences:\n' + (memorySummary || '(none stored)') + '\n\n'
        + 'Outstanding tasks:\n' + (tasksSummary || '(no pending tasks)') + '\n\n'
        + 'Create a concise morning briefing (under 200 words):\n'
        + '1. Outstanding tasks needing attention today\n'
        + '2. Patterns worth flagging\n'
        + '3. One useful observation\n\n'
        + 'Start with "Good morning!" and be conversational.\n'
        + 'Respond: {"send": true, "confidence": 0.9, "message": "your briefing"}';

      const response = await this.providerManager.chatComplete([
        { role: 'system', content: prompt },
        { role: 'user', content: "Generate today\'s morning briefing." },
      ]);
      const parsed = this.parseProactiveResponse(response);
      if (parsed.send) {
        await this.sendProactiveMessage(parsed.message, parsed.confidence, 'daily_briefing');
      }
    } catch (error) {
      console.error('Daily briefing error:', error);
    }
  }

  private async checkReminders(): Promise<void> {
    if (!this.canSendMessage()) return;
    try {
      const pendingTasks = getPendingTasks();
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const dueForFollowUp = pendingTasks.filter(t => !t.followed_up && (now - t.mentioned_at) > oneDay);
      if (dueForFollowUp.length === 0) return;

      const recentConversations = getRecentConversations(20);
      const recentText = recentConversations.map(c => c.content.toLowerCase()).join(' ');
      const tasksToRemind: typeof dueForFollowUp = [];
      for (const task of dueForFollowUp) {
        const keywords = task.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const mentioned = keywords.some(kw => recentText.includes(kw));
        if (!mentioned) tasksToRemind.push(task);
      }
      if (tasksToRemind.length === 0) return;

      const taskList = tasksToRemind.slice(0, 3)
        .map(t => '- "' + t.description + '" (mentioned ' + new Date(t.mentioned_at).toLocaleDateString() + ')')
        .join('\n');
      const message = tasksToRemind.length === 1
        ? 'Gentle reminder: you mentioned "' + tasksToRemind[0].description + '" ' + Math.floor((now - tasksToRemind[0].mentioned_at) / oneDay) + ' days ago. Still on your radar?'
        : 'A few things you mentioned that I have not heard back on:\n' + taskList + '\n\nJust checking if these are still relevant!';

      await this.sendProactiveMessage(message, 0.8, 'smart_reminder');
      for (const task of tasksToRemind.slice(0, 3)) { markTaskFollowedUp(task.id); }
    } catch (error) {
      console.error('Smart reminder error:', error);
    }
  }

  extractAndStoreTasks(userMessage: string, sessionId?: string, channel?: string): void {
    const taskPatterns = [
      /i (?:need to|should|have to|must|gotta|ought to|want to)\s+(.+?)(?:\.|$)/gi,
      /remind me to\s+(.+?)(?:\.|$)/gi,
      /don't (?:let me )?forget (?:to )?\s*(.+?)(?:\.|$)/gi,
      /(?:todo|task):\s*(.+?)(?:\.|$)/gi,
    ];
    for (const pattern of taskPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(userMessage)) !== null) {
        const taskDescription = match[1].trim();
        if (taskDescription.length > 5 && taskDescription.length < 200) {
          insertPendingTask(taskDescription, sessionId, channel);
          insertActivity({
            type: 'memory_write',
            summary: 'Task detected: ' + taskDescription.slice(0, 60),
            details: 'Extracted pending task: "' + taskDescription + '"',
            timestamp: Date.now(),
            session_id: sessionId,
          });
        }
      }
    }
  }

  async forceProactive(): Promise<void> {
    const memories = getMemories(50);
    const recentConversations = getRecentConversations(30);
    if (recentConversations.length === 0 && memories.length === 0) {
      await this.sendProactiveMessage('I noticed you haven\'t started any conversations yet. I\'m here whenever you\'re ready to chat!', 0.9, 'forced_test');
      return;
    }
    const memoryContents = memories.slice(0, 10).map(m => '- ' + m.content.slice(0, 150)).join('\n');
    const conversationSummary = recentConversations.slice(0, 5).map(c => '[' + c.role + '] ' + c.content.slice(0, 200)).join('\n');
    try {
      const response = await this.providerManager.chatComplete([
        { role: 'system', content: 'You are a proactive AI assistant. Generate a short, helpful observation based on the user\'s recent activity and memories. Reference specific memory content. Under 100 words.\n\nMemories:\n' + memoryContents + '\n\nRecent conversations:\n' + conversationSummary },
        { role: 'user', content: 'Generate a proactive insight.' },
      ]);
      const parsed = this.parseProactiveResponse(response);
      if (parsed.send && parsed.message) {
        await this.sendProactiveMessage(parsed.message, parsed.confidence || 0.9, 'forced_test');
      } else {
        const firstMem = memories[0]?.content?.slice(0, 100) || 'your recent activity';
        await this.sendProactiveMessage('Based on what I know about ' + firstMem + ', I thought you might find it useful to review your memory graph for patterns.', 0.85, 'forced_test');
      }
    } catch {
      await this.sendProactiveMessage('I\'ve been analyzing your recent conversations and noticed some interesting patterns in your memory graph. Take a look when you get a chance!', 0.8, 'forced_test');
    }
  }

  async tick(): Promise<void> {
    await this.runPatternDetection();
  }

  private async sendProactiveMessage(message: string, confidence: number, source: string): Promise<void> {
    this.messagesToday++;
    setLastProactiveSent(Date.now());
    insertConversation({
      session_id: 'proactive-' + source,
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
      summary: source.replace(/_/g, ' ') + ' (confidence: ' + confidence.toFixed(2) + ')',
      details: message,
      timestamp: Date.now(),
    });
    this.onMessage?.(message, this.config.preferredChannel);
    console.log('Proactive message sent [' + source + '] (confidence: ' + confidence + ')');
  }

  private parseProactiveResponse(response: string): { send: boolean; confidence: number; message: string } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { send?: boolean; confidence?: number; message?: string };
        return { send: parsed.send ?? false, confidence: parsed.confidence ?? 0, message: parsed.message ?? '' };
      }
    } catch { /* Failed to parse */ }
    return { send: false, confidence: 0, message: '' };
  }

  getStatus(): { enabled: boolean; messagesToday: number; maxPerDay: number; intervalMs: number; behaviors: { patternDetection: boolean; dailyBriefing: boolean; smartReminders: boolean }; contactWindow: { startHour: number; endHour: number } | null; lastProactiveSent: number } {
    return {
      enabled: this.config.enabled,
      messagesToday: this.messagesToday,
      maxPerDay: this.config.maxPerDay,
      intervalMs: this.config.intervalMs,
      behaviors: {
        patternDetection: this.config.patternDetection,
        dailyBriefing: this.config.dailyBriefing,
        smartReminders: this.config.smartReminders,
      },
      contactWindow: getPreferredContactWindow(),
      lastProactiveSent: getLastProactiveSent(),
    };
  }

  getConfig(): ProactiveConfig {
    return { ...this.config };
  }
}
