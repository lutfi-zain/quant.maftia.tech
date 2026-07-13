# unified-analytics-persistence Specification

## Purpose

Defines requirements for relational schema creation, WAL concurrency, synchronized upserting into `UnifiedDailyAnalytics` (`unified_daily_analytics`), including storage for Ichimoku S-components, raw Ichimoku lines, and reference equity metrics, as well as separate `ICHIMOKU` component signal extraction into `UnifiedComponentSignals` (`unified_component_signals`).
## Requirements
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

### Requirement: Ichimoku S-Component and Raw Line storage in UnifiedDailyAnalytics

The data orchestration pipeline (`run_report_pipeline.py`) SHALL populate `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou` columns in `unified_daily_analytics` from the `quant-lttd-ichimoku` system's computed features. Additionally, it SHALL create and populate columns `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou` for the raw Ichimoku lines at their hyper-tuned periods (20, 60, 120), along with reference equity metrics `ichi_ref_pos`, `ichi_cum_strat`, and `ichi_cum_market`.

The `CREATE TABLE IF NOT EXISTS` statement SHALL include these columns with `REAL` type:
```sql
CREATE TABLE IF NOT EXISTS unified_daily_analytics (
  ...
  ichimoku_imo           REAL,
  ichimoku_regime        TEXT,
  ichimoku_position      REAL,
  ichi_ref_pos           REAL,
  ichi_cum_strat         REAL,
  ichi_cum_market        REAL,
  ichi_s_tk              REAL,
  ichi_s_cloud           REAL,
  ichi_s_future          REAL,
  ichi_s_chikou          REAL,
  ichi_tenkan            REAL,
  ichi_kijun             REAL,
  ichi_senkou_a          REAL,
  ichi_senkou_b          REAL,
  ichi_chikou            REAL,
  ...
)
```

#### Scenario: S-components and Ichimoku lines synced during pipeline execution
- **WHEN** `run_report_pipeline.py` finishes computing the Ichimoku system's `df_ich` DataFrame containing `S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`, `tenkan_sen`, `kijun_sen`, `senkou_span_a`, `senkou_span_b` columns
- **THEN** these values SHALL be extracted per date and upserted into the corresponding `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou`, `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou` columns in `unified_daily_analytics` using a parameterized `INSERT OR REPLACE INTO` query with WAL connection

#### Scenario: Existing NULL columns become populated after first sync
- **WHEN** the pipeline runs after this change is deployed
- **THEN** any historical date that the Ichimoku system has computed SHALL have non-NULL values in the S-component and Ichimoku line columns, matching the prior system's output exactly

#### Scenario: Causal filtering applies to S-component values
- **WHEN** the pipeline syncs S-component data for each date
- **THEN** the `CausalFilter` (t-1 stamp verification) SHALL be enforced — no S-component row SHALL have a date beyond `current_utc_date_str`

### Requirement: Unified Component Signals Persistence Schema and Synchronization

The data orchestration pipeline (`run_report_pipeline.py`) SHALL ensure the existence of and populate the `UnifiedComponentSignals` (`unified_component_signals`) tracking table (`date`, `system_source`, `component_name`, `raw_value`, `normalized_score`, `signal_direction` in `{-1, 0, +1}`, Primary Key `(date, system_source, component_name)`). The table MUST persist granular underlying indicator scores from `VALUATION` (17 indicators), `LTTD` (20-day volatility, log returns, PCA loadings), `MTTD` (10 statistical families), and `ICHIMOKU` (S-components and oscillator).

#### Scenario: Granular component tracking record upsert
- **WHEN** component-level scores are generated across the subsystems during `run_report_pipeline.py` execution
- **THEN** each underlying component score (`normalized_score`, `signal_direction`) is upserted into `unified_component_signals` via parameterized WAL connections

### Requirement: ICHIMOKU component signals extracted and stored separately from MTTD

The pipeline SHALL extract Ichimoku system S-component signals (S_TK, S_Cloud, S_Future, S_Chikou, IMO) from `df_ich` and upsert them into `unified_component_signals` with `system_source = 'ICHIMOKU'`. These SHALL be stored in addition to any existing MTTD-sourced entries with the same component_name (the composite primary key `(date, system_source, component_name)` ensures no collision).

#### Scenario: ICHIMOKU component signals upserted separately from MTTD
- **WHEN** the pipeline reaches the component signals sync section
- **THEN** for each date where `df_ich` has valid S_TK, S_Cloud, S_Future, S_Chikou, and IMO values, a row SHALL be inserted into `unified_component_signals` with `system_source = 'ICHIMOKU'` and `signal_direction` set to `1` (value > 0.15), `-1` (value < -0.15), or `0` (otherwise)

