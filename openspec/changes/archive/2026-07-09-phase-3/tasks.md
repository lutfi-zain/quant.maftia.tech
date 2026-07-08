## 1. Hono v4 + Bun Gateway & SQLite WAL Connection Setup

- [x] 1.1 Scaffold the Hono v4 + Bun API Gateway structure under `/home/ubuntu/projects/quant.maftia.tech/src/api/` (or `src/gateway/`) with exact port configuration (`port: 8765`, hostname `api.quant.maftia.tech`). Commit via Conventional Commits (`feat: initialize hono v4 bun api gateway project structure`).
- [x] 1.2 Implement `db.ts` connection manager utilizing native `bun:sqlite` to open `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db` in read-only mode with SQLite Write-Ahead Logging multi-reader concurrency (`PRAGMA journal_mode=WAL; PRAGMA query_only=true;`). Commit via Conventional Commits (`feat: implement sqlite wal read-only connection manager in bun`).
- [x] 1.3 Implement gateway health check and metadata route (`GET /api/v1/health`) to confirm database reachability and verify the maximum timestamp present in `UnifiedDailyAnalytics`. Commit via Conventional Commits (`feat: add api gateway health and metadata route`).

## 2. REST Controllers & Causal Verification Layer

- [x] 2.1 Implement `/api/v1/analytics/daily` REST endpoint executing `?-style` parameterized SQL queries against `unified_daily_analytics` with strict $t-1$ `CausalFilter` verification ($date \le \text{today}$) returning canonical entity fields (`MasterOHLCV`, `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`). Commit via Conventional Commits (`feat: implement daily analytics rest endpoint with causal verification`).
- [x] 2.2 Implement `/api/v1/analytics/components` REST endpoint executing `?-style` parameterized SQL queries against `unified_component_signals` (`VALUATION`, `LTTD`, `MTTD` component series) filtered by `system_source` and `date`. Commit via Conventional Commits (`feat: implement component signals rest endpoint`).
- [x] 2.3 Implement `/api/v1/system/circuit-breakers` REST endpoint broadcasting current macro defense flags (`bubble_warning`, `deep_discount_override`, `sideways_zero_exposure_lock`) derived from `ValuationComposite` ($\ge +1.50$ or $\le -1.00$) and `LTTDRegime` (`SIDEWAYS` probability $> 0.60$). Commit via Conventional Commits (`quant: implement circuit breaker status rest endpoint`).

## 3. WebSocket Streaming Route (`/ws/v1/stream`)

- [x] 3.1 Implement multiplexed WebSocket route (`/ws/v1/stream`) using native `bun:ws` handler supporting client topic subscriptions (`system:circuit-breakers`, `analytics:daily`, `component:signals`). Commit via Conventional Commits (`feat: implement websocket stream route with topic subscription`).
- [x] 3.2 Implement event broadcasting logic and periodic heartbeat ping/pong (`interval: 30000ms`) to push real-time circuit breaker status updates and clean up stale client connections after 60 seconds. Commit via Conventional Commits (`feat: add websocket heartbeat and live event broadcasting`).

## 4. Verification & Regression Testing

- [x] 4.1 Execute `python3 /home/ubuntu/projects/run_report_pipeline.py` to confirm database integrity and ensure no lock contention occurs when the Python sync process writes to `maftia_quant.db` while Bun reads in WAL mode.
- [x] 4.2 Execute a concurrent reader test (`curl -s http://localhost:8765/api/v1/health` while `python3 /home/ubuntu/projects/run_report_pipeline.py` is running) to ensure zero SQLite `OperationalError: database is locked` failures occur. Commit any regression fixes or test additions via Conventional Commits (`test: verify concurrent wal read-write behavior across python and bun`).
