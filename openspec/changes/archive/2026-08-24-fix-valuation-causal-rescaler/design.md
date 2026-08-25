## Context

The Valuation System currently aggregates the `ValuationComposite` score by applying an asymmetric multiplier and IIP penalty (`cvsc_factor`, `vol_factor`, `iip_penalty`) when the raw mean score is negative (overvalued). The result is then clamped and passed into a percentile rescaler (`p2_5` to `p97_5`) that uses an expanding window from 2010 to current day `t-1`.

This causes structural overfitting:
1. **Expanding Window Contamination**: The pre-institutional era (2010-2015) dominates the percentile bounds. Modern mid-cycle peaks are prematurely clamped to `-2.0` (e.g., March 2024) because the historical `p2_5` bound is too tight (e.g. `-0.88`).
2. **Asymmetric Heuristics**: Applying a multiplier only to negative values distorts the natural distribution of the indicators, creating an arbitrary and non-linear target leakage that pollutes the subsequent percentile rescaling.

## Goals / Non-Goals

**Goals:**
- Replace the expanding window with a rolling 4-year (1460-day) causal window to estimate `p2_5`, `p50`, and `p97_5`.
- Remove the asymmetric heuristics (`cvsc_factor`, `vol_factor`, `iip_penalty_val`) from the valuation composite calculation.
- Maintain strict causal (zero lookahead) data filtering (use only data up to $t-1$).
- Preserve the mathematically correct `[-2.0, +2.0]` boundary clamping.

**Non-Goals:**
- Do not modify the calculation or internal logic of the 17 individual component indicators.
- Do not modify or introduce the deprecated `quant-technical-indicator-bank`.

## Decisions

1. **Rolling 4-Year (1460-day) Window**: We chose 4 years (1460 days) instead of shorter periods because it corresponds to approximately one Bitcoin halving cycle. This ensures the window captures at least one full bull market, bear market, and sideways transition, preventing the percentiles from collapsing during prolonged single-trend regimes. It cleanly excludes the structurally distinct market behavior of the 2010-2015 era from modern calculations.
2. **Removal of Heuristic Multipliers**: The asymmetric multipliers were originally a band-aid to force the composite output to hit `-2.0` at tops, which was only necessary because the expanding window rescaler failed to adapt. By fixing the rescaler with a rolling window, the multipliers are no longer required. Removing them restores mathematical symmetry and statistical rigor to the pipeline.

## Risks / Trade-offs

- [Risk: Short History Initial Bounds] → When running backtests from 2010, the initial 4 years will not have a full 1460 days of history. Mitigation: The implementation will use a slice representing the last 1460 days, which will naturally act as an expanding window until day 1460, after which it strictly rolls.
- [Risk: Over-normalization during extreme shifts] → If the market enters a multi-cycle secular trend > 4 years, a 4-year rolling window might normalize extreme values too quickly. Mitigation: The 4-year halving cycle is the empirically proven dominant structural feature, and a 4-year window is standard institutional practice for cyclical assets.
