import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import type { ToolDefinition, NexusConfig } from '../types/index.js';
import {
  searchMemoriesByText,
  setStructuredMemory,
  getStructuredMemory,
  insertToolCall,
} from '../memory/database.js';

const execAsync = promisify(exec);

export interface ToolContext {
  config: NexusConfig;
  sessionId: string;
  workspaceDir?: string;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;

const toolHandlers: Record<string, ToolHandler> = {};

// exec tool
toolHandlers['exec'] = async (args, ctx) => {
  const command = args.command as string;
  const timeout = (args.timeout as number) ?? 30000;

  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      cwd: ctx.workspaceDir ?? process.env.HOME,
      maxBuffer: 1024 * 1024,
    });
    const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
    logToolCall(ctx.sessionId, 'exec', JSON.stringify(args), output, Date.now() - start, true);
    return output || '(no output)';
  } catch (error: unknown) {
    const err = error as { message: string };
    logToolCall(ctx.sessionId, 'exec', JSON.stringify(args), err.message, Date.now() - start, false);
    return `Error: ${err.message}`;
  }
};

// web_search tool
toolHandlers['web_search'] = async (args, ctx) => {
  const query = args.query as string;
  const start = Date.now();
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
    const data = await response.json() as Record<string, unknown>;
    const results = JSON.stringify(data, null, 2).slice(0, 4000);
    logToolCall(ctx.sessionId, 'web_search', JSON.stringify(args), results, Date.now() - start, true);
    return results;
  } catch (error: unknown) {
    const err = error as { message: string };
    logToolCall(ctx.sessionId, 'web_search', JSON.stringify(args), err.message, Date.now() - start, false);
    return `Search error: ${err.message}`;
  }
};

// web_fetch tool
toolHandlers['web_fetch'] = async (args, ctx) => {
  const url = args.url as string;
  const start = Date.now();
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Nexus-Agent/0.1' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    const result = text.slice(0, 8000);
    logToolCall(ctx.sessionId, 'web_fetch', JSON.stringify(args), result, Date.now() - start, true);
    return result;
  } catch (error: unknown) {
    const err = error as { message: string };
    logToolCall(ctx.sessionId, 'web_fetch', JSON.stringify(args), err.message, Date.now() - start, false);
    return `Fetch error: ${err.message}`;
  }
};

// memory_search tool
toolHandlers['memory_search'] = async (args, ctx) => {
  const query = args.query as string;
  const limit = (args.limit as number) ?? 10;
  const start = Date.now();
  try {
    const results = searchMemoriesByText(query, limit);
    const output = JSON.stringify(results.map(r => ({
      id: r.id,
      content: r.content,
      category: r.category,
      confidence: r.confidence,
    })), null, 2);
    logToolCall(ctx.sessionId, 'memory_search', JSON.stringify(args), output, Date.now() - start, true);
    return output;
  } catch (error: unknown) {
    const err = error as { message: string };
    logToolCall(ctx.sessionId, 'memory_search', JSON.stringify(args), err.message, Date.now() - start, false);
    return `Memory search error: ${err.message}`;
  }
};

// memory_set tool
toolHandlers['memory_set'] = async (args, ctx) => {
  const key = args.key as string;
  const value = args.value as string;
  const category = (args.category as string) ?? 'preferences';
  const type = (args.type as string) ?? 'string';
  const start = Date.now();
  try {
    setStructuredMemory({
      key,
      value,
      type: type as 'string' | 'number' | 'date' | 'list' | 'object',
      category: category as 'identity' | 'preferences' | 'health' | 'finance' | 'relationships' | 'goals',
      updated_at: Date.now(),
      source: 'tool',
    });
    const output = `Stored: ${key} = ${value}`;
    logToolCall(ctx.sessionId, 'memory_set', JSON.stringify(args), output, Date.now() - start, true);
    return output;
  } catch (error: unknown) {
    const err = error as { message: string };
    logToolCall(ctx.sessionId, 'memory_set', JSON.stringify(args), err.message, Date.now() - start, false);
    return `Memory set error: ${err.message}`;
  }
};

// memory_get tool
toolHandlers['memory_get'] = async (args, ctx) => {
  const key = args.key as string;
  const start = Date.now();
  try {
    const entry = getStructuredMemory(key);
    const output = entry ? JSON.stringify(entry, null, 2) : `No memory found for key: ${key}`;
    logToolCall(ctx.sessionId, 'memory_get', JSON.stringify(args), output, Date.now() - start, true);
    return output;
  } catch (error: unknown) {
    const err = error as { message: string };
    logToolCall(ctx.sessionId, 'memory_get', JSON.stringify(args), err.message, Date.now() - start, false);
    return `Memory get error: ${err.message}`;
  }
};

