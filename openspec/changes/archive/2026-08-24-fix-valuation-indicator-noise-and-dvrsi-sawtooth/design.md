## Context

Exploratory data analysis (EDA) of the Valuation System indicator time series highlights two primary sources of high-frequency noise that pollute the `ValuationComposite` score:

1. **`dvrsi` Sawtooth Noise (STD = 1.1846)**: The `dvrsi` component is calculated weekly (using weekly price and volume data). During daily resampling, the component implements a daily price RSI fallback for the 6 missing days. Because daily RSI operates on a completely different scale from the weekly volume-weighted DVRSI, this creates a massive sawtooth wave every week (jumps from ~39 to ~50-70).
2. **`lth_sth_sopr_ratio` Daily Spikes (STD = 0.6223)**: Daily SOPR values are extremely volatile, reflecting short-term on-chain transactions rather than macro-cycle trends.

## Goals / Non-Goals

**Goals:**

- Eliminate the 7-day cyclical sawtooth wave in `dvrsi` by forward-filling (`ffill()`) weekly values across daily indices instead of using the daily price RSI fallback.
- Smooth the raw `lth_sth_sopr_ratio` indicator using a causal 14-day simple moving average.
- Re-run the data sync pipeline to rebuild historical tables with smooth, noise-reduced values.

**Non-Goals:**

- Modifying the underlying mathematical formulas of weekly DVRSI or LTH/STH SOPR ratio.
- Altering the threshold parameters in `metric_config`.

## Decisions

### Decision 1: Replace daily RSI fallback with forward-fill (`ffill`) for `dvrsi`

- **Chosen:** Delete the daily price fallback logic in `dvrsi.py` and replace it with `.reindex(daily_idx).ffill()`, identical to the pattern used in `williams_r.py`.
- **Alternative considered:** Keep the daily fallback but recalibrate its thresholds separately. Rejected because it adds excessive complexity, makes the indicator harder to maintain, and requires extra daily API fetches.
- **Rationale:** Forward-filling weekly values is the standard, statistically sound method for resampling low-frequency cycle indicators to higher daily resolutions. It guarantees 100% data coverage with zero scale mismatch and zero sawtooth artifacts.

### Decision  decision 2: Apply a causal 14-day SMA to LTH/STH SOPR ratio

- **Chosen:** Smooth the raw ratio (`value_lth / value_sth`) in `lth_sth_sopr_ratio.py` using a 14-day rolling mean: `df["raw_value"] = (df["value_lth"] / df["value_sth"]).rolling(window=14, min_periods=1).mean()`.
- **Alternative considered:** Apply smoothing at the normalized level. Rejected because normalization is non-linear (piecewise), and smoothing raw values preserves correct threshold mapping.
- **Rationale:** A 14-day SMA effectively filters out daily high-frequency transaction spikes while maintaining a causal ($t-1$) structure that avoids lookahead bias.

## Risks / Trade-offs

- **[Risk]** Forward-filling weekly `dvrsi` introduces a slight delay in signal response (up to 6 days).
  - **Mitigation:** Valuation is a macrocycle cycle system (focusing on multi-year bottoms and tops), so a 6-day lag has zero material impact on FSM states.
- **[Risk]** The 14-day SMA on `lth_sth_sopr_ratio` could damp peak extremes.
  - **Mitigation:** The thresholds for `lth_sth_sopr_ratio` (`[0.73, 0.99, 3.2, 6.9]`) are wide enough to accommodate the smoothed ratio since extreme cycle peaks are prolonged over weeks.
