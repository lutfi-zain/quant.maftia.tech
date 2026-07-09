## Context

The quantitative architecture consists of 4 unified systems whose daily outputs are computed and synchronized by `/home/ubuntu/projects/run_report_pipeline.py`. The pipeline consolidates data into `maftia_quant.db` (`master_ohlcv`, `unified_daily_analytics`, `unified_component_signals`). The Hono v4 API Gateway (`src/api/routes/daily.ts` running on port `:8765`) queries `unified_daily_analytics` joined with `master_ohlcv` and serves structured JSON payloads (`GET /api/v1/analytics/daily?limit=365`) to the frontend.

To guarantee true end-to-end reliability across all 4 systems (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, and `IchimokuDenoisedOscillator`), we must execute `run_report_pipeline.py` and perform automated 1:1 verification checking every single metric column emitted by the pipeline against the database tables and API Gateway JSON responses.

## Goals / Non-Goals

**Goals:**
- Execute `python3 /home/ubuntu/projects/run_report_pipeline.py` to produce a fresh, authoritative calculation across all 4 defense systems.
- Build and run an automated Python verification script (`verify_pipeline_api_parity.py`) that checks 1:1 mathematical parity across all daily rows and exact metric fields:
  - `master_ohlcv`: `open`, `high`, `low`, `close`, `volume`
  - `valuation_composite`: `score`
  - `lttd_regime`: `regime`, `score`, `prob_bull`, `prob_bear`, `prob_sideways`
  - `mttd_imo`: `oscillator`, `efficiency_ratio`, `shannon_entropy`, `position`
  - `ichimoku_imo`: `oscillator`, `regime`, `position`
- Identify and eliminate any serialization drift (e.g., SQLite NULL vs 0 vs JSON numbers, timestamp formatting `YYYY-MM-DD`, floating-point rounding diffs outside $\epsilon = 10^{-6}$).

**Non-Goals:**
- Modifying underlying quant engine models (`hmmlearn`, `scipy` super-smoothers) unless required by database storage bugs.
- Re-introducing or referencing any deprecated systems (`05. Indicator Bank`).

## Decisions

### 1. Automated Verification Script (`verify_pipeline_api_parity.py`)
- **Choice**: Create a standalone verification script `verify_pipeline_api_parity.py` that queries `maftia_quant.db` using SQLite WAL mode and fetches `http://127.0.0.1:8765/api/v1/analytics/daily?limit=365` directly via Hono API Gateway.
- **Rationale**: Direct side-by-side dictionary diffing in Python allows us to assert exact 1:1 parity ($|a - b| < 10^{-6}$ for floating-point values and exact string match for `BULL`/`BEAR`/`SIDEWAYS` regimes across all 365 dates).

### 2. SQLite WAL Connection Safety
- **Choice**: Ensure all database reads in the verification script enable SQLite Write-Ahead Logging (`WAL`) mode (`PRAGMA journal_mode=WAL`) via `db_connector.get_wal_connection()` to prevent database file lock contention while Hono API Gateway concurrently queries `maftia_quant.db`.

## Risks / Trade-offs

- **[Risk: Floating point precision diffs between Pandas output and SQLite storage]** → **Mitigation**: Use a strict floating-point tolerance of $\epsilon = 10^{-6}$ when comparing numeric scores, while enforcing exact equality on date stamps and categorical strings (`regime`, `position`).
- **[Risk: Missing columns or NULL coalescing diffs in API serialization]** → **Mitigation**: Update `src/api/routes/daily.ts` if any pipeline metric column is omitted or defaulted incorrectly (`row.open ?? row.btc_price`).
