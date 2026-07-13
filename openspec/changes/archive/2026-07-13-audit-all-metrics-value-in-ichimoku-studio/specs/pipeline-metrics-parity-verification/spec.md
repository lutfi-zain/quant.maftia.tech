## MODIFIED Requirements

### Requirement: Pipeline Execution and 1:1 Parity Verification across all 4 Quantitative Systems

The verification harness (`verify_pipeline_api_parity.py`) SHALL execute `python3 /home/ubuntu/projects/run_report_pipeline.py` and verify that the resulting outputs in `maftia_quant.db` (`master_ohlcv` and `unified_daily_analytics`) match the JSON payloads returned by the Hono API Gateway (`http://127.0.0.1:8765/api/v1/analytics/daily?limit=365`) exactly 1:1 for every single metric and date stamp.

#### Scenario: 1:1 numeric precision verification across all quantitative pillars
- **WHEN** the verification harness queries `maftia_quant.db` using SQLite Write-Ahead Logging (`WAL`) mode and fetches daily telemetry from the API Gateway (`:8765`)
- **THEN** every numeric field (`open`, `high`, `low`, `close`, `volume`, `valuation_composite`, `lttd_score`, `lttd_prob_bull`, `lttd_prob_bear`, `lttd_prob_sideways`, `mttd_imo`, `mttd_er`, `mttd_entropy`, `ichimoku_imo`) SHALL match within a strict tolerance of $|a - b| < 10^{-6}$

#### Scenario: Exact categorical regime matching across LTTD, MTTD, and Ichimoku
- **WHEN** categorical and boolean indicator fields are evaluated across all 365 daily rows
- **THEN** the exact strings (`BULL`, `BEAR`, `SIDEWAYS`, `NEUTRAL`) for `lttd_regime`, `mttd_position`, and `ichimoku_regime`, and boolean flags (`sideways_zero_exposure_lock`, `bubble_warning`, `deep_discount_override`, `mttd_immunity_active`) SHALL match 1:1 between database records and API responses with zero mismatches

### Requirement: Ichimoku metric 1:1 parity validation between pipeline output and prior system

The verification harness (`verify_pipeline_api_parity.py`) SHALL extend its parity checks to include Ichimoku S-component fields (S_TK, S_Cloud, S_Future, S_Chikou) and Ichimoku line fields (tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b) from the `UnifiedDailyAnalytics` table and the API Gateway response. Each numeric field SHALL match within a strict tolerance of $|a - b| < 10^{-6}$.

The Ichimoku fields to verify are:
- `ichimoku_imo` (oscillator)
- `ichi_s_tk` / `ichimoku_imo.s_tk`
- `ichi_s_cloud` / `ichimoku_imo.s_cloud`
- `ichi_s_future` / `ichimoku_imo.s_future`
- `ichi_s_chikou` / `ichimoku_imo.s_chikou`
- `ichi_tenkan` / `ichimoku_imo.tenkan`
- `ichi_kijun` / `ichimoku_imo.kijun`
- `ichi_senkou_a` / `ichimoku_imo.senkou_a`
- `ichi_senkou_b` / `ichimoku_imo.senkou_b`

#### Scenario: S-component numeric precision check between DB and API
- **WHEN** the verification harness queries `unified_daily_analytics` rows from `maftia_quant.db` and fetches the corresponding daily API response
- **THEN** every Ichimoku S-component and Ichimoku line numeric field SHALL match between the database record and API response with $|a - b| < 10^{-6}$ tolerance

#### Scenario: Categorical Ichimoku regime matching
- **WHEN** categorical fields for Ichimoku are evaluated
- **THEN** the exact strings (`BULL`, `BEAR`, `NEUTRAL`) for `ichimoku_regime` SHALL match 1:1 between database records and API responses with zero mismatches

### Requirement: Prior system output vs pipeline output cross-validation

The verification harness SHALL also validate that the Ichimoku values stored by the pipeline in `unified_daily_analytics` match the prior system's raw output DataFrame values. This SHALL be done by running the prior system's `generate_ichimoku_features()` + `generate_signals()` directly in the harness and comparing column-by-column against the pipeline's DB output.

#### Scenario: Direct comparison against prior system features
- **WHEN** the verification harness imports and runs `quant-lttd-ichimoku` feature generation on the latest OHLCV data
- **THEN** the resulting S_TK, S_Cloud, S_Future, S_Chikou, IMO, tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b values SHALL match the corresponding columns in `unified_daily_analytics` with $|a - b| < 10^{-6}$ for every common date

