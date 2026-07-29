## Context

The Valuation System currently aggregates ~24 indicators into a single arithmetic mean. Analysis of historical cycle extreme dates revealed two major architectural defects:

1. **Non-stationarity in `two_year_ma_rcap` and `terminal_price_ratio`**:
   - `two_year_ma_rcap` is calculated as `two_year_ma / log10(CVSC)`. Because `two_year_ma` grows exponentially ($5 \rightarrow $30,000 \rightarrow $87,000) while `log10(CVSC)` grows linearly ($10 \rightarrow 14$), the metric's raw mean drifts from 0.49 in 2011 to 6,126 in 2026.
   - When fixed historical thresholds are applied, `two_year_ma_rcap` outputs `-2.0` overvaluation scores even at cycle bottoms (e.g. Nov 2022 FTX crash at $15.5k), pulling the bottom composite score down to `+1.783` instead of reaching `+2.000`.

2. **Timeframe contamination by 14-day tactical indicators**:
   - Fast indicators (`fear_greed_og`, `fear_greed_cmc`, `williams_r`, `dvrsi`, `sharpe_ratio_52w`) measure short-term momentum and sentiment.
   - During strong mid-cycle rallies (e.g. March 2024 ETF surge to $73k), short-term indicators hit extreme overbought levels (-2.0), while macro structural valuation metrics (`mvrv_z` ~2.9, `cvdd_ratio` ~3.6) remained far from cycle top levels.
   - Including short-term indicators in the macro composite average drove the overall score to `-2.000` in March 2024, 6+ months before the actual macro top.

## Goals / Non-Goals

**Goals:**
- Stationarize `two_year_ma_rcap` and `terminal_price_ratio` to percentage/ratio deviations: `(close - 2Y_MA) / 2Y_MA` and `(close - terminal_price) / terminal_price`.
- Decouple short-term tactical indicators (`fear_greed_og`, `fear_greed_cmc`, `williams_r`, `dvrsi`, `sharpe_ratio_52w`) from the macro composite calculation.
- Re-run full rebuild for affected components and recalibrate thresholds.
- Verify that Nov 2022 bottom composite reaches `+2.000` (or `> +1.95`) and March 2024 mid-cycle rally remains in fair-value/mild bull territory (`-0.3` to `-0.5`) rather than `-2.000`.

**Non-Goals:**
- No changes to LTTD, MTTD, or Ichimoku engines.
- No changes to `quant-technical-indicator-bank` (deprecated).
- No frontend visual changes (API output remains backward compatible).

## Decisions

### Decision 1: Stationarization Formulation
Convert `two_year_ma_rcap` from `two_year_ma / log10(CVSC)` to `(close - two_year_ma) / two_year_ma`.
- **Rationale**: The 2-Year MA Multiplier (popularized by Philip Swift) uses `price / 2Y_MA` as a stationary cycle metric (bottom at ~0.7x 2Y MA, top at ~5.0x 2Y MA). Subtracting 1 yields a clean percentage deviation bounded in `[-0.3, +4.0]`.
- Convert `terminal_price_ratio` to `(close - terminal_price) / terminal_price`.

### Decision 2: Category Tagging and Composite Filtering
In `seed_metric_config.py` and `audit/composite.py`:
- Add `category_layer` column to `metric_config`: `'macro_valuation'` vs `'tactical_sentiment'`.
- Macro Valuation Composite calculation will filter strictly for `category_layer == 'macro_valuation'`.
- Tactical indicators (`fear_greed_og`, `fear_greed_cmc`, `williams_r`, `dvrsi`, `sharpe_52w`) will be calculated and stored in `timeseries_metrics` and `unified_component_signals` for tactical charts, but excluded from the `ValuationComposite` average.

## Risks / Trade-offs

- **[Historical score shift]** → Changing composite components will shift past composite values. Mitigation: Run pipeline verification and confirm historical peak/bottom fidelity (Nov 2021 = peak `-2.0`, Nov 2022 = bottom `+2.0`, March 2024 = mid-cycle `-0.4`).
- **[Database schema migration]** → Adding `category_layer` column to `metric_config`. Mitigation: Use `ALTER TABLE metric_config ADD COLUMN category_layer TEXT DEFAULT 'macro_valuation'` with try/except fallback.
