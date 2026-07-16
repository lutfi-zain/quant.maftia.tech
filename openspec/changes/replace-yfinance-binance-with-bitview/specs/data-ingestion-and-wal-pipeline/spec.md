## MODIFIED Requirements

### Requirement: Canonical MasterOHLCV Ingestion & Storage
The data pipeline (`run_report_pipeline.py`) SHALL ingest daily Bitcoin market data (`open`, `high`, `low`, `close`, `volume`) from `bitview.space` exclusively into the canonical `MasterOHLCV` (`master_ohlcv`) SQLite table, acting as the single source of truth for all downstream quantitative calculations. No engine within the quantitative stack SHALL accept `yfinance`, Yahoo Finance, or Binance API endpoints as valid OHLCV sources.

#### Scenario: Daily ingestion verification
- **WHEN** the orchestration pipeline (`run_report_pipeline.py`) executes for a given daily timestamp
- **THEN** it MUST insert or update the daily bar in `master_ohlcv` with `source = 'bitview'` and align timestamps across subsystem `.db` and `btc_daily.json` data sources

#### Scenario: Pipeline log contains no yfinance or Binance references
- **WHEN** `run_report_pipeline.py` completes a full execution run
- **THEN** the pipeline output log MUST NOT contain any of the strings `"yfinance"`, `"api.binance.com"`, `"data-api.binance.vision"`, or `"YFRateLimitError"` — indicating exclusive use of bitview.space