### Requirement: Causal Filter Verification ($t-1$ Stamp Integrity)

The API Gateway and database pipeline SHALL strictly forbid any future timestamps beyond the current date `today` from leaking into `UnifiedDailyAnalytics` (`unified_daily_analytics`) or `MasterOHLCV` (`master_ohlcv`).

#### Scenario: Zero lookahead bias check on API responses
- **WHEN** the `GET /api/v1/analytics/daily?limit=365` endpoint is queried
- **THEN** no returned item SHALL possess a `date` stamp greater than the server's current UTC (`YYYY-MM-DD`) date

### Requirement: Equity Curve Parity Verification (Cumulative Return Matching)

The verification harness (`verify_pipeline_api_parity.py`) SHALL cross-validate the cumulative strategy return and cumulative market return between the prior system's authority and the pipeline output.

The harness SHALL:
1. Run `backtest.run_backtest()` from the prior system against the `df_ich` DataFrame (same data the pipeline uses) to compute authoritative `Cum_Strat` and `Cum_Market`.
2. Query `unified_daily_analytics.ichi_cum_strat` and `ichi_cum_market` from the database.
3. Compare the two across all dates.

#### Scenario: Final cumulative return matches within tolerance
- **WHEN** the verification harness computes the prior system's final `Cum_Strat.iloc[-1]`
- **THEN** the database `ichi_cum_strat` on the same final date SHALL match within tolerance $|a - b| < 10^{-6}$

#### Scenario: Cumulative market return matches buy-and-hold
- **WHEN** the verification harness computes the prior system's `Cum_Market.iloc[-1]`
- **THEN** the database `ichi_cum_market` on the same final date SHALL match within tolerance $|a - b| < 10^{-6}$

### Requirement: Sharpe Ratio Parity Verification

The verification harness SHALL compute the Sharpe ratio from the prior system's `Strat_Net_Ret` series and verify against pipeline-derived daily returns (computed from `ichi_cum_strat` differences). Furthermore, the harness SHALL verify that `studioBacktest.ts` outputs the exact identical Sharpe Ratio for both Strategy (`sharpeRatio`) and Market (`sharpeRatioMarket`).

Annualized Sharpe = (Mean daily return / Std daily return) × sqrt(365.25)

#### Scenario: Sharpe ratio matches exact canonical formula
- **WHEN** the verification harness computes Sharpe from the prior system's backtest
- **THEN** both the pipeline-derived Sharpe and the frontend studio-computed Sharpe SHALL match with $|a - b| < 10^{-6}$

### Requirement: Max Drawdown Parity Verification

The verification harness SHALL compute max drawdown from both the prior system's and the pipeline's equity curves, and verify that `studioBacktest.ts` produces the exact identical max drawdown percentage for both Strategy (`maxDd`) and Market (`maxDdMarket`).

Drawdown = (Peak equity - Current equity) / Peak equity

#### Scenario: Max drawdown matches exactly across all layers
- **WHEN** the verification harness computes max drawdown from `backtest.py`
- **THEN** both the database equity series drawdown and the frontend studio-computed `maxDd` / `maxDdMarket` SHALL match within $|a - b| < 10^{-6}$

### Requirement: Trade Count Parity Verification

The verification harness SHALL count the number of position transitions (0→1 and 1→0) in the reference position signal (`ichi_ref_pos`) and compare against the prior system's trade count from `run_backtest()`. Furthermore, it SHALL verify that `studioBacktest.ts` generates the exact same total trade count and win/loss ratio (`winRate`).

#### Scenario: Trade count matches exactly
- **WHEN** the verification harness counts position transitions and completed trades
- **THEN** the integer trade count (`totalTrades`) and exact win rate (`winRate`) SHALL match 1:1 across all layers with zero discrepancy

### Requirement: Reference Position Integrity (Override Detection)

The verification harness SHALL verify that `ichi_ref_pos` (pure) and `ichimoku_position` (overridden) diverge on dates where macro overrides are active, and match on all other dates.

#### Scenario: Position divergence indicates correct override application
- **WHEN** LTTD regime is SIDEWAYS with probability > 0.6 on a given date
- **THEN** `ichi_ref_pos` SHALL retain the pure Ichimoku signal value (0 or 1) on that date
- **AND** `ichimoku_position` SHALL be 0.0 on that date (overridden)
