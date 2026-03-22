import fs from 'fs';
import path from 'path';
import type { NexusConfig } from '../types/index.js';

const NEXUS_DIR = path.join(process.env.HOME ?? '~', '.nexus');
const CONFIG_PATH = path.join(NEXUS_DIR, 'config.json');

const DEFAULT_CONFIG: NexusConfig = {
  provider: {
    primary: 'anthropic/claude-sonnet-4-6',
    fallback: 'openai/gpt-4o',
    apiKeys: {
      anthropic: process.env.ANTHROPIC_API_KEY ?? '',
      openai: process.env.OPENAI_API_KEY ?? '',
      openrouter: process.env.OPENROUTER_API_KEY ?? '',
      ollama: 'http://localhost:11434',
    },
  },
  gateway: {
    port: 18799,
    auth: {
      token: process.env.NEXUS_GATEWAY_TOKEN ?? '',
    },
  },
  memory: {
    embeddingModel: 'local/fallback',
    vectorStore: 'sqlite-vec',
  },
  channels: {},
  skills: [],
  cron: [],
};

export function loadConfig(): NexusConfig {
  ensureNexusDir();

  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw) as NexusConfig;
    const merged = { ...DEFAULT_CONFIG, ...config };

    // Resolve any remaining ${...} env var placeholders from older configs
    if (merged.provider?.apiKeys) {
      for (const [key, value] of Object.entries(merged.provider.apiKeys)) {
        if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
          const envName = value.slice(2, -1);
          (merged.provider.apiKeys as Record<string, string>)[key] = process.env[envName] ?? '';
        }
      }
    }
    if (merged.gateway?.auth?.token && typeof merged.gateway.auth.token === 'string' &&
        merged.gateway.auth.token.startsWith('${') && merged.gateway.auth.token.endsWith('}')) {
      const envName = merged.gateway.auth.token.slice(2, -1);
      merged.gateway.auth.token = process.env[envName] ?? '';
    }

    return merged;
  } catch (error) {
    console.error('Failed to load config, using defaults:', error);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: NexusConfig): void {
  ensureNexusDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getNexusDir(): string {
  return NEXUS_DIR;
}

function ensureNexusDir(): void {
  if (!fs.existsSync(NEXUS_DIR)) {
    fs.mkdirSync(NEXUS_DIR, { recursive: true });
  }
}

export function getPort(): number {
  const envPort = process.env.NEXUS_GATEWAY_PORT;
  if (envPort) {
    const parsed = parseInt(envPort, 10);
    if (!isNaN(parsed)) return parsed;
  }
  const config = loadConfig();
  return config.gateway.port;
}

export function resolveEnvVar(value: string): string {
  if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
    const envName = value.slice(2, -1);
    return process.env[envName] ?? '';
  }
  return value;
}
