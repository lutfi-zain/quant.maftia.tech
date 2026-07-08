import { WebSocketServer, WebSocket } from 'ws'
import { executeQuerySingle, executeQuery } from './db.js'

export interface ClientConnection {
  id: string
  topics: Set<string>
  lastPong: number
  send: (data: string) => void
  close: () => void
}

const activeClients = new Map<string, ClientConnection>()

// Broadcast helper for pushing real-time updates across subscribed topics
export function broadcastEvent(topic: string, eventType: string, payload: any): number {
  let sentCount = 0
  const message = JSON.stringify({
    event: eventType,
    topic,
    timestamp: new Date().toISOString(),
    data: payload
  })

  for (const client of activeClients.values()) {
    if (client.topics.has(topic) || client.topics.has('*')) {
      try {
        client.send(message)
        sentCount++
      } catch (err) {
        console.error(`Error sending broadcast to client ${client.id}:`, err)
        client.close()
      }
    }
  }
  return sentCount
}

// Fetch topic snapshots for immediate transmission upon subscription
export function getTopicSnapshot(topic: string): any {
  const today = new Date().toISOString().split('T')[0]

  if (topic === 'system:circuit-breakers') {
    const row = executeQuerySingle<any>(`
      SELECT date, valuation_composite, lttd_regime, lttd_prob_sideways
      FROM unified_daily_analytics
      WHERE date <= ?
      ORDER BY date DESC LIMIT 1
    `, [today])

    if (!row) return { active: false, message: 'No data' }

    const valScore = row.valuation_composite ?? 0
    const lttdRegime = row.lttd_regime ?? 'UNKNOWN'
    const probSideways = row.lttd_prob_sideways ?? 0

    return {
      as_of_date: row.date,
      bubble_warning: valScore >= 1.50,
      deep_discount_override: valScore <= -1.00,
      sideways_zero_exposure_lock: lttdRegime === 'SIDEWAYS' && probSideways > 0.60,
      current_valuation_score: valScore,
      current_lttd_regime: lttdRegime,
      current_prob_sideways: probSideways
    }
  }

  if (topic === 'analytics:daily') {
    const rows = executeQuery<any>(`
      SELECT 
        u.date, m.open, m.high, m.low, m.close, m.volume,
        u.btc_price, u.valuation_composite, u.lttd_regime, u.mttd_imo, u.ichimoku_imo
      FROM unified_daily_analytics u
      LEFT JOIN master_ohlcv m ON u.date = m.date
      WHERE u.date <= ?
      ORDER BY u.date DESC LIMIT 1
    `, [today])
    return rows[0] || null
  }

  if (topic === 'component:signals') {
    const rows = executeQuery<any>(`
      SELECT date, system_source, component_name, raw_value, normalized_score, signal_direction
      FROM unified_component_signals
      WHERE date <= ?
      ORDER BY date DESC LIMIT 5
    `, [`${today}Z`])
    return rows
  }

  return { message: `Subscribed to ${topic}` }
}

// Handle incoming messages from clients (subscribe, unsubscribe, pong)
export function handleClientMessage(client: ClientConnection, rawMessage: string) {
  try {
    const msg = JSON.parse(rawMessage)
    if (msg.action === 'subscribe' && Array.isArray(msg.topics)) {
      for (const topic of msg.topics) {
        client.topics.add(topic)
        // Immediately transmit snapshot upon subscription
        const snapshot = getTopicSnapshot(topic)
        client.send(JSON.stringify({
          event: 'snapshot',
          topic,
          timestamp: new Date().toISOString(),
          data: snapshot
        }))
      }
      client.send(JSON.stringify({
        event: 'subscribed',
        topics: Array.from(client.topics),
        timestamp: new Date().toISOString()
      }))
    } else if (msg.action === 'unsubscribe' && Array.isArray(msg.topics)) {
      for (const topic of msg.topics) {
        client.topics.delete(topic)
      }
      client.send(JSON.stringify({
        event: 'unsubscribed',
        topics: Array.from(client.topics),
        timestamp: new Date().toISOString()
      }))
    } else if (msg.action === 'pong') {
      client.lastPong = Date.now()
    }
  } catch (err) {
    client.send(JSON.stringify({
      event: 'error',
      message: 'Invalid JSON message payload structure'
    }))
  }
}

// Node / ws server instance
export const wsServer = new WebSocketServer({ noServer: true })

wsServer.on('connection', (socket: WebSocket, request: any) => {
  const id = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const client: ClientConnection = {
    id,
    topics: new Set(),
    lastPong: Date.now(),
    send: (data: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data)
      }
    },
    close: () => {
      try { socket.terminate() } catch (_) {}
      activeClients.delete(id)
    }
  }

  activeClients.set(id, client)

  socket.on('message', (message: Buffer | string) => {
    client.lastPong = Date.now()
    handleClientMessage(client, message.toString())
  })

  socket.on('pong', () => {
    client.lastPong = Date.now()
  })

  socket.on('close', () => {
    activeClients.delete(id)
  })

  socket.on('error', () => {
    activeClients.delete(id)
  })

  // Send initial welcome handshake
  client.send(JSON.stringify({
    event: 'connected',
    client_id: id,
    service: 'Unified API Gateway WebSocket Stream',
    supported_topics: [
      'system:circuit-breakers',
      'analytics:daily',
      'component:signals'
    ],
    timestamp: new Date().toISOString()
  }))
})

// Periodic heartbeat ping/pong (interval: 30000ms) and 60-second stale cleanup
const heartbeatInterval = setInterval(() => {
  const now = Date.now()
  for (const [id, client] of activeClients.entries()) {
    if (now - client.lastPong > 60000) {
      console.log(`🧹 Terminating stale WebSocket client ${id} (missed pong > 60s)`)
      client.close()
    } else {
      try {
        client.send(JSON.stringify({ event: 'ping', timestamp: now }))
      } catch (_) {
        client.close()
      }
    }
  }
}, 30000)

// Dual runtime Bun websocket handlers wrapper
export const bunWebSocketHandlers = {
  open(ws: any) {
    const id = `bun-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    ws.data = { id, topics: new Set(), lastPong: Date.now() }
    const client: ClientConnection = {
      id,
      topics: ws.data.topics,
      lastPong: ws.data.lastPong,
      send: (data: string) => ws.send(data),
      close: () => {
        try { ws.close() } catch (_) {}
        activeClients.delete(id)
      }
    }
    activeClients.set(id, client)
    ws.send(JSON.stringify({
      event: 'connected',
      client_id: id,
      service: 'Unified API Gateway WebSocket Stream',
      supported_topics: ['system:circuit-breakers', 'analytics:daily', 'component:signals'],
      timestamp: new Date().toISOString()
    }))
  },
  message(ws: any, message: string) {
    const id = ws.data?.id
    const client = activeClients.get(id)
    if (client) {
      client.lastPong = Date.now()
      handleClientMessage(client, typeof message === 'string' ? message : message.toString())
    }
  },
  close(ws: any) {
    if (ws.data?.id) activeClients.delete(ws.data.id)
  }
}
