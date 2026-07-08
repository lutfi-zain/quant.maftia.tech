## ADDED Requirements

### Requirement: Canonical MasterOHLCV Ingestion & Storage
The data pipeline (`run_report_pipeline.py`) SHALL ingest daily Bitcoin market data (`open`, `high`, `low`, `close`, `volume`) from authoritative exchange feeds into the canonical `MasterOHLCV` (`master_ohlcv`) SQLite table, acting as the single source of truth for all downstream quantitative calculations.

#### Scenario: Daily ingestion verification
- **WHEN** the orchestration pipeline (`run_report_pipeline.py`) executes for a given daily timestamp
- **THEN** it MUST insert or update the daily bar in `master_ohlcv` and align timestamps across subsystem `.db` and `btc_daily.json` data sources

### Requirement: SQLite Write-Ahead Logging (WAL) Concurrency Enforcement
All database connections interacting with `maftia_quant.db` or individual subsystem database files (`valuation.db`, `lttd.db`, etc.) SHALL explicitly execute `PRAGMA journal_mode=WAL;` and use parameterized queries (`?-style` placeholders or strict ORM bindings).

#### Scenario: Concurrent background writing and API querying
- **WHEN** background ingestion tasks update `UnifiedDailyAnalytics` (`unified_daily_analytics`) or `UnifiedComponentSignals` (`unified_component_signals`) while the API Gateway concurrently executes SELECT queries
- **THEN** SQLite Write-Ahead Logging (`WAL`) mode MUST ensure reads are never blocked by writes and prevent `database is locked` exceptions

### Requirement: Zero Lookahead Bias via Causal Filtering
All historical data transformations and rolling indicator aggregations written to `UnifiedDailyAnalytics` (`unified_daily_analytics`) and `UnifiedComponentSignals` (`unified_component_signals`) SHALL enforce a strict causal filter (`CausalFilter`) verified at index $t-1$.

#### Scenario: Causal timestamp validation
- **WHEN** any quantitative engine (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`) calculates feature arrays
- **THEN** it MUST only reference data points where `date <= current_date` ($t-1$ boundary validation) without leaking right-aligned or future-peeking windows into backtests
