#!/usr/bin/env node

import { Command } from 'commander';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { loadConfig, getPort, getMedoDir } from '../gateway/config.js';
import { initDatabase, getMemoryStats, searchMemoriesByText, setStructuredMemory, consolidateMemories } from '../memory/database.js';

const program = new Command();

program
  .name('medo')
  .description('MEDO — Enhanced Personal AI Agent Platform')
  .version('0.1.0');

// medo start
program
  .command('start')
  .description('Start the Medo gateway daemon')
  .option('-f, --foreground', 'Run in foreground instead of daemon mode')
  .action(async (options: { foreground?: boolean }) => {
    const port = getPort();

    if (options.foreground) {
      console.log('Starting Medo gateway in foreground mode...');
      const entry = path.join(import.meta.dirname ?? __dirname, '../gateway/index.js');
      await import(entry);
      return;
    }

    const pidFile = path.join(getMedoDir(), 'gateway.pid');
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'), 10);
      try {
        process.kill(pid, 0);
        console.log(`Medo gateway already running (PID: ${pid})`);
        return;
      } catch {
        // Process not running, clean up stale PID file
        fs.unlinkSync(pidFile);
      }
    }

    const entry = path.join(import.meta.dirname ?? __dirname, '../gateway/index.js');
    const logFile = path.join(getMedoDir(), 'gateway.log');

    const out = fs.openSync(logFile, 'a');
    const err = fs.openSync(logFile, 'a');

    const child = spawn('node', [entry], {
      detached: true,
      stdio: ['ignore', out, err],
      env: { ...process.env },
    });

    child.unref();
    fs.writeFileSync(pidFile, String(child.pid), 'utf-8');
    console.log(`Medo gateway started (PID: ${child.pid})`);
    console.log(`Listening on http://localhost:${port}`);
    console.log(`Logs: ${logFile}`);
  });

// medo stop
program
  .command('stop')
  .description('Stop the Medo gateway daemon')
  .action(() => {
    const pidFile = path.join(getMedoDir(), 'gateway.pid');
    if (!fs.existsSync(pidFile)) {
      console.log('Medo gateway is not running');
      return;
    }

    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'), 10);
    try {
      process.kill(pid, 'SIGTERM');
      fs.unlinkSync(pidFile);
      console.log(`Medo gateway stopped (PID: ${pid})`);
    } catch {
      console.log('Gateway process not found, cleaning up PID file');
      fs.unlinkSync(pidFile);
    }
  });

// medo status
program
  .command('status')
  .description('Show gateway health, connected provider, memory stats')
  .action(async () => {
    const port = getPort();
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      const health = await response.json() as Record<string, unknown>;
      console.log('\n  MEDO Gateway Status');
      console.log('  ====================');
      console.log(`  Status:    ${health.status}`);
      console.log(`  Uptime:    ${formatUptime(health.uptime as number)}`);
      console.log(`  Provider:  ${(health.provider as Record<string, unknown>).primary}`);
      console.log(`  Fallback:  ${(health.provider as Record<string, unknown>).fallback}`);
      console.log(`  Connected: ${(health.provider as Record<string, unknown>).connected}`);
      const mem = health.memory as Record<string, unknown>;
      console.log(`  Memories:  ${mem.totalMemories}`);
      console.log(`  Messages:  ${mem.totalConversations}`);
      console.log(`  Structured:${mem.totalStructured}`);
      console.log(`  DB Size:   ${formatBytes(mem.dbSizeBytes as number)}`);
      console.log(`  Cron Jobs: ${health.activeCronJobs}`);
      console.log(`  Version:   ${health.version}\n`);
    } catch {
      console.log('Medo gateway is not running');
      console.log(`Expected at http://localhost:${port}`);
    }
  });

