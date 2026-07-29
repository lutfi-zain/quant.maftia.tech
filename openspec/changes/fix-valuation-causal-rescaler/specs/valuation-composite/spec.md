## MODIFIED Requirements

### Requirement: Valuation Composite Aggregation

The `quant-btc-valuation-system` SHALL calculate the `ValuationComposite` by taking the arithmetic mean of the normalized scores from the active macro indicators. The final result SHALL BE clamped to the range `[-2.0, +2.0]`.

#### Scenario: Normal market conditions
- **WHEN** the daily metrics are aggregated
- **THEN** the system calculates the raw mean of the active macro indicators, clamps the result between -2.0 and +2.0, and stores the final score as the `ValuationComposite`.

#### Scenario: Extreme mature market top
- **WHEN** the raw mean reaches extreme low (negative) values during a macro market peak
- **THEN** the composite faithfully reflects this raw mean linearly, without arbitrary asymmetric multipliers or penalties.
