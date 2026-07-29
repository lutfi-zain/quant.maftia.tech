## Why

5 CVSC-adjusted valuation indicators (`ahr999_cvsc`, `mvrv_z_cvsc`, `pi_cycle_top_cvsc`, `risk_metrics_cvsc`, `two_year_ma_rcap`) are permanently stuck at `normalized_score = -2.0` (extreme cycle peak / overvalued), regardless of actual market conditions. This systematically drags the Valuation Composite Score downward by ~0.72 points, making accumulation signals appear muted during undervalued periods and amplifying false overvaluation signals during trending markets. The root cause is twofold: (1) `compute_cvsc_norm()` falls back to `1.0` when CVSC cache loading fails, making the CVSC division a no-op, and (2) the `metric_config` thresholds for these indicators were calibrated for CVSC-divided scales that never materialize, causing all raw values to exceed `t_minus_2` and clamp to `-2.0`. The `expanding_window_rescale` safety net cannot recover because it receives a constant `-2.0` series with zero variance.

## What Changes

- **Fix CVSC cache reliability**: Ensure `compute_cvsc_norm()` reliably loads and returns `log10(CVSC)` values (~13–14) instead of falling back to `1.0`. Add persistent local caching with fallback chain (live API → cached SQLite → hardcoded historical percentiles).
- **Recalibrate CVSC metric thresholds**: After fixing the CVSC norm, raw values will shrink by ~14×. Recalibrate `metric_config` thresholds for `ahr999_cvsc`, `mvrv_z_cvsc`, `pi_cycle_top_cvsc`, `risk_metrics_cvsc`, `two_year_ma_rcap`, and `vpli_cvsc` using actual post-CVSC-division percentile distributions (p2.5, p25, p75, p97.5 from full historical rebuild).
- **Full historical rebuild**: Execute `--rebuild` for all 6 CVSC components to recompute normalized scores with corrected CVSC norms and recalibrated thresholds.
- **Add pipeline validation gate**: Add a post-pipeline assertion that no component has >95% of its normalized values at exactly `-2.0` or `+2.0`, catching future threshold miscalibrations automatically.

## Capabilities

### New Capabilities
- `cvsc-cache-resilience`: Persistent local CVSC cache with multi-tier fallback (live fetch → SQLite cache → embedded historical), ensuring `compute_cvsc_norm()` never degrades to the `1.0` fallback.
- `component-distribution-guard`: Post-pipeline statistical validation gate that flags indicators with degenerate score distributions (>95% at boundary values), preventing broken components from silently contaminating the composite.

### Modified Capabilities
- `valuation-composite`: Composite score accuracy restored — 5 broken indicators will produce meaningful oscillating values instead of constant `-2.0`, shifting the composite from systematically biased (~+0.59) to calibrated (~+1.31 in current market).
- `causal-expanding-rescaling`: Rescale step will operate on non-degenerate input series, enabling proper percentile-based normalization across all CVSC components.

## Impact

**Systems affected:** Valuation System only (System 1 of 4). No impact on LTTD, MTTD, or Ichimoku.

**Code affected:**
- `engines/valuation/quant/components/normalization.py` — `compute_cvsc_norm()` and cache loading
- `engines/valuation/database/metrics.db` — `metric_config` table threshold values for 6 CVSC metrics
- `engines/valuation/quant/seed_metric_config.py` — seed data for recalibrated thresholds
- `engines/valuation/quant/components/base.py` — validation gate in `_default_run_pipeline`
- `run_report_pipeline.py` — composite recalculation after rebuild

**API impact:** `GET /api/v1/quant/components?system=quant-btc-valuation-system` will return recalibrated normalized scores for CVSC components. Composite score values will shift upward in non-peak market conditions. No schema changes.

**Data impact:** Full historical rebuild of 6 CVSC component timeseries (~6,000+ rows each). Composite historical values will change retroactively.

**Non-goals:**
- No changes to non-CVSC indicator thresholds or normalization logic.
- No modifications to `quant-technical-indicator-bank` (deprecated).
- No changes to LTTD, MTTD, or Ichimoku systems.
- No frontend UI changes (scores flow through existing rendering paths).
- No changes to the piecewise linear interpolation algorithm itself (`normalize()` function).
