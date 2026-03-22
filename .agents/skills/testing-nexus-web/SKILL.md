# Testing NEXUS Web UI

## Environment Setup

1. Start the gateway: `export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" && npx tsx src/gateway/index.ts` (port 18799)
2. Start the web UI: `cd web && npx next dev -p 18800` (port 18800)
3. Ensure `~/.nexus/memory.db` exists with seeded data for graph tests

## Devin Secrets Needed
- `ANTHROPIC_API_KEY` — required for real LLM integration tests

## Memory Graph Testing

### Node Sizing
- The API returns `access_count` but the D3 graph component maps it to `usage_count`
- If all nodes appear the same size, check for field name mismatches between API response and component props
- Query node sizes via console: `document.querySelectorAll('circle.graph-node').forEach(c => console.log(c.getAttribute('data-id')?.slice(0,8), c.getAttribute('r')))`
- Expected formula: `r = 8 + Math.log(access_count + 1) * 6`, clamped 8-28px

### Cluster Hover Dimming
- Cluster labels are SVG `<text>` elements inside the graph SVG
- To programmatically trigger hover: find the label with `document.querySelectorAll('svg text')`, then dispatch `mouseenter`/`mouseleave` events
- Verify opacity: cluster nodes should be 1.0, others should be 0.2
- D3 transitions take 150ms — wait before querying opacity values

### Ripple Pulse Animation
- Triggered by `memory-pulse` WebSocket events from the gateway
- The reinforce endpoint (`POST /api/memories/:id/reinforce`) broadcasts the WS event
- **Important**: The page has multiple SVGs (sidebar icons + graph). Use `document.querySelector('circle.graph-node')?.closest('svg')` to find the correct graph SVG
- `document.querySelector('svg')` will return the sidebar SVG, NOT the graph SVG
- To verify ripple rendering without WS, directly create the SVG elements matching the code in MemoryView.tsx
- Ripple spec: `<circle>` with `<animate attributeName="r" from="{r}" to="{r*2.5}" dur="0.8s">` and `<animate attributeName="opacity" from="0.6" to="0" dur="0.8s">`

## Proactive Message Testing

### UI Styling Verification
- Proactive messages have class `animate-slideDown` and `border-l-2 border-l-[var(--accent)]`
- "NEXUS reached out" label: font-size 9px, uppercase, positioned absolute top-right
- The `slideDown` keyframe: 200ms ease-out, translateY(-12px) to translateY(0)
- Can verify CSS exists by iterating `document.styleSheets` and checking for `slideDown`

### Proactive Status Endpoint
- `GET /api/proactive/status` returns: enabled, messagesToday, maxPerDay, intervalMs, behaviors, contactWindow, lastProactiveSent
- `contactWindow` may be null if no activity history exists

## Common Pitfalls
- Field name mismatches between backend API responses and frontend component expectations (e.g., `access_count` vs `usage_count`, `nodeIds` vs `nodes`)
- Multiple SVG elements on the page — always use `.closest('svg')` from a known graph element
- WebSocket events may not flow to the browser if the app's internal WS module isn't connected on the current view
- React Query caching means page refreshes may show stale data — check stale times in `hooks.ts`
