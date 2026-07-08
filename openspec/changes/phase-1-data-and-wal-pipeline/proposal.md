## Why

To support concurrent background data synchronization (`run_report_pipeline.py`) and real-time API querying without triggering `database is locked` errors across our 4 quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`), we must execute **Phase 1: Data & Storage Layer**. This phase unifies daily market data ingestion into the canonical `MasterOHLCV` (`master_ohlcv`) table and enforces SQLite Write-Ahead Logging (`WAL`) mode and parameterized `?-style` SQL connectors across all databases.

## What Changes

- **Canonical MasterOHLCV Ingestion**: Consolidate exchange price feeds (`open`, `high`, `low`, `close`, `volume`) and `bitview.space` BRK metrics strictly into the canonical `master_ohlcv` table inside `maftia_quant.db`.
- **Enforce SQLite WAL Concurrency**: Execute `PRAGMA journal_mode=WAL;` across `maftia_quant.db` and all subsystem database files (`valuation.db`, `lttd.db`, etc.) to allow concurrent readers and writers without lock contention.
- **Parameterized SQL Connectors**: Migrate raw or string-concatenated SQL queries across the ingestion pipeline to parameterized queries (`?-style` / ORM bindings).
- **Causal Historical Verification**: Implement $t-1$ boundary verification (`CausalFilter`) on all `UnifiedDailyAnalytics` table writes to eliminate lookahead bias.

## Capabilities

### New Capabilities
- `master-ohlcv-canonical-storage`: Consolidated SQLite schema (`master_ohlcv`) serving as the single source of truth for daily Bitcoin price action across all 4 quantitative systems.
- `sqlite-wal-concurrency-connectors`: Parameterized database connection pool executing `PRAGMA journal_mode=WAL;` and preventing `database is locked` errors during concurrent background pipeline runs and API queries.

### Modified Capabilities
- (No existing spec capabilities modified; introduced as fresh Phase 1 capabilities).

## Impact

- **Affected Systems**: `quant.maftia.tech` storage foundation (`maftia_quant.db`), `run_report_pipeline.py`, and subsystem `.db` connectors across Valuation, LTTD, MTTD, and Ichimoku systems.
- **Performance & Concurrency**: Eliminates read/write lock contention between background synchronization tasks and API endpoints.

## Non-goals

- We will **not** modify or implement quantitative indicator calculation formulas (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`) inside this Phase 1 proposal; those are reserved for Phase 2.
- We will **not** reference, document, or import anything from the deprecated `quant-technical-indicator-bank` (`05. Indicator Bank`).
