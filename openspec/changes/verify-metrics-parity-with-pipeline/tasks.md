## 1. Execute Pipeline and Generate Baseline Telemetry

- [x] 1.1 Run authoritative calculation pipeline (`python3 /home/ubuntu/projects/run_report_pipeline.py`) across all 4 unified quantitative systems (`Valuation`, `LTTD`, `MTTD`, `Ichimoku`) and verify clean execution with zero errors
- [x] 1.2 Verify that `maftia_quant.db` (`master_ohlcv` and `unified_daily_analytics`) has been updated with the latest daily timestamps using SQLite WAL connections

## 2. Build Automated 1:1 Parity Verification Suite

- [x] 2.1 Create Python verification harness (`verify_pipeline_api_parity.py`) using `db_connector.get_wal_connection` to query exact `master_ohlcv` and `unified_daily_analytics` rows sorted by date ascending
- [x] 2.2 Add HTTP client logic inside `verify_pipeline_api_parity.py` to query Hono API Gateway (`http://127.0.0.1:8765/api/v1/analytics/daily?limit=365`) and map structured JSON outputs to table rows
- [x] 2.3 Implement row-by-row and metric-by-metric comparison checking floating-point tolerance ($|a - b| < 10^{-6}$) and exact categorical string equality (`regime`, `position`) across all 365 days

## 3. Resolve Parity Drift and Finalize System Verification

- [x] 3.1 Execute `python3 verify_pipeline_api_parity.py` and log any numerical diffs, NULL serialization mismatches, or schema gaps
- [x] 3.2 Update API Gateway router (`src/api/routes/daily.ts`) or database sync functions in `run_report_pipeline.py` if needed until `verify_pipeline_api_parity.py` reports 100% 1:1 parity with zero discrepancies across all metrics
