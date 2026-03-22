# NEXUS — Enhanced Personal AI Agent Platform

A self-hosted, LLM-agnostic personal AI agent platform with a beautiful web UI, structured inspectable memory, and proactive intelligence.

## Features

- **Gateway Service** — Persistent background process with WebSocket control plane, OpenAI-compatible REST API, and webhook receiver
- **Memory System** — Structured, inspectable, curated knowledge graph with semantic search, structured facts, and conversation history
- **Multi-Channel** — Web UI, Telegram, WhatsApp, and webhook channels sharing the same memory
- **Skills System** — Markdown-based skills with cron triggers, keyword triggers, and hot-reload
- **Proactive Intelligence** — Background worker that surfaces insights without being asked
- **Tool System** — exec, web_search, web_fetch, memory operations, file I/O, and more
- **Beautiful Web UI** — Next.js 14 + Tailwind + shadcn/ui with Chat, Memory, Skills, Activity, and Settings

## Quick Start

```bash
# Install
npm install

# Start gateway in foreground
npm run dev

# Or start as daemon
npx nexus start

# Check status
npx nexus status

# Chat from CLI
npx nexus chat "Hello, Nexus!"
```

## Configuration

Configuration is stored at `~/.nexus/config.json`. On first run, defaults are created automatically.

```json
{
  "provider": {
    "primary": "anthropic/claude-sonnet-4-6",
    "fallback": "openai/gpt-4o",
    "apiKeys": {
      "anthropic": "${ANTHROPIC_API_KEY}",
      "openai": "${OPENAI_API_KEY}",
      "openrouter": "${OPENROUTER_API_KEY}",
      "ollama": "http://localhost:11434"
    }
  },
  "gateway": {
    "port": 18799,
    "auth": { "token": "${NEXUS_GATEWAY_TOKEN}" }
  },
  "memory": {
    "embeddingModel": "openai/text-embedding-3-small",
    "vectorStore": "sqlite-vec"
  }
}
```

## Supported Providers

| Provider | SDK | Models |
|----------|-----|--------|
| Anthropic | @anthropic-ai/sdk | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 |
| OpenAI | openai | gpt-4o, gpt-4o-mini, o3, o4-mini |
| OpenRouter | OpenAI-compatible | Any OpenRouter model |
| Ollama | ollama | Any local model |

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌────────────┐
│   Web UI    │────▶│  Gateway Service │◀────│  Telegram  │
│  (Next.js)  │ WS  │  (Fastify/Node)  │     │  (Grammy)  │
└─────────────┘     │                  │     └────────────┘
                    │  ┌────────────┐  │     ┌────────────┐
                    │  │  Memory DB │  │◀────│  WhatsApp  │
                    │  │ (SQLite)   │  │     │ (Baileys)  │
                    │  └────────────┘  │     └────────────┘
                    │  ┌────────────┐  │     ┌────────────┐
                    │  │  Skills    │  │◀────│  Webhooks  │
                    │  │  Engine    │  │     │ /hooks/*   │
                    │  └────────────┘  │     └────────────┘
                    │  ┌────────────┐  │
                    │  │ Proactive  │  │
                    │  │  Worker    │  │
                    │  └────────────┘  │
                    └──────────────────┘
```

## CLI Commands

```bash
nexus start              # Start gateway daemon
nexus stop               # Stop gateway daemon
nexus status             # Show gateway health
nexus chat "message"     # Send a message
nexus memory search "q"  # Search memories
nexus memory set k v     # Write structured memory
nexus skill add FILE     # Install a skill
nexus skill list         # List skills
nexus logs --follow      # Tail gateway logs
nexus doctor             # Diagnose issues
```

## Validation

```bash
npm run validate:memory     # Test memory system
npm run validate:providers  # Test LLM providers
npm run validate:gateway    # Test gateway service
npm run validate:channels   # Test channel integration
npm run validate:ui         # Test web UI structure
```

## Tech Stack

- **Gateway**: TypeScript, Node.js 22+, Fastify, better-sqlite3, sqlite-vec
- **Web UI**: Next.js 14, React 18, TypeScript, Tailwind CSS, Framer Motion
- **Channels**: Grammy (Telegram), Baileys (WhatsApp)
- **CLI**: Commander.js

## License

MIT
