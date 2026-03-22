import fs from 'fs';
import path from 'path';
import type { MedoConfig } from '../types/index.js';

const MEDO_DIR = path.join(process.env.HOME ?? '~', '.medo');
const CONFIG_PATH = path.join(MEDO_DIR, 'config.json');

const DEFAULT_CONFIG: MedoConfig = {
  provider: {
    primary: 'anthropic/claude-sonnet-4-6',
    fallback: 'openai/gpt-4o',
    apiKeys: {
      anthropic: '${ANTHROPIC_API_KEY}',
      openai: '${OPENAI_API_KEY}',
      openrouter: '${OPENROUTER_API_KEY}',
      ollama: 'http://localhost:11434',
    },
  },
  gateway: {
    port: 18799,
    auth: {
      token: '${MEDO_GATEWAY_TOKEN}',
    },
  },
  memory: {
    embeddingModel: 'openai/text-embedding-3-small',
    vectorStore: 'sqlite-vec',
  },
  channels: {},
  skills: [],
  cron: [],
};

export function loadConfig(): MedoConfig {
  ensureMedoDir();

  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw) as MedoConfig;
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    console.error('Failed to load config, using defaults:', error);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: MedoConfig): void {
  ensureMedoDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getMedoDir(): string {
  return MEDO_DIR;
}

function ensureMedoDir(): void {
  if (!fs.existsSync(MEDO_DIR)) {
    fs.mkdirSync(MEDO_DIR, { recursive: true });
  }
}

export function getPort(): number {
  const envPort = process.env.MEDO_GATEWAY_PORT;
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
