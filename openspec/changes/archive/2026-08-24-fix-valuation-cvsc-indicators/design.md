## Context

The Valuation System computes a composite score from ~23 indicators, 6 of which are "CVSC-adjusted" variants that divide raw metric values by `CVSC_norm = log10(Cointime Value Stored Cumulative)`. This CVSC adjustment is designed to eliminate diminishing returns (DR) across Bitcoin cycles by normalizing against the growing cointime value of the network.

**Current state:** `compute_cvsc_norm()` in `normalization.py` attempts to load CVSC data from `bitview.space` via `fetch_series("cointime_value_stored_cumulative")`. When this fails (network error, API change, rate limiting), it returns `1.0` as fallback. This makes the division `raw / 1.0 = raw` — a no-op. The `metric_config` thresholds for CVSC indicators were calibrated expecting CVSC-divided values (e.g., `mvrv_z_cvsc` thresholds: `[-0.06, 0.15]`), but actual raw values are `~0.35` because the CVSC division never reduces them. Result: all raw values exceed `t_minus_2`, clamping to `-2.0`.

The `expanding_window_rescale` step cannot recover because it operates on the already-saturated normalized output (constant `-2.0` series has zero variance, so all percentile anchors collapse).

**CVSC expected range:** For modern Bitcoin (2020+), `CVSC ≈ 10^13 to 10^14`, so `log10(CVSC) ≈ 13–14`. A `mvrv_z_raw` of `~4.9` divided by `14` yields `~0.35`, which falls within the threshold range `[-0.06, 0.15]`... wait, that's still above `0.15`. This reveals that the thresholds themselves need recalibration even with correct CVSC norms.

## Goals / Non-Goals

**Goals:**
- Ensure `compute_cvsc_norm()` reliably returns `log10(CVSC) ≈ 13–14` via multi-tier caching
- Recalibrate `metric_config` thresholds for all 6 CVSC indicators based on actual post-CVSC-division value distributions
- Full historical rebuild to populate correct normalized scores
- Add a distribution guard to catch future threshold miscalibrations
- Maintain zero lookahead bias (causal `t-1` filtering)

**Non-Goals:**
- No changes to the `normalize()` piecewise linear interpolation algorithm
- No changes to non-CVSC indicator thresholds
- No frontend changes
- No changes to LTTD, MTTD, or Ichimoku systems
- No changes to `quant-technical-indicator-bank` (deprecated)

## Decisions

### D1: Multi-tier CVSC cache with SQLite persistence

**Decision:** Add a `cvsc_cache` SQLite table in `metrics.db` that stores `(date, cvsc_value, fetched_at)`. The loading order becomes:
1. Check in-memory `_cvsc_cache` dict (existing behavior, fast path)
2. If empty, load from `cvsc_cache` SQLite table (local persistence)
3. If table is empty or stale (>24h for latest date), fetch from bitview.space API
4. If API fails, use hardcoded approximation: `CVSC ≈ 10^(12.5 + 0.15 * years_since_2015)` (linear growth model in log-space)
5. **Never return 1.0** — the minimum valid `cvsc_norm` is `~12.0` (early Bitcoin history)

**Why not just fix the API call?** The API is an external dependency that can fail at any time. A local SQLite cache provides persistence across runs and eliminates the single point of failure. The hardcoded approximation is a last-resort fallback that produces reasonable (not perfect) values.

**Alternative considered:** Bundling a full CVSC CSV file (~6KB for daily values since 2009). Rejected because it requires manual updates and doesn't self-heal when the API recovers.

### D2: Percentile-based threshold recalibration via full rebuild

**Decision:** After fixing CVSC norm loading, run `--rebuild` for all 6 CVSC components to get the true distribution of CVSC-divided raw values. Then set thresholds as:
- `t_plus_2` = p2.5 (deep discount / cycle bottom)
- `t_plus_1` = p25 (moderate discount)
- `t_minus_1` = p75 (moderate overvaluation)
- `t_minus_2` = p97.5 (extreme overvaluation / cycle peak)

