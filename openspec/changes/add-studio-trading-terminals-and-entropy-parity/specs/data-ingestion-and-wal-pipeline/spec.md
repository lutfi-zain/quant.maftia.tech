## ADDED Requirements

### Requirement: Ichimoku Extended Metrics Extraction and Pipeline Storage
The data pipeline (`run_report_pipeline.py`) SHALL extract all 14 quantitative feature columns from the `quant-lttd-ichimoku` system's generated DataFrame (`df_ich`) after calling `generate_ichimoku_features()` and `generate_signals()`. The extracted metrics MUST include `df_ich['Entropy']` (`shannon_entropy`), `df_ich['ER']` (`Kaufman Efficiency Ratio`), and `df_ich['IMO_Std']` (`rolling standard deviation`), alongside `IMO`, `Regime`, `Pos`, `S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`, `tenkan_sen`, `kijun_sen`, `senkou_span_a`, `senkou_span_b`, and `chikou`. All extracted columns SHALL be stored in `ich_data_all` and upserted into `unified_daily_analytics` under strict causal verification ($t-1$ stamp check).

#### Scenario: Complete extraction of Ichimoku features and gating limits
- **WHEN** `run_report_pipeline.py` iterates over `df_ich` during the daily sync
- **THEN** it extracts `imo`, `regime`, `pos`, `s_tk`, `s_cloud`, `s_future`, `s_chikou`, `tenkan`, `kijun`, `senkou_a`, `senkou_b`, `chikou`, `entropy` (`df_ich['Entropy']`), `er` (`df_ich['ER']`), and `imo_std` (`df_ich['IMO_Std']`) for every date and writes them into `unified_daily_analytics` using parameterized SQLite WAL connections
