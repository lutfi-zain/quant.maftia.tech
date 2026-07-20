## ADDED Requirements

### Requirement: 6-State SDCA Lifecycle Machine

The `quant-btc-valuation-system` Python engine SHALL implement a 6-state finite machine for SDCA lifecycle management (`HOLD`, `BUY_DCA`, `BUY_ALL`, `SELL_DCA`, `SELL_ALL`, and an explicit `NEUTRAL`).

#### Scenario: BUY_DCA at Bottom Confirmed

- **WHEN** `valuation_composite >= 1.0` (discount/undervalued) AND `btc_price < MA200(btc_price)`
- **THEN** the system SHALL transition to `BUY_DCA` state, executing proportional purchases on a strict **weekly** cadence (e.g., only on Mondays) to avoid exhausting cash reserves too quickly.

#### Scenario: BUY_ALL at Bottom Ending (Breakout)

- **WHEN** `btc_price` crosses above `MA200(btc_price)` (bullish breakout) WHILE the asset is still in a cheap zone (`valuation_composite > 0.5`)
- **THEN** the system SHALL transition to `BUY_ALL` state, deploying 100% of remaining allocated cash immediately, preventing the portfolio from missing the macro upward trend.

### Requirement: Graduated Distribution (SELL)

The SDCA engine SHALL implement a dynamic, multi-phase selling logic based on both valuation and momentum (`Price/MA200` ratio).

#### Scenario: SELL_DCA at Top Forming

- **WHEN** `valuation_composite <= -1.0` (expensive/overvalued) AND `Price/MA200 ratio < 2.0` (momentum cooling)
- **THEN** the system SHALL transition to `SELL_DCA` state, selling a graduated percentage of the remaining BTC position on a strict **weekly** cadence (e.g., 8% per week at -1.0, 15% per week at -1.5).

#### Scenario: SELL_ALL at Cycle Peaked

- **WHEN** `valuation_composite <= -1.5` (bubble) AND `Price/MA200 ratio < 2.0` (momentum cooling) AND `price_drawdown_from_ath >= 20%` (trend breakdown)
- **THEN** the system SHALL transition to `SELL_ALL` state, liquidating 100% of the remaining BTC position immediately.
- **AND IF** `valuation_composite <= -0.5` AND `btc_price < MA200(btc_price)` (bearish crossover while still slightly overvalued), it SHALL also trigger `SELL_ALL` as a final safety net.
