## 1. Worker WebSocket Proxy — Core Implementation

- [x] 1.1 Rewrite the WebSocket upgrade handler in `quant-proxy/src/index.ts` to detect `Upgrade: websocket` and use the `WebSocketPair` API instead of `fetch()`
- [x] 1.2 Establish a backend WebSocket connection to `ws://43.133.148.181.sslip.io:8911{path}` preserving the original request path and query parameters
- [x] 1.3 Implement bidirectional message relay: pipe `message` events from client WebSocket to backend WebSocket and vice versa
- [x] 1.4 Implement lifecycle management: handle `close` events (propagate close code/reason), `error` events (clean close of both sides), and ensure `server.accept()` / `backend.accept()` are called

## 2. Worker WebSocket Proxy — Header Handling

- [x] 2.1 Ensure WebSocket-specific headers (`Upgrade`, `Sec-WebSocket-Key`, `Sec-WebSocket-Version`, `Sec-WebSocket-Extensions`, `Connection`) are included when establishing the backend WebSocket connection
- [x] 2.2 Verify that the existing safe-header allowlist continues to filter HTTP requests correctly (no regression)

## 3. Vite HMR Configuration

- [x] 3.1 Add `server.hmr` configuration to `web/vite.config.ts`:

  ```ts
  server: {
    hmr: {
      host: 'quant.membran.app',
      port: 443,
      protocol: 'wss',
    },
    // ...existing config
  }
  ```

## 4. Verification

- [x] 4.1 Deploy the updated Worker: run `wrangler deploy` from `quant-proxy/` — **needs CLOUDFLARE_API_TOKEN** (set via env or `wrangler login`)
- [ ] 4.2 Verify WebSocket connection to `wss://quant.membran.app/ws/live` succeeds by testing from the browser console or a WebSocket client
- [ ] 4.3 Verify Vite HMR WebSocket connects successfully (no `[vite] failed to connect to websocket` error in browser console)
- [ ] 4.4 Verify existing HTTP API routes still work through the proxy (`/api/v1/health`, `/api/v1/quant/daily`, etc.)
- [ ] 4.5 Verify real-time data flow: subscribe to `analytics:daily` topic and confirm messages arrive
