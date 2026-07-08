import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { healthRouter } from './routes/health.js'
import { dailyRouter } from './routes/daily.js'
import { componentsRouter } from './routes/components.js'
import { circuitBreakersRouter } from './routes/circuit-breakers.js'

export const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.route('/api/v1/health', healthRouter)
app.route('/api/v1/analytics/daily', dailyRouter)
app.route('/api/v1/analytics/components', componentsRouter)
app.route('/api/v1/system/circuit-breakers', circuitBreakersRouter)

app.get('/', (c) => {
  return c.json({
    service: 'Unified Quantitative & Statistical Bitcoin Intelligence API Gateway',
    status: 'active',
    port: 8765,
    docs: '/api/v1/health'
  })
})

import { bunWebSocketHandlers } from './websocket.js'

export default {
  port: 8765,
  hostname: '0.0.0.0',
  fetch(req: Request, server: any) {
    if (new URL(req.url).pathname.startsWith('/ws/')) {
      const id = `bun-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      if (server.upgrade(req, { data: { id, topics: new Set(), lastPong: Date.now() } })) {
        return undefined
      }
      return new Response('WebSocket upgrade failed', { status: 400 })
    }
    return app.fetch(req, server)
  },
  websocket: bunWebSocketHandlers,
}
