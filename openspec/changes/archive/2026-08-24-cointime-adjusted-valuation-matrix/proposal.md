## Why

The current Valuation Composite uses static-threshold indicators (MVRV Z-Score, Pi Cycle Top, Risk Metrics) that suffer from structural **Diminishing Returns (DR)** — their signal amplitude decays each cycle as Bitcoin's market cap grows faster than the threshold denominators. At the October 2025 cycle top ($124,658), the composite reached only -0.27 instead of the expected -2.0, because 10 of 11 indicators failed to register overvaluation. Comprehensive research shows that **cointime-adjustment** (dividing metrics by Cointime Value Stored Cumulative / CVSC) is the only transformation that consistently produces extreme readings across all six BTC cycles including 2025.

## What Changes

1. **Replace** static-threshold indicators (MVRV Z-Score, Pi Cycle Top, Risk Metrics, Two-Year MA, VPLI, LTH/STH SOPR) with cointime-adjusted versions that use CVSC or rolling cost-basis in the denominator
2. **Create** new composite indicators:
   - `Pi Cycle / CVSC` — cointime-adjusted Pi Cycle
   - `Risk Metrics / Rolling Realized Cap` — cointime-adjusted risk metrics
   - `Price-to-Cointime-Stored Ratio` — new anchored floor metric
3. **Retain** the expanding-window percentile rescaling on the final composite (proven to work), but feed it with DR-immune input indicators
4. **Drop** `lth_sth_sopr_ratio`, `sharpe_ratio_52w`, `fear_greed_og` from the active composite set (they are structurally DR-sensitive and unrecoverable)
5. **Add** `AVIV Ratio` as a permanently active indicator (it is naturally DR-immune)
6. **Update** the `run_report_pipeline.py` orchestration to use the new indicator set

## Capabilities

### New Capabilities

- `cointime-adjusted-indicators`: Cointime-normalized versions of MVRV Z, Pi Cycle, Risk Metrics, and 2-Year MA that divide raw values by CVSC or rolling realized cap to produce naturally stationary, DR-immune oscillators
- `composite-dr-correction`: The DR-immune composite aggregation engine that averages cointime-adjusted indicators through the existing expanding-window percentile rescaling pipeline

### Modified Capabilities

- `valuation-composite`: Update the indicator set to use cointime-adjusted versions instead of static-threshold legacy indicators; update the MIN_VALID_INDICATORS count from 10 to 8
- `causal-expanding-rescaling`: Extend the expanding-window percentile rescaling to also accept per-indicator rescaling transforms as optional preprocessing step

## Impact

- **System**: `quant-btc-valuation-system` — component scripts, normalization logic, and composite aggregation
- **Database**: `metric_config` table — thresholds for old indicators will be deprecated; new config rows for cointime-adjusted indicators
- **Pipeline**: `run_report_pipeline.py` — update indicator list, add CVSC fetch step
- **No impact** on LTTD, MTTD, or Ichimoku systems (valuation is a macro filter that reads from them, not the other way)

## Non-goals

- Removing the expanding-window percentile rescaling (it works and is not the problem)
- Modifying LTTD, MTTD, or Ichimoku subsystems
- Rewriting the frontend Valuation Studio UI — the endpoint contract remains the same
- Reintroducing `quant-technical-indicator-bank`
