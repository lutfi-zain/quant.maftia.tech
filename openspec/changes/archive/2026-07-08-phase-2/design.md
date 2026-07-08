## Context

The `quant.maftia.tech` repository serves as the authoritative implementation of the 4-System Multi-Layered Quantitative Defense & High-End Financial Terminal for Bitcoin. Phase 1 (`data-ingestion-and-wal-pipeline`) successfully established the canonical `MasterOHLCV` (`master_ohlcv`) data store and enforced SQLite Write-Ahead Logging (`WAL`) concurrency across `maftia_quant.db` and subsystem databases (`lttd.db`, `metrics.db`).

Currently, the four quantitative engines (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`) run independently when invoked via `run_report_pipeline.py`. While their outputs are formatted into a markdown table (`latest_week_scores_report.md`), the cross-system interlocking rules (`CircuitBreakerFilter` and `LTTDRegime SIDEWAYS` macro override) and relational persistence into `UnifiedDailyAnalytics` (`unified_daily_analytics`) and `UnifiedComponentSignals` (`unified_component_signals`) remain to be systematically formalized and enforced in code and database tables.

Phase 2 closes this gap by implementing canonical mathematical standardizations, cross-system interlocking regime overrides, and unified relational persistence within `run_report_pipeline.py`, creating a rock-solid data and logic foundation for Phase 3 (API Gateway on `:8765`) and Phase 4 (Financial Terminal UI).

## Goals / Non-Goals

**Goals:**
- Unify and verify the bounded calculation outputs across all four quantitative engines:
  1. `ValuationComposite` (`valuation_composite`): piecewise linear interpolated `[-2.0, +2.0]` with macro `CircuitBreakerFilter` (`score >= +1.50` or `<= -1.00`).
  2. `LTTDRegime` (`lttd_regime`): 3-State Gaussian HMM (`BULL`, `BEAR`, `SIDEWAYS`) with explicit posterior probabilities ($P_{\text{Bull}}, P_{\text{Bear}}, P_{\text{Sideways}}$).
  3. `MTTDIntegratedOscillator` (`mttd_imo`): 10 statistical families consensus `[-1.0, +1.0]` with three gates (`EfficiencyRatioGate >= 0.20`, `ShannonEntropyGate <= 2.30`, `ChikouMomentumExit < -0.30`).
  4. `IchimokuDenoisedOscillator` (`ichimoku_imo`): Ehlers 2-pole `SuperSmoother` IIR transfer function and $\tanh$ oscillator `[-1.0, +1.0]`.
- Implement automated cross-system interlocking circuit breakers in orchestration:
  - When `LTTDRegime == SIDEWAYS` ($P_{\text{Sideways}} > 0.60$), force `mttd_position = 0.0` and `ichimoku_position = 0.0` to eliminate mid-term trend-following whipsaw losses.
  - When `ValuationComposite >= +1.50`, restrict new long position entries on mid-term systems.
- Create and populate the relational tables `unified_daily_analytics` and `unified_component_signals` inside `maftia_quant.db` directly within `run_report_pipeline.py` using parameterized queries and SQLite WAL mode.
- Strictly enforce zero lookahead bias via causal filtering ($t-1$ stamp verification) across all rolling windows, HMM inferences, and indicator transformations.

**Non-Goals:**
- No UI/frontend application development or modification (Phase 4 scope; where `Lightweight Charts v5.2` with `85px` right Y-axis width lock and vertical crosshair sync will be constructed).
- No backend REST/WebSocket server implementation (Phase 3 scope; where the single unified Hono v4 + Bun API Gateway on port `:8765` (`api.quant.maftia.tech`) will be implemented without spinning up ad-hoc temporary servers on `:3000` or `:8766`).
- No modifications or re-introductions of the deprecated `quant-technical-indicator-bank` (`05. Indicator Bank`) codebase.

## Decisions

### 1. Centralized Interlocking & Relational Persistence inside `run_report_pipeline.py`
- **Choice:** Implement cross-system override logic (`SIDEWAYS` HMM $\to 0.0$ exposure and `ValuationComposite >= +1.50` circuit breaker) and table upserts (`unified_daily_analytics` & `unified_component_signals`) inside `run_report_pipeline.py` after all subsystem calculations complete.
- **Rationale:** Subsystems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`) should remain focused on their specific domain calculations (`Valuation`, `HMM Regime`, `10-Family Consensus`, `SuperSmoother Tanh`). Centralizing cross-system consensus overrides and consolidated persistence in `run_report_pipeline.py` prevents circular module dependencies while guaranteeing clean transactional execution.
- **Alternatives Considered:** Modifying subsystem code to query other subsystems' SQLite databases during calculation. Rejected because it introduces tight coupling, potential SQLite lock contention, and race conditions during pipeline runs.

### 2. Parameterized SQL with Explicit Column Specification
- **Choice:** All database schema definitions (`CREATE TABLE IF NOT EXISTS unified_daily_analytics (...)` and `CREATE TABLE IF NOT EXISTS unified_component_signals (...)`) and upserts (`INSERT OR REPLACE INTO ...`) must explicitly list all column names and use `?-style` parameterized tuples via `db_connector.execute_parameterized`.
- **Rationale:** As documented in `AGENTS.md` historical session learnings (`2026-07-08`), omitting column names in SQLite `INSERT OR REPLACE INTO` queries causes `OperationalError` when tables contain default or optional timestamp columns (`source`, `fetched_at`). Furthermore, parameterized queries prevent SQL injection and formatting bugs.
- **Alternatives Considered:** ORM integration (e.g., SQLAlchemy). Rejected to maintain lightweight execution, zero external dependency overhead, and direct compatibility with our existing `db_connector.py` WAL infrastructure.

### 3. Strict Causal Filter (`t-1` Stamp Verification) at the Orchestration Boundary
- **Choice:** When joining and upserting daily records into `unified_daily_analytics`, `run_report_pipeline.py` verifies that signals assigned to date $t$ are derived exclusively from `master_ohlcv` data up to $t-1$ or the closing tick of $t$. No right-aligned rolling windows (`center=True` in pandas) or future leakage are permitted.
- **Rationale:** Absolute protection against historical lookahead bias during walk-forward backtests and live trading simulation.

## Risks / Trade-offs

- **Risk: Subsystem API/Database Latency or Failure during Pipeline Run**
  - *Mitigation:* `run_report_pipeline.py` already includes robust `try/except` blocks for subsystem queries. For database writes into `maftia_quant.db`, all connections explicitly invoke `PRAGMA journal_mode=WAL;` and `PRAGMA busy_timeout=5000;` via `get_wal_connection()` to prevent `database is locked` errors even if concurrent reading processes exist.
- **Risk: Schema Evolution Mismatches between Subsystem Outputs and `unified_daily_analytics`**
  - *Mitigation:* Enforce explicit column mapping dictionary inside `run_report_pipeline.py` that normalizes output keys from each subsystem (`val_scores`, `lttd_scores`, `mttd_scores`, `ich_scores`) directly into the `unified_daily_analytics` schema before running parameterized upserts.
