import OpenAI from 'openai';
import type { LLMProvider, LLMMessage, LLMOptions } from '../types/index.js';

export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
    this.defaultModel = model ?? 'openai/gpt-4o';
  }

  async *chat(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string> {
    const model = options?.model ?? this.defaultModel;

    const openaiMessages = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const stream = await this.client.chat.completions.create({
      model,
      messages: openaiMessages,
      max_tokens: options?.max_tokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
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
