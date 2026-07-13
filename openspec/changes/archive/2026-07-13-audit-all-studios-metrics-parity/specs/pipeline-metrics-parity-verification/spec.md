## MODIFIED Requirements

### Requirement: Pipeline Execution and 1:1 Parity Verification across all 4 Quantitative Systems

The verification harness (`verify_pipeline_api_parity.py`) and dedicated studio verification scripts (`verify_ichimoku_studio_metrics_1to1.py`, `verify_valuation_studio_metrics_1to1.py`, `verify_lttd_studio_metrics_1to1.py`, `verify_mttd_studio_metrics_1to1.py`) SHALL execute `python3 /home/ubuntu/projects/run_report_pipeline.py` and verify that the resulting outputs in `maftia_quant.db` (`master_ohlcv` and `unified_daily_analytics`), the JSON payloads returned by the Hono API Gateway (`http://127.0.0.1:8765/api/v1/analytics/daily?limit=365`), and the performance metrics, trade execution logs (`trades`), and equity curves calculated inside all 4 frontend studios match canonical Python backtest engines exactly $1:1$ ($|a - b| < 10^{-6}$) across every metric and date stamp.

#### Scenario: 1:1 numeric precision verification across all quantitative pillars
- **WHEN** the verification harness queries `maftia_quant.db` using SQLite Write-Ahead Logging (`WAL`) mode, fetches daily telemetry from the API Gateway (`:8765`), and evaluates front-end studio simulation calculations across Valuation, LTTD, MTTD, and Ichimoku
- **THEN** every numeric field (`open`, `high`, `low`, `close`, `volume`, `valuation_composite`, `lttd_score`, `lttd_prob_bull`, `lttd_prob_bear`, `lttd_prob_sideways`, `mttd_imo`, `mttd_er`, `mttd_entropy`, `ichimoku_imo`), performance summary card (`Win Rate`, `Profit Factor`, `Total Trades`, `Sharpe Ratio`, `Max Drawdown`, `Ann Return`, `Ann Volatility`), and trade execution record SHALL match within a strict tolerance of $|a - b| < 10^{-6}$

#### Scenario: Exact categorical regime matching across LTTD, MTTD, and Ichimoku
- **WHEN** categorical and boolean indicator fields are evaluated across all 365 daily rows
- **THEN** the exact strings (`BULL`, `BEAR`, `SIDEWAYS`, `NEUTRAL`) for `lttd_regime`, `mttd_position`, and `ichimoku_regime`, and boolean flags (`sideways_zero_exposure_lock`, `bubble_warning`, `deep_discount_override`, `mttd_immunity_active`) SHALL match 1:1 between database records and API responses with zero mismatches
