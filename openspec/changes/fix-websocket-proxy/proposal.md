## Why

All WebSocket connections through `quant.membran.app` are broken. The Cloudflare Worker proxy (`quant-proxy`) intercepts WebSocket upgrade requests but fails to forward them correctly — it strips WebSocket headers (`Upgrade`, `Sec-WebSocket-Key`, `Sec-WebSocket-Version`) via a safe-header filter and uses `fetch()` which cannot perform WebSocket upgrades in the Workers runtime. This blocks three critical real-time channels:

- **Vite HMR WebSocket** — development hot-reload is non-functional
- **App `/ws/live`** — the real-time quantitative data broadcast to all 4 studio sandboxes (Valuation, LTTD, MTTD, Ichimoku) never connects
- **Browser extension WebSockets** — any extension using WS also fails

The web page loads fine (HTTP works), but every dynamic real-time feature is dead.

## What Changes

1. **Rewrite WebSocket upgrade handling in the Cloudflare Worker** (`quant-proxy/src/index.ts`) to use `WebSocketPair` instead of `fetch()`, with proper bidirectional message piping and header preservation for `Upgrade`, `Sec-WebSocket-Key`, and `Sec-WebSocket-Version`.
2. **Configure Vite HMR** (`web/vite.config.ts`) to explicitly set `server.hmr` so the HMR client connects via `quant.membran.app` rather than trying `localhost:8911` from the browser.
3. **Minor cleanup**: Ensure the Worker routes WebSocket traffic to port `:8911` (Vite dev server) which proxies `/ws` to the API Gateway on `:8910` — no architectural changes to the existing API Gateway or frontend WebSocket hooks.

No changes to:

- The API Gateway WebSocket handler (`src/api/websocket.ts`, `src/api/index.ts`) — works perfectly when reached directly
- The frontend `useTerminalWebSocket.ts` hook — constructs the correct URL
- Any quant engine, database, or trading logic

## Capabilities

### New Capabilities

- `cloudflare-worker-ws-proxy`: Proper WebSocket upgrade proxying in the `quant-proxy` Cloudflare Worker, supporting bidirectional message relay between browser clients and the origin Vite+API Gateway stack.

### Modified Capabilities

- (none — this is a new infra capability, not a requirement change to existing specs)

## Impact

- **`/home/ubuntu/projects/quant-proxy/src/index.ts`**: Core WebSocket upgrade handling rewritten
- **`/home/ubuntu/projects/quant.maftia.tech/web/vite.config.ts`**: HMR configuration added
- **Existing spec `websocket-realtime-broadcaster`**: Unchanged — the API Gateway WebSocket behavior is identical; only the proxy transport is fixed
- **All 4 studios** (Valuation, LTTD, MTTD, Ichimoku): Unchanged files but gain functional real-time data via `/ws/live`

## Non-goals

- No changes to the API Gateway WebSocket handler, its port (`:8910`), routes, or broadcast logic
- No changes to the `useTerminalWebSocket.ts` hook, its reconnection logic, or `WS_URL` construction
- No changes to any quant engine, database, or subsystem pipeline
- No changes to existing specs (`websocket-realtime-broadcaster`, `terminal-state-and-websocket-sync`)
- The `quant-technical-indicator-bank` remains untouched and deprecated
