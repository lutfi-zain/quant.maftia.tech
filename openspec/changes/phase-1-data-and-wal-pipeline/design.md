## Context

The data pipeline (`run_report_pipeline.py`) coordinates data flows across four quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`). Currently, individual subsystem scripts write to SQLite databases (`valuation.db`, `lttd.db`) or flat JSON (`btc_daily.json`) without explicit SQLite Write-Ahead Logging (`WAL`) concurrency enforcement or pooled parameterized connectors. When the API Gateway (`api.quant.maftia.tech` on `:8765`) concurrently reads from these databases while `run_report_pipeline.py` is inserting or updating daily records, SQLite throws `database is locked` errors. Furthermore, to prevent lookahead bias across downstream indicators, we must ensure the `master_ohlcv` ingestion layer strictly validates $t-1$ causal timestamps before committing bars.

## Goals / Non-Goals

**Goals:**
- Design a unified database connection utility (`db_connector.py`) across `quant.maftia.tech` and its 4 subsystems that automatically executes `PRAGMA journal_mode=WAL;` and `PRAGMA synchronous=NORMAL;` upon connection establishment.
- Mandate parameterized queries (`?-style`) for all `MasterOHLCV` (`master_ohlcv`) table insertions and `UnifiedDailyAnalytics` queries to prevent SQL injection and lock contention.
- Implement `CausalFilter` ($t-1$ boundary verification check) inside the ingestion loop of `run_report_pipeline.py`.

**Non-Goals:**
- We will not modify the mathematical equations or threshold parameters of the 4 quantitative engines (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`) in this phase.
- We will not touch or reference any code from the deprecated `quant-technical-indicator-bank` (`05. Indicator Bank`).

## Decisions

- **Decision 1: Automatic SQLite WAL Mode Initialization via Shared Connector (`db_connector.py`)**
  - *Rationale*: Instead of relying on ad-hoc `sqlite3.connect()` calls scattered across subsystem scripts, implementing a centralized `get_wal_connection(db_path)` wrapper guarantees that every connection sets `journal_mode=WAL` and `busy_timeout=5000`. WAL mode allows concurrent readers to proceed without blocking writers or vice versa.
  - *Alternatives Considered*: Migrating immediately to PostgreSQL (rejected due to architectural complexity and local setup overhead; SQLite WAL handles our 1-day bar frequency and sub-50ms query loads with zero operational friction).
- **Decision 2: Strict $t-1$ Causal Verification Check in `run_report_pipeline.py`**
  - *Rationale*: To guarantee zero lookahead bias (`CausalFilter`), any historical bar inserted into `master_ohlcv` or `unified_daily_analytics` must have `date <= current_date`. If an API feed attempts to return a partial or future-aligned bar (`t`), it is filtered out until closed.
  - *Alternatives Considered*: Right-aligned rolling window clipping at query time (rejected because storing unverified future bars inside `master_ohlcv` creates risk of accidental data leakage).

## Risks / Trade-offs

- **[Risk: Existing SQLite database files locked by stale Python processes during WAL migration]** → *Mitigation*: The Phase 1 task checklist includes running `pkill -f run_report_pipeline.py` and verifying clean database handles before executing `PRAGMA journal_mode=WAL;`.
- **[Risk: Subsystem scripts using string concatenation (`f-strings`) for SQL queries]** → *Mitigation*: Audit all SQL execution strings across `run_report_pipeline.py` and subsystem `.py` files and refactor to `cursor.execute("INSERT OR REPLACE INTO master_ohlcv VALUES (?, ?, ?, ?, ?, ?)", (...))` parameterized format.

## Migration Plan

1. Create `quant/db_connector.py` providing `get_wal_connection(db_path: str) -> sqlite3.Connection`.
2. Update `run_report_pipeline.py` to import and use `get_wal_connection` across all SQLite operations (`maftia_quant.db`, `lttd.db`, `valuation.db`).
3. Verify that `python3 /home/ubuntu/projects/run_report_pipeline.py` executes cleanly and that `PRAGMA journal_mode;` returns `wal` across all databases.

## Open Questions

- Should `get_wal_connection` set `PRAGMA busy_timeout=5000` (5 seconds) or `10000` (10 seconds) to handle extreme burst writes during multi-year historical backtest re-syncs? *(Recommendation: `10000` ms for maximum resilience).*
