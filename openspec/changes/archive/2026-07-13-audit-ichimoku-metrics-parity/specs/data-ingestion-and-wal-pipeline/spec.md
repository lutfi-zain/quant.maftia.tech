## ADDED Requirements

### Requirement: Ichimoku Feature Extraction from Prior System DataFrame

The data pipeline (`run_report_pipeline.py`) SHALL extract all Ichimoku feature columns from the `quant-lttd-ichimoku` system's generated DataFrame (`df_ich`) after calling `generate_ichimoku_features()` and `generate_signals()`. The extracted columns SHALL include the full set of Ichimoku quantitative metrics for syncing into `UnifiedDailyAnalytics` and `UnifiedComponentSignals`:

- **Price-level Ichimoku lines**: `tenkan_sen`, `kijun_sen`, `senkou_span_a`, `senkou_span_b` (hyper-tuned periods 20, 60, 120)
- **Tanh-normalized S-components**: `S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`
- **Composite oscillator**: `IMO`, `IMO_Std`
- **Auxiliary**: `ER`, `Entropy`, `roc_gate` (already partially extracted)

The sync SHALL happen in the same section where `ich_data_all` is currently constructed, extending the dictionary to include these additional fields before the upsert loop.

#### Scenario: Full Ichimoku DataFrame extraction during pipeline run

- **WHEN** `run_report_pipeline.py` executes the Ichimoku computation block (Step 6)
- **THEN** the `ich_data_all` dictionary SHALL store `s_tk`, `s_cloud`, `s_future`, `s_chikou`, `tenkan`, `kijun`, `senkou_a`, `senkou_b`, `chikou` values extracted from the `df_ich` DataFrame for each date

#### Scenario: Upsert extends to all Ichimoku fields in unified_daily_analytics

- **WHEN** the pipeline syncs `uch_data_all` into `unified_daily_analytics`
- **THEN** the `INSERT OR REPLACE INTO unified_daily_analytics (...) VALUES (...)` statement SHALL include the columns `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou`, `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou` with the extracted values, using parameterized queries and WAL connections

#### Scenario: NULL handling during warmup

- **WHEN** the first N-20/60/120 bars of the DataFrame have NaN values for Ichimoku features
- **THEN** the pipeline SHALL store `None` (SQL NULL) for those date rows' Ichimoku columns, matching the prior system's warmup period
