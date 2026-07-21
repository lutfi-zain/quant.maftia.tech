## MODIFIED Requirements

### Requirement: Valuation Composite Aggregation

The `quant-btc-valuation-system` SHALL calculate the `ValuationComposite` by taking the arithmetic mean of the normalized scores from the 17 indicators, then applying a volatility regime multiplier to dynamically scale the output. The calculation SHALL use the formula: `RawComposite * (0.05 / Volatility_730d) * (CVSC ^ 0.04)`. The final result SHALL BE clamped to the range `[-2.0, +2.0]`.

#### Scenario: Normal market conditions

- **WHEN** the daily metrics are aggregated
- **THEN** the system fetches CVSC and calculates 730-day volatility, applies the multiplier to the raw mean, clamps the result between -2.0 and +2.0, and stores the final score as the `ValuationComposite`.

#### Scenario: Extreme mature market top

- **WHEN** the raw mean is artificially suppressed by structurally low volatility
- **THEN** the multiplier naturally elevates the absolute value of the composite to accurately reflect extreme macro risk (e.g., crossing the `<-1.5` boundary).
