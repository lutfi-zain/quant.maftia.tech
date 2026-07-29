# Causal Expanding Rescaling Specification

## MODIFIED Requirements

### Requirement: Causal Composite Rescaling

The Valuation System SHALL compute rescaling parameters (p2_5, p50, and p97_5) for the ValuationComposite score at any day t using only historical raw composite values up to day t-1, avoiding lookahead bias. In addition, the `expanding_window_rescale` function SHALL detect and handle degenerate input series (where all values are identical, e.g., all -2.0). When the input series has zero variance (p2.5 == p97.5), the rescale SHALL return 0.0 (neutral) instead of propagating the degenerate value.

#### Scenario: Expanding window with normal variance
- **WHEN** computing rescaling parameters for day `t` with a normally distributed historical series
- **THEN** the system calculates valid percentiles (p2_5, p50, p97_5) using values up to day `t-1` to rescale the score.

#### Scenario: Expanding window with zero variance input
- **WHEN** the historical input series has zero variance (p2.5 equals p97.5) due to permanently stuck values
- **THEN** the `expanding_window_rescale` function detects this degeneracy and returns `0.0` (neutral) instead of the degenerate value.