This ensures the thresholds are empirically grounded rather than manually guessed. The seed script (`seed_metric_config.py`) will be updated with the recalibrated values.

**Why not use expanding_window_rescale instead of fixed thresholds?** The CVSC components already have `rescale_method=expanding_window`. But the rescale step operates on the output of `normalize()`, which uses fixed thresholds. If the fixed thresholds are wildly wrong (as they are now), `normalize()` produces degenerate output and the rescale cannot recover. The fix is to make the first-pass thresholds reasonable so the rescale step has variance to work with.

**Alternative considered:** Bypassing `normalize()` entirely and applying `expanding_window_rescale()` directly on raw values. Rejected because this breaks the architectural contract where all indicators share the same `normalize()` → `rescale()` pipeline, and because raw CVSC values have different scales across indicators (making cross-indicator comparison in the middleware impossible).

### D3: Advisory distribution guard in base pipeline

**Decision:** Add a post-`store()` check in `_default_run_pipeline()` that queries the stored `normalized_value` distribution for the component. If >95% of values are at a single boundary (`-2.0` or `+2.0`), emit a `WARNING` log and include `"distribution_warning"` in the pipeline return dict.

**Why 95%?** Some indicators legitimately spend significant time at boundaries (e.g., `fear_greed_og` has many days at `+2.0` during deep bear markets). But 95%+ indicates a systematic problem rather than genuine market conditions.

**Why advisory, not blocking?** Blocking the pipeline would prevent data from being stored, which is worse than storing potentially miscalibrated data. The warning enables monitoring and alerting without disrupting the daily pipeline run.

### D4: Degenerate series handling in expanding_window_rescale

**Decision:** When `expanding_window_rescale()` encounters a series where all historical values are identical (p2.5 == p97.5, i.e., zero variance), return `0.0` (neutral) instead of propagating the boundary value.

**Why 0.0?** A constant series provides zero information about where the current value sits in the distribution. `0.0` (fair value / neutral) is the least presumptive default. Returning the boundary value (`-2.0` or `+2.0`) would assert extreme conviction based on zero evidence.

## Risks / Trade-offs

- **[Historical data shift]** → Full rebuild changes all historical CVSC component scores and consequently the composite. This may affect downstream systems (LTTD circuit breaker thresholds). Mitigation: Run the rebuild on a copy of `metrics.db` first, compare composite distributions before and after, validate that known cycle peaks (Nov 2021, Sep-Nov 2025) still trigger appropriate overvaluation signals.
- **[Hardcoded CVSC approximation drift]** → The linear log-space growth model `10^(12.5 + 0.15 * years)` will diverge from reality over time. Mitigation: This is a last-resort fallback behind two other tiers (SQLite cache, API). If the API recovers, correct values overwrite the approximation. Add a log entry when using the approximation so it's visible.
- **[Threshold recalibration requires manual step]** → The percentile-based thresholds must be computed from the rebuilt data and manually inserted into `seed_metric_config.py`. Mitigation: Create a one-shot script that computes and prints the recommended thresholds after rebuild, making the manual step trivial.
- **[CVSC data availability for early dates]** → CVSC data may not be available for dates before 2011. For these dates, `compute_cvsc_norm()` should use the approximation formula rather than returning `1.0`. Mitigation: The approximation formula covers all dates back to 2009.

## Open Questions

1. **What is the actual CVSC data availability window from bitview.space?** Need to verify if the API returns data back to Bitcoin genesis or only recent years. This determines how much of the early history relies on the approximation formula.
2. **Should `terminal_price_ratio` thresholds also be reviewed?** It's persistently at `-1.3` to `-1.4`, which is not stuck-at-boundary but consistently overvalued. May indicate threshold miscalibration for the current price regime, but is lower priority than the CVSC fixes.
