import { Ollama } from 'ollama';
import type { LLMProvider, LLMMessage, LLMOptions } from '../types/index.js';

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private client: Ollama;
  private defaultModel: string;

  constructor(host: string, model?: string) {
    this.client = new Ollama({ host });
    this.defaultModel = model ?? 'llama3.2';
  }

  async *chat(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<string> {
    const model = options?.model ?? this.defaultModel;

    const ollamaMessages = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const response = await this.client.chat({
      model,
      messages: ollamaMessages,
      stream: true,
    });

    for await (const part of response) {
      if (part.message?.content) {
        yield part.message.content;
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

  async embed(text: string): Promise<Float32Array> {
    const response = await this.client.embed({
      model: this.defaultModel,
      input: text,
    });
    return new Float32Array(response.embeddings[0]);
  }
}
