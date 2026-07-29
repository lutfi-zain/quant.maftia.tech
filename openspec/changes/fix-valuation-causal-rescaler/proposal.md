## Why

The current Valuation Composite model uses an expanding window starting from 2010 to calculate causal percentiles (p2.5 and p97.5). This causes the distribution to be heavily skewed by the pre-institutional era (2010-2015) where metrics had higher variance and different baseline behaviors. As a result, the rescaler clamps modern mid-cycle values prematurely (e.g., March 2024 hits -2.0) while failing to reach true extremes during recent cycle tops and bottoms (e.g., Nov 2022 only reaching +1.89). Furthermore, the pipeline currently injects an arbitrary asymmetric multiplier (1.35x) and IIP penalty on negative values, which distorts the natural distribution of the indicators before the percentile scaling even occurs, violating quantitative best practices and creating target leakage.

## What Changes

- **BREAKING**: Replace the expanding window percentile calculation with a rolling 4-year (1460-day) causal window to align with one full Bitcoin cycle, ensuring the percentile thresholds adapt to modern market structures.
- **BREAKING**: Remove the ad-hoc asymmetric heuristic multipliers (`cvsc_factor`, `vol_factor`) and `iip_penalty` applied to negative raw values in the pipeline.
- Ensure the Valuation Composite operates on a clean, mathematically symmetric distribution before clamping to `[-2.0, +2.0]`.

## Capabilities

### New Capabilities
- `rolling-causal-rescaler`: A rolling 4-year (1460-day) causal percentile calculation to dynamically normalize the valuation composite score based on recent market structure (one full Bitcoin halving cycle), replacing the legacy expanding window.

### Modified Capabilities
- `valuation-composite`: The requirement to apply the `cvsc_factor`, `vol_factor`, and `iip_penalty` asymmetric multipliers on negative values is removed. The composite now strictly relies on the rolling causal rescaler for normalization.
- `causal-expanding-rescaling`: This capability is entirely replaced by `rolling-causal-rescaler`.
- `volatility-regime-multiplier`: This capability is removed/deprecated, as asymmetric multiplier heuristics are an anti-pattern.

## Impact

- **Affected Code**: `run_report_pipeline.py` (composite calculation pipeline), and `engines/valuation/quant/audit/composite.py`.
- **Database**: `unified_daily_analytics` and `unified_component_signals` will have modified `valuation_composite` scores across history.
- **Validation**: Walk-forward validation must confirm that the Nov 2022 bottom reaches +2.0, the Nov 2021 top reaches -2.0, and the March 2024 mid-cycle local peak remains in the `-0.3` to `-0.5` range without premature clamping.
- **System Impact**: Affects only `quant-btc-valuation-system`. Zero lookahead bias (strict $t-1$ calculation) is strictly preserved.
