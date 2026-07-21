# valuation-composite Specification

## Purpose
TBD - created by archiving change volatility-regime-multiplier. Update Purpose after archive.
## Requirements
### Requirement: Valuation Composite Aggregation

The `quant-btc-valuation-system` SHALL calculate the `ValuationComposite` by taking the arithmetic mean of the normalized scores from the active indicators, then applying a volatility regime multiplier to dynamically scale the output. The calculation SHALL use the log-additive formula: `RawComposite * (1.0 + cvsc_factor + vol_factor) - iip_penalty_val` (applied only to the overvalued/negative side). The final result SHALL BE clamped to the range `[-2.0, +2.0]`.

#### Scenario: Normal market conditions

- **WHEN** the daily metrics are aggregated
- **THEN** the system fetches CVSC and calculates 730-day volatility, applies the multiplier and IIP penalty to the raw mean on the negative/overvalued side, clamps the result between -2.0 and +2.0, and stores the final score as the `ValuationComposite`.

#### Scenario: Extreme mature market top

- **WHEN** the raw mean is artificially suppressed by structurally low volatility
- **THEN** the multiplier naturally elevates the absolute value of the composite to accurately reflect extreme macro risk (e.g., crossing the `<-1.5` boundary).

