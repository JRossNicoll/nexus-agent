import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMMessage, LLMOptions } from '../types/index.js';

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private client: Anthropic;
  private defaultModel: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = model ?? 'claude-sonnet-4-6';
  }

  async *chat(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string> {
    const model = options?.model ?? this.defaultModel;
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystemMsgs = messages.filter(m => m.role !== 'system');

    const anthropicMessages = nonSystemMsgs.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const stream = this.client.messages.stream({
      model,
      max_tokens: options?.max_tokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      system: systemMsg?.content ?? '',
      messages: anthropicMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  async chatComplete(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.chat(messages, options)) {
      chunks.push(chunk);
    }
    return chunks.join('');
  }
}
