## Why

As `quant.maftia.tech` consolidates four independent quantitative Bitcoin trading systems into a single enterprise-grade defense and financial terminal, attempting to build or migrate all layers simultaneously creates severe cognitive overhead, circular dependencies, and context bloat. We require a comprehensive Master Roadmap Documentation that serves as the primary architectural phase breakdown. This roadmap establishes the exact multi-phase engineering trajectory that will subsequently be decomposed into highly focused, atomic OpenSpec proposals (`/opsx:propose`) for each system layer.

## What Changes

- **Establish Master Multi-Phase Trajectory**: Create the authoritative roadmap documentation structuring the unifications across 4 interlocking systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`).
- **Define OpenSpec Phase Breakdown**: Partition the end-to-end platform architecture into 4 distinct, sequential phases that can be executed independently by AI coding agents without context rot:
  - **Phase 1 (Data & Storage Layer)**: Canonical `MasterOHLCV` ingestion, SQLite WAL mode enforcement (`maftia_quant.db`), and `CausalFilter` ($t-1$ verification).
  - **Phase 2 (Quant Engines & Circuit Breakers)**: Interlocking core math (`ValuationComposite` bubble/discount overrides, `LTTDRegime` 3-State Gaussian HMM sideways override forcing `0.0` exposure, `MTTDIntegratedOscillator` 10-family consensus, and `IchimokuDenoisedOscillator` Ehlers SuperSmoother IIR).
  - **Phase 3 (Unified API Gateway Layer)**: Single Hono v4 + Bun backend service on port `:8765` (`api.quant.maftia.tech`), serving `UnifiedDailyAnalytics` and `UnifiedComponentSignals`.
  - **Phase 4 (High-End Financial Terminal UI)**: React 19 + Vite + Lightweight Charts v5.2 executive dashboard and 4 deep-dive studios (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`).
- **Establish Inter-Proposal Dependency Graph**: Explicitly map out prerequisite dependencies so future OpenSpec changes (`/opsx:apply`) execute in strict causal and structural sequence.

## Capabilities

### New Capabilities
- `master-roadmap-phases`: Overarching phase breakdown, milestones, and governance rules across the 4 unified quantitative systems to guide subsequent OpenSpec delta proposals.
- `data-ingestion-and-wal-pipeline`: Consolidated data ingestion pipeline (`MasterOHLCV`, exchange feeds, `bitview.space` BRK metrics) into `UnifiedDailyAnalytics` enforced by SQLite Write-Ahead Logging (`WAL`) mode and zero lookahead bias (`CausalFilter`).
- `unified-api-gateway-routes`: High-performance Hono v4 + Bun API Gateway (`api.quant.maftia.tech` / port `:8765`) serving consolidated macro scores and component signals (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`).
- `executive-terminal-and-sandboxes`: Production-grade React 19 + Vite frontend platform with 4 specialized studios, enforcing strict `85px` right Y-axis width lock and real-time Vertical Crosshair Synchronization across all subplots.

### Modified Capabilities
- (No existing spec capabilities modified; all are introduced as fresh unified capabilities).

## Impact

- **Affected Systems**: All 4 unified quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`), along with the root orchestrator (`run_report_pipeline.py`) and unified database schema (`maftia_quant.db`).
- **Quantitative & Causal Integrity**: All phase specifications strictly mandate zero lookahead bias (`CausalFilter` ensuring strict $t-1$ historical alignment) across rolling calculations, normalizations (`[-2.0, +2.0]` and `[-1.0, +1.0]`), and regime classifications (`BULL`, `BEAR`, `SIDEWAYS`).
- **Concurrency & Performance**: All database connectors transition to parameterized queries (`?-style`) with SQLite WAL enabled, eliminating database lock contention during concurrent background data pipeline runs and API querying.

## Non-goals

- We will **not** reference, document, or re-introduce the legacy `quant-technical-indicator-bank` (`05. Indicator Bank`) project. It is explicitly deprecated and out of scope.
- We will **not** spin up ad-hoc temporary backend servers on random ports (`:3000`, `:8766`, etc.) in production or local phase deployments; all traffic routes strictly through `:8765`.
- We will **not** execute simultaneous multi-system code mutations inside this single roadmap change; this change purely architects and generates the Master Roadmap and Phase Specifications to unlock granular future OpenSpec proposals.
