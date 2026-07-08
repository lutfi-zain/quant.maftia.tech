## Context

Following the completion of Phase 1 (Data Ingestion & WAL Pipeline) and Phase 2 (Quantitative System Unification & Orchestration), all 4 quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`) persist their canonical daily outputs into `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db` using SQLite Write-Ahead Logging (`WAL`). Currently, querying these consolidated metrics (`UnifiedDailyAnalytics` and `UnifiedComponentSignals`) requires raw Python SQL scripts or fragmented legacy servers (`:3000`). To support the unified high-end financial terminal and external strategy clients without lock contention or ad-hoc port proliferation, Phase 3 designs the single canonical Hono v4 + Bun API Gateway (`api.quant.maftia.tech:8765`).

## Goals / Non-Goals

**Goals:**
- Establish a single Hono v4 + Bun API Gateway server executing on port `:8765` (`api.quant.maftia.tech`).
- Implement high-concurrency, read-only SQLite WAL connections to `maftia_quant.db` utilizing exact `?-style` parameterized SQL queries to prevent SQL injection and lock contention.
- Build standardized REST routes (`/api/v1/analytics/daily`, `/api/v1/analytics/components`, `/api/v1/system/circuit-breakers`) delivering structured JSON payloads aligned with ubiquitous domain entities (`MasterOHLCV`, `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`).
- Build a real-time WebSocket broadcasting route (`/ws/v1/stream`) to publish instant quantitative circuit breaker overrides (`bubble_warning`, `deep_discount_override`, `sideways_zero_exposure_lock`) and new daily bar completions.
- Enforce strict $t-1$ `CausalFilter` verification on query bounds ($date \le \text{today}$) to eliminate lookahead bias across all data feeds.

**Non-Goals:**
- **Out of Scope**: Frontend UI development (`React 19 + Vite` executive dashboard and 4 deep-dive sandboxes with `Lightweight Charts v5.2` and `85px` Y-axis lock) is reserved for Phase 4.
- **Out of Scope**: Modification of historical math engines or indicator formulas.
- **Strictly Prohibited**: Any reference, import, or re-introduction of the deprecated `quant-technical-indicator-bank` (`05. Indicator Bank`) system.

## Decisions

### 1. Single API Gateway (`Hono v4 + Bun` on port `:8765`) over Ad-Hoc Microservices
- **Decision**: Route all quantitative data queries and live streaming strictly through one Hono v4 + Bun instance on `:8765`.
- **Rationale**: Hono v4 running on Bun provides ultra-low latency HTTP request handling, built-in WebSocket support via `bun:sqlite` / `bun:ws`, and zero cold-start overhead. It eliminates port collision and CORS issues caused by spinning up ad-hoc temporary servers on random ports (`:3000`, `:8766`).
- **Alternatives Considered**: Fastify on Node.js or FastAPI on Python. Bun + Hono selected for superior request throughput and seamless TypeScript sharing with the Phase 4 frontend.

### 2. Native `bun:sqlite` with WAL Read Concurrency over Heavy ORMs
- **Decision**: Use native `bun:sqlite` with `?-style` parameterized queries and `PRAGMA journal_mode=WAL;` / `PRAGMA query_only=true;`.
- **Rationale**: ORMs (e.g., Prisma or TypeORM) introduce abstraction overhead and complex migration states for pre-populated SQLite files (`maftia_quant.db`). Native `bun:sqlite` operates directly in C++ memory space, offering microsecond-level query response times while respecting SQLite WAL multi-reader locks.
- **Alternatives Considered**: Python HTTP bridge proxy or Prisma ORM.

### 3. Unified WebSocket Stream (`/ws/v1/stream`) with Event-Driven Broadcast Architecture
- **Decision**: Implement a single multiplexed WebSocket endpoint (`/ws/v1/stream`) where clients subscribe to specific topics (`system:circuit-breakers`, `analytics:daily`, `component:signals`).
- **Rationale**: When `run_report_pipeline.py` finishes a daily or weekly synchronization run, the API Gateway detects database updates (via file watch or internal IPC trigger) and broadcasts structured JSON event payloads to all active terminal subscribers. This ensures all subplots (`85px` Y-axis locked charts) receive synchronized updates simultaneously without polling.

## Risks / Trade-offs

- **[Risk: SQLite Database File Access Permissions under Bun]** → **Mitigation**: Ensure `maftia_quant.db` and its `-wal` / `-shm` files have appropriate read/write group permissions (`664` / `775`) for both the Python pipeline process and the Bun gateway process.
- **[Risk: WebSocket Connection Drops on High-Concurrency Broadcasts]** → **Mitigation**: Implement automated heartbeat ping/pong (`interval: 30000ms`) and client-side exponential backoff reconnection protocols within the WebSocket server handler.

## Migration Plan

1. Scaffold gateway directory at `/home/ubuntu/projects/quant.maftia.tech/src/api` (or standalone `gateway` module within the unified repo).
2. Configure `package.json` with `hono`, `@hono/node-server` or native Bun entrypoint, and strict TypeScript rules.
3. Implement `db.ts` wrapper establishing `bun:sqlite` WAL read-only connection to `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db`.
4. Register REST controllers (`/api/v1/analytics/daily`, `/api/v1/analytics/components`, `/api/v1/system/circuit-breakers`) and WebSocket handler (`/ws/v1/stream`).
5. Verify zero lookahead bias and accurate record payloads against Python inspection scripts.
