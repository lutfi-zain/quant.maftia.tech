# WebSocket Realtime Broadcaster

## Purpose
Defines requirements for real-time multiplexed WebSocket streaming (`/ws/v1/stream`), circuit breaker state broadcasting, and heartbeat liveness maintenance inside the Hono v4 + Bun API Gateway (`:8765`).

## Requirements

### Requirement: WebSocket Multiplexed Streaming Route
The Hono v4 + Bun API Gateway SHALL expose a real-time WebSocket connection route at `/ws/v1/stream` leveraging native Bun WebSocket handling (`bun:ws`) to broadcast quantitative updates to connected clients without ad-hoc port proliferation (`:8765` only).

#### Scenario: Client WebSocket subscription handshake
- **WHEN** a frontend studio client establishes a WebSocket connection to `ws://api.quant.maftia.tech:8765/ws/v1/stream` and sends a subscription message `{"action": "subscribe", "topics": ["system:circuit-breakers", "analytics:daily"]}`
- **THEN** the API Gateway MUST acknowledge the subscription and immediately transmit the current active circuit breaker state and latest daily analytical bar

### Requirement: Real-Time Circuit Breaker Override Broadcasts
The WebSocket server SHALL broadcast instant state notifications whenever `run_report_pipeline.py` updates `maftia_quant.db` resulting in a circuit breaker change across `ValuationComposite` ($\ge +1.50$ bubble risk or $\le -1.00$ deep discount) or `LTTDRegime` (`SIDEWAYS` probability $> 0.60$ forcing `0.0` mid-term trend exposure).

#### Scenario: Push notification on LTTD sideways macro override activation
- **WHEN** `run_report_pipeline.py` upserts a daily bar where `LTTDRegime == 'SIDEWAYS'` and `lttd_prob_sideways > 0.60` forcing `mttd_position = 0.0` and `ichimoku_position = 0.0`
- **THEN** the WebSocket server MUST broadcast an event `{"event": "circuit_breaker_update", "type": "sideways_zero_exposure_lock", "active": true, "timestamp": "<date>"}` to all subscribed clients

### Requirement: WebSocket Connection Heartbeat and Liveness Maintenance
The WebSocket route SHALL implement periodic heartbeat ping/pong frames (`interval: 30000ms`) to detect stale client connections and cleanly release server memory.

#### Scenario: Stale socket cleanup after missed heartbeats
- **WHEN** a connected client fails to respond to server ping frames within 60 seconds
- **THEN** the API Gateway MUST terminate the underlying socket connection and deregister the client from all broadcast topic queues
