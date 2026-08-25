## Why

The current Valuation Composite suffers from two structural quantitative flaws:
1. **Non-Stationary Metric Contamination (Option 2)**: Indicators like `two_year_ma_rcap` and `terminal_price_ratio` produce raw values whose scale grows exponentially across cycles. In historical backtesting, this causes them to output extreme overvaluation scores (`-2.0`) even during major macro cycle bottoms (e.g. Nov 2022 FTX crash at $15.5k), pulling the bottom composite score down from what should be `+2.0` max undervaluation to `+1.78`.
2. **Timeframe Contamination / Premature Peak Signals (Option 3)**: Fast 14–30 day sentiment and momentum indicators (`fear_greed_og`, `fear_greed_cmc`, `williams_r`, `dvrsi`) are currently mixed into the same flat average as 4-year macro cycle metrics. During mid-cycle rallies (such as March 2024 ETF surge to $73k), short-term indicators max out, falsely driving the Master Macro Valuation Composite to an extreme peak score (`-2.0`) over 6 months before the actual cycle top.

## What Changes

- **Stationarize `two_year_ma_rcap` & `terminal_price_ratio`**: Refactor raw metric formulations to dimensionless percentage deviations: `(price - 2Y_MA) / 2Y_MA` and `(price - terminal_price) / terminal_price`. Recalibrate `metric_config` thresholds to ensure zero cycle drift.
- **Decouple Macro Valuation & Tactical Sentiment**: Split the composite system into two clean layers:
  - **Macro Valuation Composite**: A pure 1–4 year macro valuation score calculated strictly from structural on-chain and fundamental valuation indicators (`mvrv_z`, `aviv_ratio`, `cvdd_ratio`, `two_year_ma_ratio`, `terminal_price_ratio`, `lth_sth_sopr_ratio`, `unrealized_sell_risk`, `seller_exhaustion`, `vpli`, `ahr999`, and their CVSC variants).
  - **Tactical Sentiment Overlay**: A 7–30 day momentum & sentiment overlay (`fear_greed_og`, `fear_greed_cmc`, `williams_r`, `dvrsi`, `sharpe_ratio_52w`) preserved as execution timing filters but excluded from the macro cycle composite score.
- **Full Historical Rebuild & Pipeline Sync**: Recompute timeseries metrics, execute `--rebuild`, update `maftia_quant.db` tables (`unified_daily_analytics` and `unified_component_signals`), and verify historical cycle peaks and bottoms.

## Capabilities

### New Capabilities
- `stationary-valuation-metrics`: Stationarization of `two_year_ma_rcap` and `terminal_price_ratio` metrics ensuring scale invariance across Bitcoin halvings.
- `tactical-sentiment-overlay`: Independent 7–30 day tactical sentiment & momentum layer decoupled from macro valuation aggregation.

### Modified Capabilities
- `valuation-composite`: Updated `ValuationComposite` calculation strictly averaging stationary macro valuation metrics and excluding short-term tactical indicators.

## Impact

**Systems Affected:** System 1 of 4 (Valuation System). No impact on LTTD, MTTD, or Ichimoku.

**Code Affected:**
- `engines/valuation/quant/components/two_year_ma_rcap.py` — stationarized formula
- `engines/valuation/quant/components/terminal_price_ratio.py` — stationarized formula
- `engines/valuation/quant/seed_metric_config.py` — updated thresholds & category tagging (`macro_valuation` vs `tactical_sentiment`)
- `engines/valuation/quant/audit/composite.py` — macro-only aggregation logic
- `run_report_pipeline.py` — report pipeline sync

**Database & API Impact:** `unified_daily_analytics` table will reflect pure macro valuation composite scores. `unified_component_signals` table will tag indicators by `category` (`macro` vs `tactical`). No breaking API gateway schema changes.

**Non-Goals:**
- No changes to LTTD HMM model, MTTD oscillator, or Ichimoku SuperSmoother engine.
- No changes to `quant-technical-indicator-bank` (deprecated).
- No changes to frontend visual UI layouts.
