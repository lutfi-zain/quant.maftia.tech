# volatility-regime-multiplier Specification

## Purpose
TBD - created by archiving change volatility-regime-multiplier. Update Purpose after archive.
## Requirements
### Requirement: Volatility Regime Multiplier Aggregation

The `quant-btc-valuation-system` SHALL calculate and apply a volatility multiplier and a proportional illiquidity-based IIP penalty, strictly against the raw arithmetic mean of the active indicators to produce the `ValuationComposite` score when the raw mean is negative (overvalued). The formula applied SHALL BE `RawComposite * (1.0 + cvsc_factor + vol_factor) - (iip_penalty_val * abs(RawComposite))`, ensuring that the IIP penalty scales proportionally with the magnitude of the overvalued score to prevent step-function discontinuities around a neutral composite value.

#### Scenario: Aggregation of mature cycle top

- **WHEN** the raw composite scores from the active indicators fail to hit extreme limits during a macro market peak due to structural volatility decay
- **THEN** the composite multiplier and the proportional IIP penalty escalate the raw score dynamically on the negative/overvalued side to properly trigger the `<-1.5` Circuit Breaker warning, resulting in a historically consistent `ValuationComposite` output.

### Requirement: Independent Component Purity

The 17 foundational on-chain indicators within the Valuation system SHALL NOT have their raw mathematical implementations modified. The structural multiplier SHALL BE isolated entirely to the composite calculation logic.

#### Scenario: Subsystem purity verification

- **WHEN** a user or external script queries the raw component logic (e.g., `MVRV Z-Score`)
- **THEN** the subsystem returns the precise underlying metric mapping exactly to its established historical piecewise scale, unmodified by the composite-level volatility multiplier.

### Requirement: Boundary Enforcement

The output of the multiplied `ValuationComposite` SHALL BE mathematically clamped (clipped) to exactly `[-2.0, +2.0]` prior to database insertion to prevent exponential runaway from breaking downstream LTTD logic and UI limits.

#### Scenario: Exponential spike clipping

- **WHEN** sudden severe market contraction combined with highly anomalous cointime spikes pushes the multiplied score above `+2.0` or below `-2.0`
- **THEN** the system limits the emitted `ValuationComposite` score strictly to exactly `+2.0` or `-2.0`, maintaining the expected numerical boundaries for `UnifiedDailyAnalytics` and API Gateway rendering.

