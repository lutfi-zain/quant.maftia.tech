# unified-analytics-persistence Specification

## Purpose
TBD - created by syncing change phase-2. Update Purpose after archive.
## Requirements
### Requirement: Unified Daily Analytics Relational Schema Creation
The data orchestration pipeline (`run_report_pipeline.py`) SHALL ensure the existence of the `UnifiedDailyAnalytics` (`unified_daily_analytics`) table in `maftia_quant.db` using parameterized queries and SQLite Write-Ahead Logging (`WAL`) concurrency. The table MUST adhere exactly to the ubiquitous language schema containing `date` (Primary Key, Foreign Key to `master_ohlcv.date`), `btc_price`, `valuation_composite`, `lttd_regime`, `lttd_score`, `lttd_prob_bull`, `lttd_prob_bear`, `lttd_prob_sideways`, `mttd_imo`, `mttd_er`, `mttd_entropy`, `mttd_position`, `mttd_immunity_active`, `ichimoku_imo`, `ichimoku_regime`, and `ichimoku_position`.

#### Scenario: UnifiedDailyAnalytics table creation verification
- **WHEN** `run_report_pipeline.py` establishes a WAL connection to `maftia_quant.db`
- **THEN** it executes a parameterized `CREATE TABLE IF NOT EXISTS unified_daily_analytics (...)` query ensuring exact column specifications and primary key alignment without lock contention

### Requirement: Unified Daily Analytics Upsert Pipeline
The data orchestration pipeline (`run_report_pipeline.py`) SHALL synchronize and upsert daily composite outputs from all four quantitative systems (`Valuation`, `LTTD`, `MTTD`, `Ichimoku`) into `UnifiedDailyAnalytics` (`unified_daily_analytics`) after executing the individual system calculation pipelines. The upsert MUST specify exact column names inside `INSERT OR REPLACE INTO unified_daily_analytics (...) VALUES (...)` parameterized statements to avoid column count mismatch errors.

#### Scenario: Synchronized upsert of 4-system daily outputs
- **WHEN** `run_report_pipeline.py` finishes computing daily signals for all 4 systems
- **THEN** it upserts each date's combined metrics into `unified_daily_analytics` using parameterized queries and WAL connections with zero lookahead bias

### Requirement: Unified Component Signals Persistence Schema and Synchronization
The data orchestration pipeline (`run_report_pipeline.py`) SHALL ensure the existence of and populate the `UnifiedComponentSignals` (`unified_component_signals`) tracking table (`date`, `system_source`, `component_name`, `raw_value`, `normalized_score`, `signal_direction` in `{-1, 0, +1}`, Primary Key `(date, system_source, component_name)`). The table MUST persist granular underlying indicator scores from `VALUATION` (17 indicators), `LTTD` (20-day volatility, log returns, PCA loadings), and `MTTD` (10 statistical families).

#### Scenario: Granular component tracking record upsert
- **WHEN** component-level scores are generated across the subsystems during `run_report_pipeline.py` execution
- **THEN** each underlying component score (`normalized_score`, `signal_direction`) is upserted into `unified_component_signals` via parameterized WAL connections
