# Testing NEXUS App End-to-End

## Prerequisites

### Services
- **Gateway**: Must be running on port 18799 (`npx tsx src/gateway/index.ts` from repo root)
- **Web UI**: Must be running on port 18800 (`npx next dev -p 18800` from `web/` directory)
- Clean `.next` cache may be needed if you get 404 errors on assets: `rm -rf web/.next` before starting dev server

### Devin Secrets Needed
- `ANTHROPIC_API_KEY` — required for LLM calls and API key verification during onboarding

## Key Testing Flows

### 1. Onboarding Flow
- **Reset onboarding state**: The onboarding flag is stored in `~/.nexus/memory.db` in the `onboarding` table. To reset:
  ```bash
  cd /path/to/nexus-agent && npx tsx -e "
  const Database = require('better-sqlite3');
  const path = require('path');
  const db = new Database(path.join(process.env.HOME, '.nexus', 'memory.db'));
  db.pragma('journal_mode = WAL');
  db.prepare('UPDATE onboarding SET completed = 0 WHERE id = ?').run('default');
  db.close();
  "
  ```
- **Note**: `sqlite3` CLI is not installed on this machine. Use `better-sqlite3` via `npx tsx` instead.
- **Note**: The `POST /api/v1/settings/reset` endpoint clears memory data but does NOT reset the onboarding flag.
- After reset, navigate to `http://localhost:18800` to see the 5-screen onboarding flow.
- **Screen 2** has the API key guide modal ("I don't have an API key yet" button) and API key test functionality.
- **Screen 3** has the Telegram skip button ("Skip for now — set this up later in Settings").
- Screen 4 ("Tell me about yourself") fields are optional — can click Complete Setup directly.

### 2. WebSocket / View Navigation
- Sidebar tabs: Home (logo click), Chat, Memory, Skills, Activity, Settings
- WebSocket is managed at app level (`page.tsx`), persists across view navigation
- Verify no "Disconnected" text appears on any view
- Ambient orb (42px circle) should be visible in bottom-right corner on all views

### 3. Semantic Memory Search
- Seed memories via API: `POST http://localhost:18799/api/memories` with JSON body `{"content": "...", "category": "...", "tags": [...]}`
- Search via API: `GET http://localhost:18799/api/v1/memories/search?q=...`
- The search uses LLM-powered re-ranking (not vector/pgvector). It calls the Anthropic API to score relevance.
- Wait ~2 seconds after seeding before searching to allow indexing.
- Example test: seed "TypeScript" memory, search for "programming languages" — TypeScript should rank #1.

## Common Issues
- **Web UI 404 errors**: Kill the Next.js dev server and restart with a clean `.next` cache.
- **Onboarding still shows completed after reset**: Make sure you updated the `onboarding` table directly, not just called the settings reset API.
- **Memory Health shows "+undefined"**: Cosmetic issue in MemoryView when no memories exist yet — not a functional bug.
- **Welcome message on Screen 5 mentions blank profile**: Expected if Screen 4 fields were left empty during testing.

## Validation Scripts
Three validation scripts exist for Sprint 4 cleanup items:
- `scripts/validate_onboarding_ux.ts` — 26 checks for onboarding modal + Telegram skip
- `scripts/validate_websocket_resilience.ts` — 30 checks for WebSocket persistence
- `scripts/validate_semantic_search.ts` — 20 checks for semantic search

Run with: `npx tsx scripts/validate_<name>.ts`

## Config & Data Locations
- Config: `~/.nexus/config.json`
- Database: `~/.nexus/memory.db` (SQLite, WAL mode)
- Skills: `~/.nexus/skills/`
