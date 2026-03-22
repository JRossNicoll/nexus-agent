import type { NexusConfig } from '../types/index.js';
import { insertActivity } from '../memory/database.js';

/**
 * WhatsApp channel using Baileys (WhatsApp Web protocol).
 * This is a placeholder implementation — Baileys requires session management
 * and QR code pairing which is handled through the web UI.
 */
export class WhatsAppChannel {
  private config: NexusConfig;
  private connected = false;
  private onMessage: ((content: string, channel: string, respond: (text: string) => Promise<void>) => Promise<void>) | null = null;

  constructor(config: NexusConfig) {
    this.config = config;
  }

  setMessageHandler(handler: (content: string, channel: string, respond: (text: string) => Promise<void>) => Promise<void>): void {
    this.onMessage = handler;
  }

  async start(): Promise<void> {
    const waConfig = this.config.channels.whatsapp;
    if (!waConfig?.enabled) {
      console.log('WhatsApp channel not configured or disabled');
      return;
    }

    // WhatsApp connection would be initialized here with Baileys
    // QR code pairing happens through the web UI
    console.log('WhatsApp channel initialized (awaiting QR pairing via UI)');

    insertActivity({
      type: 'channel_message',
      summary: 'WhatsApp channel initialized',
      details: 'Awaiting QR code pairing through web UI',
      timestamp: Date.now(),
    });
  }

  async stop(): Promise<void> {
    this.connected = false;
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.connected) {
      console.warn('WhatsApp not connected');
      return;
    }
    // Message sending would be implemented with Baileys socket
    console.log(`WhatsApp message to ${jid}: ${text.slice(0, 100)}`);
  }

  isRunning(): boolean {
    return this.connected;
  }

  getQRCode(): string | null {
    // Would return current QR code for pairing
    return null;
  }
}
