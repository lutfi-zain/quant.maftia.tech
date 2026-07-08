## Why

We must execute the authoritative quantitative pipeline (`python3 /home/ubuntu/projects/run_report_pipeline.py`) and perform rigorous, automated end-to-end 1:1 metric verification against the API Gateway (`api.quant.maftia.tech` on `:8765`) and underlying `maftia_quant.db` relational tables. Ensuring 1:1 mathematical and structural parity across all 4 unified quantitative defense systems (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, and `IchimokuDenoisedOscillator`) eliminates drift, schema mismatches, and causal filtering inconsistencies across the executive financial terminal.

## What Changes

- Execute `python3 /home/ubuntu/projects/run_report_pipeline.py` to trigger full pipeline recalculation across all 4 quantitative defense systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`).
- Build and execute an automated 1:1 verification test harness that queries `maftia_quant.db` (`master_ohlcv`, `unified_daily_analytics`, `unified_component_signals`) and compares exact outputs row-by-row and metric-by-metric against the REST API Gateway (`http://127.0.0.1:8765/api/v1/analytics/daily` and `/api/v1/system/circuit-breakers`).
- Verify strict causal filtering ($t-1$ stamp verification and zero lookahead bias) across all time-series metrics.
- Fix any numerical discrepancies, schema mismatches, or missing column mappings between pipeline outputs and API responses to guarantee 100% 1:1 parity across `valuation_composite`, `lttd_regime`, `lttd_score`, `lttd_prob_*`, `mttd_imo`, `mttd_er`, `mttd_entropy`, `ichimoku_imo`, and `master_ohlcv` attributes.

## Capabilities

### New Capabilities
- `pipeline-metrics-parity-verification`: Automated test suite and validation engine verifying 1:1 numerical and structural parity across all 4 unified quantitative systems between pipeline runs, SQLite WAL tables, and API Gateway REST responses.

### Modified Capabilities

## Impact

- **Affected Systems**: All 4 unified quantitative defense systems (`Valuation`, `LTTD`, `MTTD`, `Ichimoku`), orchestration pipeline (`run_report_pipeline.py`), database (`maftia_quant.db`), and Hono API Gateway (`src/api/routes/daily.ts`).
- **Non-goals**: No changes to deprecated legacy systems (`quant-technical-indicator-bank`), and no changes to core mathematical formulas unless required to fix numerical precision drift between database storage and API serialization.
