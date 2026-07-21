## MODIFIED Requirements

### Requirement: DCA Entry Rule
The system SHALL signal "START AGGRESSIVE DCA" when ALL conditions are met:
1. `valuation_composite` crosses above +1.0 from below (entering value / undervaluation)
2. Price is below 30th percentile (rolling 365-day)
3. Composite trend is positive (7-day average > 30-day average)
Furthermore, once in the "AGGRESSIVE DCA" or "BUY_DCA" state, the system SHALL remain in that buying state until `valuation_composite` rises above -0.3, enforcing a 0.2 hysteresis buffer before reverting to NEUTRAL/HOLD.

#### Scenario: Entry signal triggered
- **WHEN** previous day `valuation_composite` was 0.9
- **AND** current day `valuation_composite` is 1.1
- **AND** price percentile is 20%
- **AND** 7-day composite average (1.0) > 30-day composite average (0.8)
- **THEN** action SHALL be "START_AGGRESSIVE_DCA"
- **AND** recommended allocation SHALL be 2-3x normal weekly amount

#### Scenario: Entry signal not triggered (trend negative)
- **WHEN** `valuation_composite` is 1.2
- **AND** price percentile is 15%
- **AND** 7-day composite average (0.9) < 30-day composite average (1.1)
- **THEN** action SHALL be "HOLD" (trend not confirmed — composite still falling from deeper discount)

### Requirement: DCA Exit Rule
The system SHALL signal "STOP DCA & SELL" when ANY of the following conditions are met:
1. `valuation_composite` crosses below -0.5 from above AND price > 75th percentile
2. `valuation_composite` crosses below -1.0 (aggressive exit — entering deep euphoria / overvaluation)
3. Composite has been < -0.5 for > 25 consecutive days (extended euphoria)
Furthermore, once in the "SELL_DCA" or "SELL_ALL" state, the system SHALL remain in that selling state until `valuation_composite` falls below +0.3, enforcing a 0.2 hysteresis buffer before reverting to NEUTRAL/HOLD.

#### Scenario: Gradual exit signal
- **WHEN** previous day `valuation_composite` was -0.4
- **AND** current day `valuation_composite` is -0.6
- **AND** price percentile is 85%
- **THEN** action SHALL be "REDUCE_POSITION"
- **AND** recommended allocation SHALL be sell amount equal to weekly DCA allocation (not % of holdings)

#### Scenario: Aggressive exit signal
- **WHEN** `valuation_composite` is -1.2
- **AND** price percentile is 92%
- **THEN** action SHALL be "SELL_ALL"
- **AND** recommended allocation SHALL be sell all BTC holdings

#### Scenario: Extended euphoria exit
- **WHEN** `valuation_composite` has been < -0.5 for 30 consecutive days
- **AND** price percentile is 78%
- **THEN** action SHALL be "REDUCE_POSITION"
- **AND** recommended allocation SHALL be sell 1.5x weekly DCA allocation amount

#### Scenario: Sell amount clarification
- **WHEN** action is "REDUCE_POSITION" and multiplier is -0.5x
- **AND** weekly DCA amount is $100
- **THEN** sell amount SHALL be $50 worth of BTC (50% of weekly allocation)
- **AND** NOT 50% of total BTC holdings
