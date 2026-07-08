# Terminal State and WebSocket Synchronization

## Purpose
Defines requirements for real-time WebSocket state connections (`ws://0.0.0.0:8765/ws/live`), automatic reconnection with exponential backoff, zero-polling live broadcasts, and institutional-grade Obsidian HSL design token enforcement across the frontend quantitative terminal (`/web`).

## Requirements

### Requirement: Real-Time WebSocket State Connection (`useTerminalWebSocket`)
The frontend terminal SHALL maintain an active WebSocket connection via a custom React hook (`useTerminalWebSocket`) connecting directly to `ws://0.0.0.0:8765/ws/live` to receive instant updates for `UnifiedDailyAnalytics` and `CircuitBreakerFilter` status.

#### Scenario: Live analytics broadcast reception
- **WHEN** the backend API Gateway emits an `analytics_update` or `circuit_breaker_trip` payload over WebSocket
- **THEN** the `useTerminalWebSocket` hook MUST intercept the payload and automatically update the React context state, refreshing the bento grid cards and chart indicators in real-time without executing a polling loop

#### Scenario: Exponential backoff reconnection
- **WHEN** the WebSocket connection is interrupted due to network jitter or backend restart
- **THEN** the hook MUST attempt automatic reconnection using exponential backoff (up to a maximum delay of 10 seconds) while indicating connection status (`Connected`, `Reconnecting`, `Disconnected`) in the terminal header

### Requirement: Obsidian HSL Design Token System
The terminal SHALL define and enforce an Obsidian HSL design system inside `index.css` using CSS custom variables to guarantee high-end, institutional-grade visual aesthetics.

#### Scenario: Visual theme token enforcement
- **WHEN** UI components and bento grid cards are rendered
- **THEN** all components MUST reference design system variables (`--bg-primary: #0b0e14`, `--surface-card: #111622`, `--text-main: #f1f5f9`, `--accent-cyan: #00f0ff`, `--accent-gold: #ffb800`, `--status-danger: #ff2a5f`) without relying on ad-hoc or generic inline styles
