import { Bot } from 'grammy';
import type { NexusConfig } from '../types/index.js';
import { insertConversation, insertActivity } from '../memory/database.js';

export class TelegramChannel {
  private bot: Bot | null = null;
  private config: NexusConfig;
  private onMessage: ((content: string, channel: string, respond: (text: string) => Promise<void>) => Promise<void>) | null = null;

  constructor(config: NexusConfig) {
    this.config = config;
  }

  setMessageHandler(handler: (content: string, channel: string, respond: (text: string) => Promise<void>) => Promise<void>): void {
    this.onMessage = handler;
  }

  async start(): Promise<void> {
    const telegramConfig = this.config.channels.telegram;
    if (!telegramConfig?.enabled || !telegramConfig.botToken) {
      console.log('Telegram channel not configured or disabled');
      return;
    }

    const token = this.resolveEnvVar(telegramConfig.botToken);
    if (!token) {
      console.warn('Telegram bot token not found');
      return;
    }

    this.bot = new Bot(token);

    this.bot.on('message:text', async (ctx) => {
      const text = ctx.message.text;
      const chatId = ctx.chat.id;

      insertActivity({
        type: 'channel_message',
        summary: `Telegram message from chat ${chatId}`,
        details: text.slice(0, 500),
        timestamp: Date.now(),
      });

      if (this.onMessage) {
        await this.onMessage(text, 'telegram', async (response: string) => {
          await ctx.reply(response);
        });
      }
    });

    try {
      this.bot.start();
      console.log('Telegram channel started');
    } catch (error) {
      console.error('Failed to start Telegram bot:', error);
    }
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
    }
  }

  async sendMessage(chatId: string | number, text: string): Promise<void> {
    if (!this.bot) return;
    await this.bot.api.sendMessage(chatId, text);
  }

  isRunning(): boolean {
    return this.bot !== null;
  }

  private resolveEnvVar(value: string): string {
    if (value.startsWith('${') && value.endsWith('}')) {
      const envName = value.slice(2, -1);
      return process.env[envName] ?? '';
    }
    return value;
  }
}
