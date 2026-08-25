## Why

An exploratory data analysis (EDA) of daily changes in the Valuation System indicators reveals severe artificial noise and volatility:

1. **`dvrsi` Sawtooth Noise (STD = 1.1846)**: Mixing weekly volume-adjusted DVRSI values with daily RSI fallback values on the other 6 days of the week creates a massive sawtooth wave where the score jumps up to +2.0 every Saturday and drops to -1.6 on other days. This introduces a 7-day cyclical noise component to the `ValuationComposite`.
2. **`lth_sth_sopr_ratio` Daily Spikes (STD = 0.6223)**: Daily Spent Output Profit Ratio (SOPR) transactions are highly volatile and create daily high-frequency noise that is unrelated to the macrocycle trend.

## What Changes

- Replace the daily RSI fallback logic in `engines/valuation/quant/components/dvrsi.py` with a simple daily forward-fill (`ffill()`) of the weekly volume-weighted DVRSI value. This eliminates the sawtooth wave while maintaining 100% daily coverage.
- Apply a causal 14-day simple moving average (`rolling(14).mean()`) to the raw ratio in `engines/valuation/quant/components/lth_sth_sopr_ratio.py` before normalization. This removes daily transaction noise while preserving zero lookahead bias.
- Re-run the data sync pipeline to populate smooth, noise-reduced values.

## Non-goals

- Modifying the underlying math of weekly DVRSI or LTH/STH SOPR ratio calculations.
- Changing LTTD, MTTD, or Ichimoku engine logic.
- Re-introducing the deprecated `quant-technical-indicator-bank`.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities

- `valuation-pca-compression`: Update the data completeness fallback protocol for `dvrsi` to use forward-filling (`ffill()`) instead of daily RSI fallback, and add a 14-day rolling average to the LTH/STH SOPR ratio raw calculation to filter daily transaction noise.

## Impact

- **Valuation System (`engines/valuation/quant/components/dvrsi.py` & `lth_sth_sopr_ratio.py`)**: Components modified.
- **Database (`metrics.db` & `maftia_quant.db`)**: Noise-reduced historical values will be stored.
