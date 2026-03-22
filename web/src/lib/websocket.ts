'use client';

import { getWebSocketURL } from './api';

export interface WSMessage {
  type: string;
  id?: string;
  payload?: unknown;
  timestamp?: number;
}

type MessageHandler = (message: WSMessage) => void;

class NexusWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private reconnectAttempt = 0;
  private maxBackoff = 8000;

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(getWebSocketURL());

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempt = 0;
        this.send({ type: 'connect', payload: {} });
        this.emit('connected', { type: 'connected' });
        this.emit('reconnected', { type: 'reconnected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          this.emit(message.type, message);
          this.emit('*', message);
        } catch {
          // silently ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('disconnected', { type: 'disconnected' });
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.connected = false;
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendChat(content: string, sessionId?: string, model?: string): void {
    this.send({
      type: 'chat',
      payload: {
        message: content,
        session_id: sessionId,
        model,
        channel: 'web',
      },
    });
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  private emit(type: string, message: WSMessage): void {
    this.handlers.get(type)?.forEach(handler => handler(message));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    // Exponential backoff: 1s, 2s, 4s, 8s max
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxBackoff);
    this.reconnectAttempt++;
    this.emit('reconnecting', { type: 'reconnecting', payload: { attempt: this.reconnectAttempt, delay } });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export const nexusWS = new NexusWebSocket();
