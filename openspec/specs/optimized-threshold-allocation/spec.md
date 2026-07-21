# optimized-threshold-allocation Specification

## Purpose
TBD - created by archiving change optimize-sdca-thresholds. Update Purpose after archive.
## Requirements
### Requirement: Optimized SDCA FSM Threshold Bounds
The Systematic DCA (SDCA) engine SHALL execute signals based on the following optimized thresholds for `valuation_composite`:
- Buy Accumulation state (`BUY_DCA`): `valuation_composite >= 1.0`
- All-In aggressive buy state (`BUY_ALL`): `valuation_composite >= 1.8`
- Partial weekly exit state (`SELL_DCA`): `valuation_composite <= -0.5`
- Total exit state (`SELL_ALL`): `valuation_composite <= -1.0` (with price/drawdown validation) or `valuation_composite <= -1.5`

#### Scenario: Value accumulation entry
- **WHEN** composite score is `1.2`
- **THEN** FSM state SHALL be `BUY_DCA`

#### Scenario: Aggressive breakout buy
- **WHEN** composite score is `1.9`
- **THEN** FSM state SHALL be `BUY_ALL`