// file_read tool
toolHandlers['file_read'] = async (args, ctx) => {
  const filePath = args.path as string;
  const start = Date.now();
  try {
    const resolvedPath = path.resolve(ctx.workspaceDir ?? process.env.HOME ?? '', filePath);
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const result = content.slice(0, 10000);
    logToolCall(ctx.sessionId, 'file_read', JSON.stringify(args), `Read ${content.length} chars`, Date.now() - start, true);
    return result;
  } catch (error: unknown) {
    const err = error as { message: string };
    logToolCall(ctx.sessionId, 'file_read', JSON.stringify(args), err.message, Date.now() - start, false);
    return `File read error: ${err.message}`;
  }
};

// file_write tool
toolHandlers['file_write'] = async (args, ctx) => {
  const filePath = args.path as string;
  const content = args.content as string;
  const start = Date.now();
  try {
    const resolvedPath = path.resolve(ctx.workspaceDir ?? process.env.HOME ?? '', filePath);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, content, 'utf-8');
    const output = `Written ${content.length} chars to ${resolvedPath}`;
    logToolCall(ctx.sessionId, 'file_write', JSON.stringify(args), output, Date.now() - start, true);
    return output;
  } catch (error: unknown) {
    const err = error as { message: string };
    logToolCall(ctx.sessionId, 'file_write', JSON.stringify(args), err.message, Date.now() - start, false);
    return `File write error: ${err.message}`;
  }
};

// send_message tool
toolHandlers['send_message'] = async (args, ctx) => {
  const channel = args.channel as string;
  const message = args.message as string;
  const start = Date.now();
  const output = `Message sent to ${channel}: ${message.slice(0, 100)}`;
  logToolCall(ctx.sessionId, 'send_message', JSON.stringify(args), output, Date.now() - start, true);
  return output;
};

// schedule tool
toolHandlers['schedule'] = async (args, ctx) => {
  const action = args.action as string;
  const name = args.name as string;
  const start = Date.now();
  const output = `Schedule ${action}: ${name}`;
  logToolCall(ctx.sessionId, 'schedule', JSON.stringify(args), output, Date.now() - start, true);
  return output;
};

// skill_run tool
toolHandlers['skill_run'] = async (args, ctx) => {
  const skillName = args.name as string;
  const start = Date.now();
  const output = `Skill invoked: ${skillName}`;
  logToolCall(ctx.sessionId, 'skill_run', JSON.stringify(args), output, Date.now() - start, true);
  return output;
};

function logToolCall(sessionId: string, toolName: string, input: string, output: string, durationMs: number, success: boolean): void {
  try {
    insertToolCall({
      session_id: sessionId,
      tool_name: toolName,
      input,
      output: output.slice(0, 5000),
      duration_ms: durationMs,
      success,
      timestamp: Date.now(),
    });
  } catch {
    // Ignore logging errors
  }
}

export function getToolHandler(name: string): ToolHandler | undefined {
  return toolHandlers[name];
}

export async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const handler = toolHandlers[name];
  if (!handler) {
    return `Unknown tool: ${name}`;
  }
  return handler(args, ctx);
}

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'exec',
        description: 'Run shell commands. Returns stdout and stderr.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Shell command to execute' },
            timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
          },
          required: ['command'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web using DuckDuckGo. Returns structured results.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'web_fetch',
        description: 'Fetch and extract text content from any URL.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to fetch' },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'memory_search',
        description: 'Semantic search over memories. Returns top-N with similarity scores.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Max results (default 10)' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'memory_set',
        description: 'Write a structured memory fact.',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Memory key' },
            value: { type: 'string', description: 'Memory value' },
            category: { type: 'string', description: 'Category: identity, preferences, health, finance, relationships, goals' },
            type: { type: 'string', description: 'Value type: string, number, date, list, object' },
          },
          required: ['key', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'memory_get',
        description: 'Retrieve a specific structured memory by key.',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Memory key to retrieve' },
          },
          required: ['key'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'file_read',
        description: 'Read a file from the workspace directory.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path (relative to workspace or absolute)' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'file_write',
        description: 'Write content to a file in the workspace directory.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path (relative to workspace or absolute)' },
            content: { type: 'string', description: 'Content to write' },
          },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_message',
        description: 'Send a message to a specific channel.',
        parameters: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel name: web, telegram, whatsapp' },
            message: { type: 'string', description: 'Message content' },
          },
          required: ['channel', 'message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'schedule',
        description: 'Create or delete cron jobs at runtime.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Action: create or delete' },
            name: { type: 'string', description: 'Job name' },
            cron: { type: 'string', description: 'Cron expression (for create)' },
            skill: { type: 'string', description: 'Skill to run (for create)' },
          },
          required: ['action', 'name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'skill_run',
        description: 'Explicitly invoke a named skill.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name to invoke' },
          },
          required: ['name'],
        },
      },
    },
  ];
}
