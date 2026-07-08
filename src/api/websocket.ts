import { WebSocketServer } from 'ws'

export const wsServer = new WebSocketServer({ noServer: true })

wsServer.on('connection', (socket, request) => {
  socket.send(JSON.stringify({
    event: 'connected',
    service: 'Unified API Gateway WebSocket Stream',
    timestamp: new Date().toISOString()
  }))
})
