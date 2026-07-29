## REMOVED Requirements

### Requirement: Volatility Regime Multiplier Aggregation
**Reason**: Asymmetric heuristic multipliers create non-linear target leakage and distort the natural distribution of indicators. Replaced by a clean rolling percentile rescaler.
**Migration**: The arithmetic mean is now used directly without volatility or IIP multipliers in the `valuation-composite` capability.

### Requirement: Independent Component Purity
**Reason**: Multipliers are entirely removed from the composite logic, so explicitly declaring component purity from them is no longer necessary.
**Migration**: None.

### Requirement: Boundary Enforcement
**Reason**: Boundary clamping `[-2.0, +2.0]` is moved directly to the `valuation-composite` specification.
**Migration**: Clamping logic is now covered by the `valuation-composite` capability.
