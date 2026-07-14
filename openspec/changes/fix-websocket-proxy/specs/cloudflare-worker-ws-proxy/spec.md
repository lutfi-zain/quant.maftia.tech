# Cloudflare Worker WebSocket Proxy

## Purpose

Defines requirements for the `quant-proxy` Cloudflare Worker to correctly proxy WebSocket upgrade connections to the origin Vite dev server + API Gateway stack, enabling real-time bidirectional broadcasts to connected clients.

## ADDED Requirements

### Requirement: WebSocket Upgrade Detection and Routing

The `quant-proxy` Cloudflare Worker SHALL detect incoming WebSocket upgrade requests (HTTP method GET with `Upgrade: websocket` header) and route them to the origin as proper WebSocket connections, preserving the full request path.

#### Scenario: Client establishes WebSocket to /ws/live

- **WHEN** a browser client sends a WebSocket upgrade request to `wss://quant.membran.app/ws/live` with valid `Upgrade`, `Sec-WebSocket-Key`, `Sec-WebSocket-Version`, and `Connection` headers
- **THEN** the Worker SHALL establish a WebSocket connection to `ws://43.133.148.181.sslip.io:8911/ws/live` and return a `101 Switching Protocols` response to the client

#### Scenario: Client establishes WebSocket to root (Vite HMR)

- **WHEN** the Vite HMR client sends a WebSocket upgrade request to `wss://quant.membran.app/` with query parameters and valid WebSocket headers
- **THEN** the Worker SHALL establish a WebSocket connection to `ws://43.133.148.181.sslip.io:8911/` (preserving query parameters) and return a `101 Switching Protocols` response to the client

### Requirement: Bidirectional Message Relay

The Worker SHALL relay WebSocket messages bidirectionally between the client and the origin for the lifetime of the connection.

#### Scenario: Client sends subscription message to /ws/live

- **WHEN** a client sends a JSON message `{"action": "subscribe", "topics": ["analytics:daily"]}` over the established WebSocket
- **THEN** the Worker SHALL forward the message to the origin WebSocket unchanged

#### Scenario: Origin broadcasts analytics update to client

- **WHEN** the API Gateway sends a JSON message `{"event": "snapshot", "topic": "analytics:daily", ...}` over the origin WebSocket
- **THEN** the Worker SHALL forward the message to the client WebSocket unchanged

### Requirement: WebSocket Header Preservation

When proxying WebSocket upgrade requests, the Worker SHALL preserve all WebSocket-specific headers (`Upgrade`, `Sec-WebSocket-Key`, `Sec-WebSocket-Version`, `Sec-WebSocket-Extensions`, `Connection`) in addition to the standard safe-header allowlist.

#### Scenario: WebSocket handshake header forwarding

- **WHEN** the Worker detects a WebSocket upgrade request containing `Upgrade: websocket`, `Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==`, `Sec-WebSocket-Version: 13`, and `Connection: Upgrade`
- **THEN** the Worker SHALL include all of these headers when establishing the origin WebSocket connection, allowing the origin to complete the handshake successfully

### Requirement: WebSocket Connection Lifecycle Management

The Worker SHALL handle WebSocket connection lifecycle events: open, close, and error, with appropriate cleanup.

#### Scenario: Client disconnects gracefully

- **WHEN** the client closes the WebSocket connection (normal closure, code 1000)
- **THEN** the Worker SHALL close the origin WebSocket connection with the same close code and reason

#### Scenario: Origin connection fails

- **WHEN** the Worker cannot establish a WebSocket connection to the origin (e.g., origin is unreachable)
- **THEN** the Worker SHALL close the client WebSocket with an appropriate error code and NOT return a 101 response

#### Scenario: WebSocket error recovery

- **WHEN** either the client or origin WebSocket encounters an unexpected error
- **THEN** the Worker SHALL close the other side of the connection to prevent resource leaks

### Requirement: HTTP Request Forwarding (unchanged behavior)

For non-WebSocket requests (regular HTTP GET/POST/etc.), the Worker SHALL continue to proxy using `fetch()` with the existing header allowlist filtering, maintaining backward compatibility with all existing HTTP API routes.

#### Scenario: API request forwarded correctly

- **WHEN** a client sends an HTTP GET to `https://quant.membran.app/api/v1/system/circuit-breakers`
- **THEN** the Worker SHALL proxy the request using `fetch()` to `http://43.133.148.181.sslip.io:8911/api/v1/system/circuit-breakers` and return the API response to the client
