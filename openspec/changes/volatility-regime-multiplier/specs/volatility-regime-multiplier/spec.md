## ADDED Requirements

### Requirement: Volatility Regime Multiplier Aggregation

The `quant-btc-valuation-system` SHALL calculate and apply an inverse volatility multiplier, scaled by cumulative cointime value stored, strictly against the raw arithmetic mean of the 17 indicators to produce the `ValuationComposite` score. The formula applied SHALL BE `RawComposite * (0.05 / Volatility_730d) * (CVSC ^ 0.04)`.

#### Scenario: Aggregation of mature cycle top

- **WHEN** the raw composite scores from the 17 indicators fail to hit extreme limits during a macro market peak due to structural volatility decay (e.g., Nov 2021 or Jan 2025)
- **THEN** the composite multiplier escalates the raw score dynamically to properly trigger the `<-1.5` Circuit Breaker warning, resulting in a historically consistent `ValuationComposite` output.

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

## MODIFIED Requirements

*(No existing capabilities are modified at the spec level; this introduces a net-new capability isolated to aggregation logic).*
