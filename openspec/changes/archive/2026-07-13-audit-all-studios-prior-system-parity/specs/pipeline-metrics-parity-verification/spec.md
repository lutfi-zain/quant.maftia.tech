# pipeline-metrics-parity-verification Specification

## Purpose

Defines requirements for the verification harness (`verify_pipeline_api_parity.py` and `verify_*_studio_metrics_1to1.py`), ensuring 1:1 numeric precision checks and categorical alignment between API Gateway responses and SQLite DB (`maftia_quant.db`), causal cross-validation against prior system outputs, cumulative return matching, trade count parity verification, and override detection across all 4 quantitative defense studios.

## MODIFIED Requirements

### Requirement: Pipeline Execution and 1:1 Parity Verification across all 4 Quantitative Systems

The verification harness (`verify_pipeline_api_parity.py`) SHALL execute `python3 /home/ubuntu/projects/run_report_pipeline.py` and verify that the resulting outputs in `maftia_quant.db` (`master_ohlcv` and `unified_daily_analytics`) match the JSON payloads returned by the Hono API Gateway (`http://127.0.0.1:8765/api/v1/analytics/daily?limit=365`) exactly 1:1 for every single metric and date stamp.

#### Scenario: 1:1 numeric precision verification across all quantitative pillars
- **WHEN** the verification harness queries `maftia_quant.db` using SQLite Write-Ahead Logging (`WAL`) mode and fetches daily telemetry from the API Gateway (`:8765`)
- **THEN** every numeric field (`open`, `high`, `low`, `close`, `volume`, `valuation_composite`, `lttd_score`, `lttd_prob_bull`, `lttd_prob_bear`, `lttd_prob_sideways`, `mttd_imo`, `mttd_er`, `mttd_entropy`, `ichimoku_imo`) SHALL match within a strict tolerance of $|a - b| < 10^{-6}$

#### Scenario: Exact categorical regime matching across LTTD, MTTD, and Ichimoku
- **WHEN** categorical and boolean indicator fields are evaluated across all 365 daily rows
- **THEN** the exact strings (`BULL`, `BEAR`, `SIDEWAYS`, `NEUTRAL`) for `lttd_regime`, `mttd_position`, and `ichimoku_regime`, and boolean flags (`sideways_zero_exposure_lock`, `bubble_warning`, `deep_discount_override`, `mttd_immunity_active`) SHALL match 1:1 between database records and API responses with zero mismatches

#### Scenario: Automated studio metric verification harnesses for all 4 systems
- **WHEN** the studio verification scripts (`verify_valuation_studio_metrics_1to1.py`, `verify_lttd_studio_metrics_1to1.py`, `verify_mttd_studio_metrics_1to1.py`, and `verify_ichimoku_studio_metrics_1to1.py`) are executed
- **THEN** each script SHALL verify that the frontend studio metrics (`Win Rate`, `Profit Factor`, `Total Trades`, `Sharpe Ratio`, `Ann. Return`, `Max Drawdown`, `Total Return`), trade execution history (`trades` array), and equity curves match the canonical prior system calculations with $|a - b| < 10^{-6}$ and report $100\%$ clean pass rates
