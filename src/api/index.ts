import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

export const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.get('/', (c) => {
  return c.json({
    service: 'Unified Quantitative & Statistical Bitcoin Intelligence API Gateway',
    status: 'active',
    port: 8765,
    docs: '/api/v1/health'
  })
})

export default {
  port: 8765,
  hostname: '0.0.0.0',
  fetch: app.fetch,
}
