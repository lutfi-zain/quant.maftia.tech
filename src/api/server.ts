import { serve } from '@hono/node-server'
import { app } from './index.js'
import { wsServer } from './websocket.js'

const port = 8765

console.log(`=== STARTING HONO v4 API GATEWAY (NODE/TSX RUNTIME) ON PORT ${port} ===`)

const server = serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
})

// Attach WebSocket handler if running under Node http server
server.on('upgrade', (request, socket, head) => {
  if (request.url?.includes('/ws/')) {
    wsServer.handleUpgrade(request, socket, head, (ws) => {
      wsServer.emit('connection', ws, request)
    })
  }
})

console.log(`✅ Hono v4 + WebSocket API Gateway active at http://0.0.0.0:${port}`)
