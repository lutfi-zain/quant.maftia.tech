## MODIFIED Requirements

### Requirement: Unified Daily Analytics Relational Schema Creation
The data orchestration pipeline (`run_report_pipeline.py`) SHALL ensure the existence of the `UnifiedDailyAnalytics` (`unified_daily_analytics`) table in `maftia_quant.db` using parameterized queries and SQLite Write-Ahead Logging (`WAL`) concurrency. The table MUST adhere exactly to the ubiquitous language schema containing `date` (Primary Key, Foreign Key to `master_ohlcv.date`), `btc_price`, `valuation_composite`, `lttd_regime`, `lttd_score`, `lttd_prob_bull`, `lttd_prob_bear`, `lttd_prob_sideways`, `mttd_imo`, `mttd_er`, `mttd_entropy`, `mttd_position`, `mttd_immunity_active`, `ichimoku_imo`, `ichimoku_regime`, `ichimoku_position`, `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou`, `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou`, `ichi_entropy`, `ichi_er`, and `ichi_imo_std`.

#### Scenario: UnifiedDailyAnalytics table creation verification
- **WHEN** `run_report_pipeline.py` establishes a WAL connection to `maftia_quant.db`
- **THEN** it executes a parameterized `CREATE TABLE IF NOT EXISTS unified_daily_analytics (...)` query alongside `ALTER TABLE unified_daily_analytics ADD COLUMN` migrations ensuring exact column specifications (including `ichi_entropy`, `ichi_er`, `ichi_imo_std`) and primary key alignment without lock contention

### Requirement: Unified Daily Analytics Upsert Pipeline
The data orchestration pipeline (`run_report_pipeline.py`) SHALL synchronize and upsert daily composite outputs from all four quantitative systems (`Valuation`, `LTTD`, `MTTD`, `Ichimoku`) into `UnifiedDailyAnalytics` (`unified_daily_analytics`) after executing the individual system calculation pipelines. The upsert MUST specify exact column names inside `INSERT OR REPLACE INTO unified_daily_analytics (...) VALUES (...)` parameterized statements (including all 14 Ichimoku columns: `ichimoku_imo`, `ichimoku_regime`, `ichimoku_position`, `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou`, `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou`, `ichi_entropy`, `ichi_er`, `ichi_imo_std`) to avoid column count mismatch errors.

#### Scenario: Synchronized upsert of 4-system daily outputs
- **WHEN** `run_report_pipeline.py` finishes computing daily signals for all 4 systems
- **THEN** it upserts each date's combined metrics into `unified_daily_analytics` using parameterized queries and WAL connections with zero lookahead bias
