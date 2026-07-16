# Data Ingestion and WAL Pipeline

## Purpose
Defines requirements for canonical Bitcoin market data ingestion into `MasterOHLCV`, SQLite Write-Ahead Logging (WAL) concurrency enforcement across all database files, schema auto-migration, and zero lookahead bias via causal filtering.
## Requirements
### Requirement: Canonical MasterOHLCV Ingestion & Storage
The data pipeline (`run_report_pipeline.py`) SHALL ingest daily Bitcoin market data (`open`, `high`, `low`, `close`, `volume`) from `bitview.space` exclusively into the canonical `MasterOHLCV` (`master_ohlcv`) SQLite table, acting as the single source of truth for all downstream quantitative calculations. No engine within the quantitative stack SHALL accept `yfinance`, Yahoo Finance, or Binance API endpoints as valid OHLCV sources.

#### Scenario: Daily ingestion verification
- **WHEN** the orchestration pipeline (`run_report_pipeline.py`) executes for a given daily timestamp
- **THEN** it MUST insert or update the daily bar in `master_ohlcv` with `source = 'bitview'` and align timestamps across subsystem `.db` and `btc_daily.json` data sources

#### Scenario: Pipeline log contains no yfinance or Binance references
- **WHEN** `run_report_pipeline.py` completes a full execution run
- **THEN** the pipeline output log MUST NOT contain any of the strings `"yfinance"`, `"api.binance.com"`, `"data-api.binance.vision"`, or `"YFRateLimitError"` — indicating exclusive use of bitview.space

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

### Requirement: Ichimoku Feature Extraction from Prior System DataFrame
The data pipeline (`run_report_pipeline.py`) SHALL extract all Ichimoku feature columns from the `quant-lttd-ichimoku` system's generated DataFrame (`df_ich`) after calling `generate_ichimoku_features()` and `generate_signals()`. The extracted columns SHALL include the full set of Ichimoku quantitative metrics for syncing into `UnifiedDailyAnalytics` and `UnifiedComponentSignals`:

- **Price-level Ichimoku lines**: `tenkan_sen`, `kijun_sen`, `senkou_span_a`, `senkou_span_b` (hyper-tuned periods 20, 60, 120)
- **Tanh-normalized S-components**: `S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`
- **Composite oscillator & reference equity metrics**: `IMO`, `IMO_Std`, `ichi_ref_pos`, `ichi_cum_strat`, `ichi_cum_market`
- **Auxiliary**: `ER`, `Entropy`, `roc_gate`

#### Scenario: Full Ichimoku DataFrame extraction during pipeline run
- **WHEN** `run_report_pipeline.py` executes the Ichimoku computation block (Step 6)
- **THEN** the `ich_data_all` dictionary SHALL store `s_tk`, `s_cloud`, `s_future`, `s_chikou`, `tenkan`, `kijun`, `senkou_a`, `senkou_b`, `chikou`, `ichi_ref_pos`, `ichi_cum_strat`, `ichi_cum_market` values extracted from the `df_ich` DataFrame for each date

#### Scenario: Upsert extends to all Ichimoku fields in unified_daily_analytics
- **WHEN** the pipeline syncs `uch_data_all` into `unified_daily_analytics`
- **THEN** the `INSERT OR REPLACE INTO unified_daily_analytics (...) VALUES (...)` statement SHALL include the columns `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou`, `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou`, `ichi_ref_pos`, `ichi_cum_strat`, `ichi_cum_market` with the extracted values, using parameterized queries and WAL connections

#### Scenario: NULL handling during warmup
- **WHEN** the first N-20/60/120 bars of the DataFrame have NaN values for Ichimoku features
- **THEN** the pipeline SHALL store `None` (SQL NULL) for those date rows' Ichimoku columns, matching the prior system's warmup period

### Requirement: Schema Verification and Auto-Migration Before Sync
The data pipeline (`run_report_pipeline.py`) SHALL perform schema verification and auto-migration on `unified_daily_analytics` prior to data insertion. If any required Ichimoku columns (`ichi_ref_pos`, `ichi_cum_strat`, `ichi_cum_market`, `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou`, `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou`) are missing from the table definition, the pipeline SHALL automatically execute `ALTER TABLE unified_daily_analytics ADD COLUMN <col> REAL` commands.

#### Scenario: Auto-migration of missing Ichimoku columns during pipeline initialization
- **WHEN** `run_report_pipeline.py` initializes connections and inspects table columns (`PRAGMA table_info(unified_daily_analytics)`)
- **THEN** it MUST dynamically detect any missing Ichimoku columns (`ichi_ref_pos`, `ichi_cum_strat`, `ichi_cum_market`, `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou`, `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou`) and execute `ALTER TABLE ... ADD COLUMN ... REAL` for each missing column before attempting upserts

### Requirement: Ichimoku Extended Metrics Extraction and Pipeline Storage
The data pipeline (`run_report_pipeline.py`) SHALL extract all 14 quantitative feature columns from the `quant-lttd-ichimoku` system's generated DataFrame (`df_ich`) after calling `generate_ichimoku_features()` and `generate_signals()`. The extracted metrics MUST include `df_ich['Entropy']` (`shannon_entropy`), `df_ich['ER']` (`Kaufman Efficiency Ratio`), and `df_ich['IMO_Std']` (`rolling standard deviation`), alongside `IMO`, `Regime`, `Pos`, `S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`, `tenkan_sen`, `kijun_sen`, `senkou_span_a`, `senkou_span_b`, and `chikou`. All extracted columns SHALL be stored in `ich_data_all` and upserted into `unified_daily_analytics` under strict causal verification ($t-1$ stamp check).

#### Scenario: Complete extraction of Ichimoku features and gating limits
- **WHEN** `run_report_pipeline.py` iterates over `df_ich` during the daily sync
- **THEN** it extracts `imo`, `regime`, `pos`, `s_tk`, `s_cloud`, `s_future`, `s_chikou`, `tenkan`, `kijun`, `senkou_a`, `senkou_b`, `chikou`, `entropy` (`df_ich['Entropy']`), `er` (`df_ich['ER']`), and `imo_std` (`df_ich['IMO_Std']`) for every date and writes them into `unified_daily_analytics` using parameterized SQLite WAL connections

