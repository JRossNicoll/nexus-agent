import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import type {
  SemanticMemory,
  StructuredMemory,
  ConversationMessage,
  ToolCall,
  ActivityEntry,
} from '../types/index.js';

const NEXUS_DIR = path.join(process.env.HOME ?? '~', '.nexus');
const DB_PATH = path.join(NEXUS_DIR, 'memory.db');

let db: Database.Database | null = null;

export function getDbPath(): string {
  return DB_PATH;
}

export function initDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? DB_PATH;
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables(db);
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function createTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      embedding BLOB,
      category TEXT,
      source TEXT,
      confidence REAL DEFAULT 1.0,
      created_at INTEGER,
      last_accessed INTEGER,
      access_count INTEGER DEFAULT 0,
      tags TEXT
    );

    CREATE TABLE IF NOT EXISTS structured_memory (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      type TEXT,
      category TEXT,
      updated_at INTEGER,
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      role TEXT,
      content TEXT,
      provider TEXT,
      model TEXT,
      tokens_used INTEGER,
      latency_ms INTEGER,
      timestamp INTEGER,
      channel TEXT
    );

    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      tool_name TEXT,
      input TEXT,
      output TEXT,
      duration_ms INTEGER,
      success INTEGER,
      timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      type TEXT,
      summary TEXT,
      details TEXT,
      timestamp INTEGER,
      session_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(source);
    CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls(session_id);
    CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_structured_category ON structured_memory(category);
  `);
}

// Semantic memory operations
export function insertMemory(memory: Omit<SemanticMemory, 'id' | 'created_at' | 'last_accessed' | 'access_count'>): string {
  const database = getDatabase();
  const id = randomUUID();
  const now = Date.now();

  database.prepare(`
    INSERT INTO memories (id, content, embedding, category, source, confidence, created_at, last_accessed, access_count, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    memory.content,
    memory.embedding ? Buffer.from(memory.embedding.buffer) : null,
    memory.category,
    memory.source,
    memory.confidence,
    now,
    now,
    JSON.stringify(memory.tags)
  );

  return id;
}

export function getMemories(limit = 100, offset = 0, category?: string): SemanticMemory[] {
  const database = getDatabase();
  let query = 'SELECT * FROM memories';
  const params: unknown[] = [];

  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = database.prepare(query).all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToSemanticMemory);
}

export function deleteMemory(id: string): boolean {
  const database = getDatabase();
  const result = database.prepare('DELETE FROM memories WHERE id = ?').run(id);
  return result.changes > 0;
}

export function deleteMemoriesByCategory(category: string): number {
  const database = getDatabase();
  const result = database.prepare('DELETE FROM memories WHERE category = ?').run(category);
  return result.changes;
}

export function updateMemoryAccess(id: string): void {
  const database = getDatabase();
  database.prepare(`
    UPDATE memories SET last_accessed = ?, access_count = access_count + 1 WHERE id = ?
  `).run(Date.now(), id);
}

export function searchMemoriesByText(query: string, limit = 10): SemanticMemory[] {
  const database = getDatabase();
  const rows = database.prepare(`
    SELECT * FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?
  `).all(`%${query}%`, limit) as Array<Record<string, unknown>>;
  return rows.map(rowToSemanticMemory);
}

export function getMemoryStats(): { totalMemories: number; totalConversations: number; totalStructured: number; dbSizeBytes: number } {
  const database = getDatabase();
  const memories = database.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number };
  const conversations = database.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number };
  const structured = database.prepare('SELECT COUNT(*) as count FROM structured_memory').get() as { count: number };

  let dbSizeBytes = 0;
  try {
    const resolvedPath = db?.name ?? DB_PATH;
    if (fs.existsSync(resolvedPath)) {
      dbSizeBytes = fs.statSync(resolvedPath).size;
    }
  } catch {
    // ignore
  }

  return {
    totalMemories: memories.count,
    totalConversations: conversations.count,
    totalStructured: structured.count,
    dbSizeBytes,
  };
}

// Structured memory operations
export function setStructuredMemory(entry: StructuredMemory): void {
  const database = getDatabase();
  database.prepare(`
    INSERT OR REPLACE INTO structured_memory (key, value, type, category, updated_at, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entry.key, entry.value, entry.type, entry.category, Date.now(), entry.source);
}

export function getStructuredMemory(key: string): StructuredMemory | null {
  const database = getDatabase();
  const row = database.prepare('SELECT * FROM structured_memory WHERE key = ?').get(key) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToStructuredMemory(row);
}

export function getAllStructuredMemory(category?: string): StructuredMemory[] {
  const database = getDatabase();
  let query = 'SELECT * FROM structured_memory';
  const params: unknown[] = [];

  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }

  query += ' ORDER BY updated_at DESC';
  const rows = database.prepare(query).all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToStructuredMemory);
}

export function deleteStructuredMemory(key: string): boolean {
  const database = getDatabase();
  const result = database.prepare('DELETE FROM structured_memory WHERE key = ?').run(key);
  return result.changes > 0;
}

// Conversation operations
export function insertConversation(message: Omit<ConversationMessage, 'id'>): string {
  const database = getDatabase();
  const id = randomUUID();

  database.prepare(`
    INSERT INTO conversations (id, session_id, role, content, provider, model, tokens_used, latency_ms, timestamp, channel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    message.session_id,
    message.role,
    message.content,
    message.provider,
    message.model,
    message.tokens_used,
    message.latency_ms,
    message.timestamp,
    message.channel
  );

  return id;
}

export function getConversations(sessionId?: string, limit = 50, offset = 0): ConversationMessage[] {
  const database = getDatabase();
  let query = 'SELECT * FROM conversations';
  const params: unknown[] = [];

  if (sessionId) {
    query += ' WHERE session_id = ?';
    params.push(sessionId);
  }

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = database.prepare(query).all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToConversation);
}

