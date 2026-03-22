import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { loadConfig, getPort } from './config.js';
import { initDatabase } from '../memory/database.js';
import { ProviderManager } from '../providers/index.js';
import { SkillManager } from '../skills/index.js';
import { ProactiveWorker } from '../proactive/index.js';
import { TelegramChannel } from '../channels/telegram.js';
import { WhatsAppChannel } from '../channels/whatsapp.js';
import { setupWebSocket, broadcastToClients, setProactiveWorker } from './websocket.js';
import { setupRoutes } from './routes.js';
import { Cron } from 'croner';

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════╗');
  console.log('║         MEDO Agent Gateway          ║');
  console.log('║      Enhanced Personal AI Agent      ║');
  console.log('╚══════════════════════════════════════╝');

  // Load configuration
  const config = loadConfig();
  const port = getPort();
  console.log(`Configuration loaded from ~/.medo/config.json`);

  // Initialize database
  initDatabase();
  console.log('Memory database initialized');

  // Initialize provider manager
  const providerManager = new ProviderManager(config);
  console.log(`Provider: ${config.provider.primary} (fallback: ${config.provider.fallback})`);

  // Initialize skill manager (lazy loading — skills loaded on first access, not startup)
  const skillManager = new SkillManager();
  // Defer skill loading to avoid blocking startup
  process.nextTick(() => {
    skillManager.loadSkills();
    console.log(`Skills loaded: ${skillManager.getAllSkills().length}`);
  });

  // Start file watcher for skills
  skillManager.startWatching(() => {
    console.log('Skills reloaded');
  });

  // Initialize proactive worker
  const proactiveWorker = ProactiveWorker.fromSettings(providerManager, config.proactive);
  proactiveWorker.setMessageHandler((message, channel) => {
    broadcastToClients({
      type: 'proactive',
      payload: { message, channel },
      timestamp: Date.now(),
    });
  });

  // Initialize channels
  const telegramChannel = new TelegramChannel(config);
  const whatsappChannel = new WhatsAppChannel(config);

  // Create Fastify server
  const app = Fastify({
    logger: false,
  });

  // Register plugins
  // CORS: restrict to configured origins or localhost by default
  const corsOrigins = config.gateway.cors?.origins ?? ['http://localhost:18800', 'http://localhost:18799', 'http://127.0.0.1:18800', 'http://127.0.0.1:18799'];
  await app.register(fastifyCors, {
    origin: corsOrigins,
    credentials: true,
  });

  await app.register(fastifyWebsocket);

  // Serve web UI static files
  const webDistPath = path.join(import.meta.dirname ?? __dirname, '../../web/out');
  if (fs.existsSync(webDistPath)) {
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      decorateReply: false,
    });
  }

  // Wire proactive worker to websocket for task extraction
  setProactiveWorker(proactiveWorker);

  // Setup WebSocket handler
  setupWebSocket(app, config, providerManager, skillManager);

  // Setup REST routes
  setupRoutes(app, config, providerManager, skillManager, proactiveWorker as unknown as { getStatus: () => Record<string, unknown>; getConfig: () => Record<string, unknown> });

  // Setup cron jobs for skills
  const cronJobs: Cron[] = [];
  for (const { skill, cron } of skillManager.getCronSkills()) {
    const job = new Cron(cron, () => {
      console.log(`Cron triggered skill: ${skill.config.name}`);
      broadcastToClients({
        type: 'activity',
        payload: {
          type: 'cron',
          summary: `Cron: ${skill.config.name}`,
          details: skill.content.slice(0, 200),
        },
        timestamp: Date.now(),
      });
    });
    cronJobs.push(job);
    console.log(`Cron job registered: ${skill.config.name} (${cron})`);
  }

  // Start proactive worker
  proactiveWorker.start();

  // Start channels
  telegramChannel.start().catch(err => console.error('Telegram start error:', err));
  whatsappChannel.start().catch(err => console.error('WhatsApp start error:', err));

  // Start the server
  try {
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`\nGateway listening on http://localhost:${port}`);
    console.log(`Health: http://localhost:${port}/health`);
    console.log(`WebSocket: ws://localhost:${port}/ws`);
    console.log(`OpenAI API: http://localhost:${port}/v1/chat/completions`);
    console.log(`Web UI: http://localhost:${port}`);
    console.log('\nMedo is ready.\n');
  } catch (error) {
    console.error('Failed to start gateway:', error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log('\nShutting down Medo...');
    proactiveWorker.stop();
    skillManager.stopWatching();
    for (const job of cronJobs) {
      job.stop();
    }
    await telegramChannel.stop();
    await whatsappChannel.stop();
    await app.close();
    console.log('Medo stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
