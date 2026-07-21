## MODIFIED Requirements

### Requirement: Volatility Regime Multiplier Aggregation

The `quant-btc-valuation-system` SHALL calculate and apply a volatility multiplier and a proportional illiquidity-based IIP penalty, strictly against the raw arithmetic mean of the active indicators to produce the `ValuationComposite` score when the raw mean is negative (overvalued). The formula applied SHALL BE `RawComposite * (1.0 + cvsc_factor + vol_factor) - (iip_penalty_val * abs(RawComposite))`, ensuring that the IIP penalty scales proportionally with the magnitude of the overvalued score to prevent step-function discontinuities around a neutral composite value.

#### Scenario: Aggregation of mature cycle top

- **WHEN** the raw composite scores from the active indicators fail to hit extreme limits during a macro market peak due to structural volatility decay
- **THEN** the composite multiplier and the proportional IIP penalty escalate the raw score dynamically on the negative/overvalued side to properly trigger the `<-1.5` Circuit Breaker warning, resulting in a historically consistent `ValuationComposite` output.
