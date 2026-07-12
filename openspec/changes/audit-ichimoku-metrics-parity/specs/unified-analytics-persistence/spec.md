## ADDED Requirements

### Requirement: Ichimoku S-Component storage in UnifiedDailyAnalytics

The data orchestration pipeline (`run_report_pipeline.py`) SHALL populate the existing `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou` columns in `unified_daily_analytics` from the `quant-lttd-ichimoku` system's computed features. Additionally, SHALL create and populate new columns `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou` for the raw Ichimoku lines at their hyper-tuned periods (20, 60, 120).

The `CREATE TABLE IF NOT EXISTS` statement SHALL be updated to include these columns with `REAL` type:

```sql
CREATE TABLE IF NOT EXISTS unified_daily_analytics (
  ...
  ichimoku_imo           REAL,
  ichimoku_regime        TEXT,
  ichimoku_position      REAL,
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

### Requirement: ICHIMOKU component signals extracted and stored separately from MTTD

The pipeline SHALL extract Ichimoku system S-component signals (S_TK, S_Cloud, S_Future, S_Chikou, IMO) from `df_ich` and upsert them into `unified_component_signals` with `system_source = 'ICHIMOKU'`. These SHALL be stored in addition to any existing MTTD-sourced entries with the same component_name (the composite primary key `(date, system_source, component_name)` ensures no collision).

#### Scenario: ICHIMOKU component signals upserted separately from MTTD

- **WHEN** the pipeline reaches the component signals sync section
- **THEN** for each date where `df_ich` has valid S_TK, S_Cloud, S_Future, S_Chikou, and IMO values, a row SHALL be inserted into `unified_component_signals` with `system_source = 'ICHIMOKU'` and `signal_direction` set to `1` (value > 0.15), `-1` (value < -0.15), or `0` (otherwise)
