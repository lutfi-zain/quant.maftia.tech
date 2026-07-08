## Why

With Phase 1 (Data & WAL Pipeline) and Phase 2 (Quantitative System Unification & Orchestration) fully deployed and verified, the quantitative platform now maintains a consolidated relational database (`maftia_quant.db`) with 6,391+ causal daily records (`UnifiedDailyAnalytics`) and 128,430+ granular indicator records (`UnifiedComponentSignals`). However, frontend executive studios (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) and external analytics clients currently lack a high-performance, unified access layer and instead rely on fragmented ad-hoc servers or raw database inspection. Phase 3 establishes a single, production-grade Hono v4 + Bun API Gateway (`api.quant.maftia.tech:8765`) with strict SQLite WAL concurrency to serve consolidated REST queries and real-time WebSocket broadcasts without lock contention or lookahead bias.

## What Changes

- **Consolidated API Gateway Architecture**: Establish and enforce the single Hono v4 + Bun gateway on port `:8765` (`api.quant.maftia.tech`), deprecating and blocking ad-hoc temporary backend servers (`:3000`, `:8766`).
- **Standardized REST Endpoints for Consolidated Analytics**: Implement `/api/v1/analytics/daily` and `/api/v1/analytics/components` endpoints with `?-style` parameterized queries over SQLite WAL connections, returning exact domain entities (`MasterOHLCV`, `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`).
- **Real-Time Circuit Breaker Route (`/api/v1/system/circuit-breakers`)**: Expose instant macro defense flags (`bubble_warning`, `deep_discount_override`, `sideways_zero_exposure_lock`) derived from `ValuationComposite` ($\ge +1.50$ or $\le -1.00$) and `LTTDRegime` (`SIDEWAYS` probability $> 0.60$).
- **Live WebSocket Streaming (`/ws/v1/stream`)**: Add WebSocket broadcasting on the Hono gateway to push real-time circuit breaker status updates and new daily bar completions directly to connected client sandboxes.
- **Strict $t-1$ Causal Verification Guardrail**: Enforce strict query-time date bounds ($date \le \text{today}$) across all API responses to ensure zero lookahead bias when exposing historical series.

## Capabilities

### New Capabilities
- `websocket-realtime-broadcaster`: Real-time WebSocket server route (`/ws/v1/stream`) embedded within the Hono v4 + Bun API Gateway that broadcasts live quantitative circuit breaker state changes and daily bar sync notifications to subscribed frontend terminal subplots.

### Modified Capabilities
- `unified-api-gateway-routes`: Expand existing gateway requirements to specify exact route contracts (`/api/v1/analytics/daily`, `/api/v1/analytics/components`, `/api/v1/system/circuit-breakers`), mandatory `?-style` parameterized SQL execution over `maftia_quant.db` using SQLite WAL mode, and strict causal timestamp validation.

## Impact

- **Impacted Systems**: Directly exposes consolidated data produced by all 4 unified quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`).
- **Orchestration & Database**: Connects directly to `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db` (`unified_daily_analytics` and `unified_component_signals` tables) in read-only WAL mode.
- **Runtime Environment**: Requires Bun v1.0+ runtime (`/home/ubuntu/.bun/bin/bun` or `bun`) and Hono v4 framework.
- **Frontend Clients**: Prepares clean, standardized JSON and WebSocket data contracts consumed by the Phase 4 High-End Financial Terminal SPA (`React 19 + Vite + Lightweight Charts v5.2`).

## Non-goals

- **Out of Scope for Phase 3**: Frontend UI development (`React 19 + Vite` executive dashboard and 4 deep-dive sandboxes) is strictly out of scope and reserved for Phase 4.
- **Deprecated Component Exclusivity**: Under no circumstances will this phase reference, import, or re-introduce the deprecated `quant-technical-indicator-bank` (`05. Indicator Bank`) system or its legacy indicator structures.