// medo chat — with streaming support
program
  .command('chat <message>')
  .description('Send a message and print response to stdout')
  .option('-m, --model <model>', 'Model to use')
  .option('-s, --stream', 'Stream output token by token')
  .action(async (message: string, options: { model?: string; stream?: boolean }) => {
    const port = getPort();
    try {
      const response = await fetch(`http://localhost:${port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
          model: options.model,
          stream: options.stream !== false,
        }),
      });

      if (options.stream !== false && response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const chunk = JSON.parse(line.slice(6)) as { choices?: Array<{ delta?: { content?: string } }> };
                const content = chunk.choices?.[0]?.delta?.content;
                if (content) process.stdout.write(content);
              } catch { /* skip parse errors */ }
            }
          }
        }
        console.log();
      } else {
        const data = await response.json() as {
          choices: Array<{ message: { content: string } }>;
        };
        console.log(data.choices[0].message.content);
      }
    } catch {
      console.error('Failed to connect to Medo gateway. Is it running?');
      process.exit(1);
    }
  });

// medo memory
const memory = program.command('memory').description('Memory management commands');

memory
  .command('search <query>')
  .description('Semantic search memories from terminal')
  .option('-l, --limit <n>', 'Max results', '10')
  .action((query: string, options: { limit: string }) => {
    try {
      initDatabase();
      const results = searchMemoriesByText(query, parseInt(options.limit, 10));
      if (results.length === 0) {
        console.log('No matching memories found');
        return;
      }
      for (const mem of results) {
        console.log(`\n[${mem.category}] ${mem.content.slice(0, 200)}`);
        console.log(`  Confidence: ${mem.confidence} | Access: ${mem.access_count} | Source: ${mem.source}`);
      }
    } catch (error) {
      console.error('Failed to search memory:', error);
    }
  });

memory
  .command('set <key> <value>')
  .description('Write a structured memory')
  .option('-c, --category <cat>', 'Category', 'preferences')
  .action((key: string, value: string, options: { category: string }) => {
    try {
      initDatabase();
      setStructuredMemory({
        key,
        value,
        type: 'string',
        category: options.category as 'preferences',
        updated_at: Date.now(),
        source: 'cli',
      });
      console.log(`Memory set: ${key} = ${value}`);
    } catch (error) {
      console.error('Failed to set memory:', error);
    }
  });

memory
  .command('stats')
  .description('Show memory statistics')
  .action(() => {
    try {
      initDatabase();
      const stats = getMemoryStats();
      console.log('\n  Memory Statistics');
      console.log('  ================');
      console.log(`  Semantic Memories: ${stats.totalMemories}`);
      console.log(`  Conversations:     ${stats.totalConversations}`);
      console.log(`  Structured Facts:  ${stats.totalStructured}`);
      console.log(`  Database Size:     ${formatBytes(stats.dbSizeBytes)}\n`);
    } catch (error) {
      console.error('Failed to get memory stats:', error);
    }
  });

memory
  .command('consolidate')
  .description('Run memory consolidation (dedup and merge)')
  .action(() => {
    try {
      initDatabase();
      const result = consolidateMemories();
      console.log(`Consolidation complete: ${result.merged} merged, ${result.flagged} flagged for review`);
    } catch (error) {
      console.error('Consolidation failed:', error);
    }
  });

// medo skill
const skill = program.command('skill').description('Skill management commands');

skill
  .command('add <path>')
  .description('Install a skill from a markdown file')
  .action((filePath: string) => {
    const skillsDir = path.join(getMedoDir(), 'skills');
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
    }
    const dest = path.join(skillsDir, path.basename(filePath));
    fs.copyFileSync(filePath, dest);
    console.log(`Skill installed: ${dest}`);
  });

skill
  .command('list')
  .description('List all installed skills')
  .action(() => {
    const skillsDir = path.join(getMedoDir(), 'skills');
    if (!fs.existsSync(skillsDir)) {
      console.log('No skills installed');
      return;
    }
    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
    if (files.length === 0) {
      console.log('No skills installed');
      return;
    }
    console.log('\nInstalled Skills:');
    for (const file of files) {
      console.log(`  - ${file.replace('.md', '')}`);
    }
    console.log();
  });

// medo logs
program
  .command('logs')
  .description('Tail gateway logs')
  .option('-f, --follow', 'Follow log output')
  .action((options: { follow?: boolean }) => {
    const logFile = path.join(getMedoDir(), 'gateway.log');
    if (!fs.existsSync(logFile)) {
      console.log('No log file found');
      return;
    }

    if (options.follow) {
      const proc = spawn('tail', ['-f', logFile], { stdio: 'inherit' });
      proc.on('exit', () => process.exit(0));
    } else {
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.split('\n');
      console.log(lines.slice(-50).join('\n'));
    }
  });

// medo doctor — enhanced diagnostics
program
  .command('doctor')
  .description('Diagnose configuration issues')
  .action(async () => {
    console.log('\n  MEDO Doctor');
    console.log('  ============\n');
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    const pass = (msg: string) => { console.log(`  ✓ ${msg}`); passed++; };
    const fail = (msg: string, fix?: string) => { console.log(`  ✗ ${msg}`); if (fix) console.log(`    Fix: ${fix}`); failed++; };
    const warn = (msg: string) => { console.log(`  ○ ${msg}`); warnings++; };

    // Check config
    const configPath = path.join(getMedoDir(), 'config.json');
    if (fs.existsSync(configPath)) {
      pass('Config file found');
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        JSON.parse(raw);
        pass('Config file is valid JSON');
      } catch {
        fail('Config file contains invalid JSON', 'Delete and recreate with "medo start"');
      }
    } else {
      fail('Config file missing', 'Run "medo start" to create defaults');
    }

    // Check database
    const dbPath = path.join(getMedoDir(), 'memory.db');
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      pass('Memory database found (' + formatBytes(stats.size) + ')');
    } else {
      warn('Memory database not yet created (will be created on first start)');
    }

    // Check skills directory
    const skillsDir = path.join(getMedoDir(), 'skills');
    if (fs.existsSync(skillsDir)) {
      const skills = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
      pass('Skills directory found (' + skills.length + ' skills)');
    } else {
      warn('Skills directory not found (will be created on first start)');
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1), 10);
    if (major >= 22) {
      pass('Node.js ' + nodeVersion);
    } else {
      fail('Node.js ' + nodeVersion + ' — requires 22+', 'Install Node.js 22+ from https://nodejs.org');
    }

    // Check disk space
    try {
      const diskInfo = execSync('df -h ' + getMedoDir() + ' 2>/dev/null | tail -1').toString().trim();
      const parts = diskInfo.split(/\s+/);
      if (parts.length >= 4) {
        pass('Disk space: ' + parts[3] + ' available');
      }
    } catch {
      warn('Could not check disk space');
    }

    // Check environment variables
    const envVars = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY'];
    let hasAnyProvider = false;
    for (const v of envVars) {
      if (process.env[v]) {
        pass(v + ' set');
        hasAnyProvider = true;
      } else {
        warn(v + ' not set');
      }
    }
    if (!hasAnyProvider) {
      fail('No LLM provider API key configured', 'Set at least one: export ANTHROPIC_API_KEY=your-key');
    }

    // Check gateway connectivity
    const port = getPort();
    try {
      const response = await fetch('http://localhost:' + port + '/health');
      if (response.ok) {
        const health = await response.json() as Record<string, unknown>;
        pass('Gateway running on port ' + port);
        const provider = health.provider as Record<string, unknown> | undefined;
        if (provider?.connected) {
          pass('Provider connected: ' + String(provider.primary));
        } else {
          fail('Provider not connected', 'Check API key configuration');
        }
        const channels = health.channels as Record<string, boolean> | undefined;
        if (channels) {
          if (channels.telegram) pass('Telegram channel connected');
          if (channels.whatsapp) pass('WhatsApp channel connected');
        }
      } else {
        fail('Gateway responded with status ' + response.status);
      }
    } catch {
      warn('Gateway not running on port ' + port + ' — run "medo start"');
    }

    // Check memory accessibility
    if (fs.existsSync(dbPath)) {
      try {
        initDatabase();
        const memStats = getMemoryStats();
        pass('Memory accessible: ' + memStats.totalMemories + ' memories, ' + memStats.totalConversations + ' conversations');
      } catch (err: unknown) {
        const e = err as { message: string };
        fail('Memory database error: ' + e.message);
      }
    }

    console.log('\n  Summary: ' + passed + ' passed, ' + failed + ' failed, ' + warnings + ' warnings\n');
    if (failed > 0) process.exit(1);
  });

program.parse();

// Helper functions
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
