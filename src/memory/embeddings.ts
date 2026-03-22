import type { NexusConfig } from '../types/index.js';

export class EmbeddingService {
  private config: NexusConfig;

  constructor(config: NexusConfig) {
    this.config = config;
  }

  async embed(text: string): Promise<Float32Array> {
    const model = this.config.memory.embeddingModel;
    const [provider] = model.split('/');

    if (provider === 'openai') {
      return this.embedWithOpenAI(text, model.replace('openai/', ''));
    }

    // local/fallback or any other provider: use hash-based embedding
    return this.fallbackEmbed(text);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  private async embedWithOpenAI(text: string, model: string): Promise<Float32Array> {
    const apiKey = this.resolveEnvVar(this.config.provider.apiKeys.openai ?? '');
    if (!apiKey) {
      return this.fallbackEmbed(text);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          model: model,
        }),
      });

      if (!response.ok) {
        console.warn(`OpenAI embedding failed: ${response.status}, using fallback`);
        return this.fallbackEmbed(text);
      }

      const data = await response.json() as { data: Array<{ embedding: number[] }> };
      return new Float32Array(data.data[0].embedding);
    } catch (error) {
      console.warn('OpenAI embedding error, using fallback:', error);
      return this.fallbackEmbed(text);
    }
  }

  /**
   * Simple deterministic embedding fallback using character-level hashing.
   * Produces a 384-dimensional vector for basic similarity comparisons.
   */
  private fallbackEmbed(text: string): Float32Array {
    const dims = 384;
    const embedding = new Float32Array(dims);
    const normalized = text.toLowerCase().trim();

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      const idx = (charCode * (i + 1)) % dims;
      embedding[idx] += 1.0;
    }

    // Bigram features
    for (let i = 0; i < normalized.length - 1; i++) {
      const bigram = normalized.charCodeAt(i) * 31 + normalized.charCodeAt(i + 1);
      const idx = bigram % dims;
      embedding[idx] += 0.5;
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < dims; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dims; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  private resolveEnvVar(value: string): string {
    if (value.startsWith('${') && value.endsWith('}')) {
      const envName = value.slice(2, -1);
      return process.env[envName] ?? '';
    }
    return value;
  }
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