export function getRecentConversations(limit = 20): ConversationMessage[] {
  const database = getDatabase();
  const rows = database.prepare(`
    SELECT * FROM conversations ORDER BY timestamp DESC LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>;
  return rows.map(rowToConversation);
}

// Tool call operations
export function insertToolCall(call: Omit<ToolCall, 'id'>): string {
  const database = getDatabase();
  const id = randomUUID();

  database.prepare(`
    INSERT INTO tool_calls (id, session_id, tool_name, input, output, duration_ms, success, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, call.session_id, call.tool_name, call.input, call.output, call.duration_ms, call.success ? 1 : 0, call.timestamp);

  return id;
}

export function getToolCalls(sessionId?: string, limit = 50): ToolCall[] {
  const database = getDatabase();
  let query = 'SELECT * FROM tool_calls';
  const params: unknown[] = [];

  if (sessionId) {
    query += ' WHERE session_id = ?';
    params.push(sessionId);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  const rows = database.prepare(query).all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToToolCall);
}

// Activity log operations
export function insertActivity(entry: Omit<ActivityEntry, 'id'>): string {
  const database = getDatabase();
  const id = randomUUID();

  database.prepare(`
    INSERT INTO activity_log (id, type, summary, details, timestamp, session_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, entry.type, entry.summary, entry.details, entry.timestamp, entry.session_id ?? null);

  return id;
}

export function getActivities(limit = 100, offset = 0, type?: string): ActivityEntry[] {
  const database = getDatabase();
  let query = 'SELECT * FROM activity_log';
  const params: unknown[] = [];

  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = database.prepare(query).all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToActivity);
}

// Memory consolidation
export function consolidateMemories(): { merged: number; flagged: number } {
  const database = getDatabase();
  const memories = database.prepare('SELECT * FROM memories ORDER BY created_at ASC').all() as Array<Record<string, unknown>>;

  let merged = 0;
  let flagged = 0;
  const seen = new Map<string, string>();

  for (const mem of memories) {
    const content = (mem.content as string).toLowerCase().trim();
    const existing = seen.get(content);

    if (existing) {
      // Exact duplicate - delete the newer one
      database.prepare('DELETE FROM memories WHERE id = ?').run(mem.id);
      merged++;
    } else {
      seen.set(content, mem.id as string);
    }
  }

  // Check for near-duplicates (same start, similar length)
  const remaining = database.prepare('SELECT * FROM memories ORDER BY created_at ASC').all() as Array<Record<string, unknown>>;
  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      const a = (remaining[i].content as string).toLowerCase();
      const b = (remaining[j].content as string).toLowerCase();
      if (a.length > 20 && b.length > 20 && a.substring(0, 20) === b.substring(0, 20)) {
        // Flag for review but keep both
        flagged++;
      }
    }
  }

  return { merged, flagged };
}

// Row mapping helpers
function rowToSemanticMemory(row: Record<string, unknown>): SemanticMemory {
  return {
    id: row.id as string,
    content: row.content as string,
    embedding: row.embedding ? new Float32Array((row.embedding as Buffer).buffer) : null,
    category: row.category as SemanticMemory['category'],
    source: row.source as SemanticMemory['source'],
    confidence: row.confidence as number,
    created_at: row.created_at as number,
    last_accessed: row.last_accessed as number,
    access_count: row.access_count as number,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
  };
}

function rowToStructuredMemory(row: Record<string, unknown>): StructuredMemory {
  return {
    key: row.key as string,
    value: row.value as string,
    type: row.type as StructuredMemory['type'],
    category: row.category as StructuredMemory['category'],
    updated_at: row.updated_at as number,
    source: row.source as string,
  };
}

function rowToConversation(row: Record<string, unknown>): ConversationMessage {
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    role: row.role as ConversationMessage['role'],
    content: row.content as string,
    provider: row.provider as string,
    model: row.model as string,
    tokens_used: row.tokens_used as number,
    latency_ms: row.latency_ms as number,
    timestamp: row.timestamp as number,
    channel: row.channel as ConversationMessage['channel'],
  };
}

function rowToToolCall(row: Record<string, unknown>): ToolCall {
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    tool_name: row.tool_name as string,
    input: row.input as string,
    output: row.output as string,
    duration_ms: row.duration_ms as number,
    success: Boolean(row.success),
    timestamp: row.timestamp as number,
  };
}

function rowToActivity(row: Record<string, unknown>): ActivityEntry {
  return {
    id: row.id as string,
    type: row.type as ActivityEntry['type'],
    summary: row.summary as string,
    details: row.details as string,
    timestamp: row.timestamp as number,
    session_id: row.session_id as string | undefined,
  };
}
