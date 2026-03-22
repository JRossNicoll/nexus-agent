import type { LLMProvider, LLMMessage, LLMOptions, NexusConfig } from '../types/index.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OpenRouterProvider } from './openrouter.js';
import { OllamaProvider } from './ollama.js';
import { insertActivity } from '../memory/database.js';

export class ProviderManager {
  private primary: LLMProvider | null = null;
  private fallback: LLMProvider | null = null;
  private config: NexusConfig;

  constructor(config: NexusConfig) {
    this.config = config;
    this.initProviders();
  }

  private resolveEnvVar(value: string): string {
    if (value.startsWith('${') && value.endsWith('}')) {
      const envName = value.slice(2, -1);
      return process.env[envName] ?? '';
    }
    return value;
  }

  private initProviders(): void {
    this.primary = this.createProvider(this.config.provider.primary);
    if (this.config.provider.fallback) {
      this.fallback = this.createProvider(this.config.provider.fallback);
    }
  }

  private createProvider(modelSpec: string): LLMProvider | null {
    const [providerName, ...modelParts] = modelSpec.split('/');
    const model = modelParts.join('/');
    const keys = this.config.provider.apiKeys;

    switch (providerName) {
      case 'anthropic': {
        const key = this.resolveEnvVar(keys.anthropic ?? '');
        if (!key) return null;
        return new AnthropicProvider(key, model);
      }
      case 'openai': {
        const key = this.resolveEnvVar(keys.openai ?? '');
        if (!key) return null;
        return new OpenAIProvider(key, model);
      }
      case 'openrouter': {
        const key = this.resolveEnvVar(keys.openrouter ?? '');
        if (!key) return null;
        return new OpenRouterProvider(key, model);
      }
      case 'ollama': {
        const host = keys.ollama ?? 'http://localhost:11434';
        return new OllamaProvider(host, model);
      }
      default:
        console.warn(`Unknown provider: ${providerName}`);
        return null;
    }
  }

  getPrimary(): LLMProvider | null {
    return this.primary;
  }

  getFallback(): LLMProvider | null {
    return this.fallback;
  }

  getPrimaryName(): string {
    return this.config.provider.primary;
  }

  getFallbackName(): string {
    return this.config.provider.fallback;
  }

  isConnected(): boolean {
    return this.primary !== null || this.fallback !== null;
  }

  async *chat(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string> {
    if (this.primary) {
      try {
        yield* this.primary.chat(messages, options);
        return;
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        if (err.status === 429 || err.status === 500 || err.status === 503) {
          console.warn(`Primary provider failed with ${err.status}, failing over to fallback`);
          insertActivity({
            type: 'provider_failover',
            summary: `Provider failover: ${this.config.provider.primary} → ${this.config.provider.fallback}`,
            details: `Error: ${err.message ?? 'Unknown error'}`,
            timestamp: Date.now(),
          });
        } else {
          throw error;
        }
      }
    }

    if (this.fallback) {
      yield* this.fallback.chat(messages, options);
      return;
    }

    throw new Error('No LLM provider available');
  }

  async chatComplete(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.chat(messages, options)) {
      chunks.push(chunk);
    }
    return chunks.join('');
  }
}

export { AnthropicProvider } from './anthropic.js';
export { OpenAIProvider } from './openai.js';
export { OpenRouterProvider } from './openrouter.js';
export { OllamaProvider } from './ollama.js';
