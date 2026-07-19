## MODIFIED Requirements

### Requirement: SDCA Multiplier Function

The system SHALL implement a piecewise linear multiplier function that maps `valuation_composite ∈ [-2.0, +2.0]` to an allocation multiplier `[-0.5x, +3.0x]`.

**Sign Convention (CRITICAL — CORRECTED):**

The Valuation System produces composite scores where:

- **Positive composite (+1.0 to +2.0)**: Many indicators showing **undervaluation** → BUY zone (cycle bottoms)
- **Negative composite (-1.0 to -2.0)**: Many indicators showing **overvaluation** → SELL zone (cycle tops)
- Composite 0.0 = Fair value

This is because individual indicators like MVRV Z-Score normalize negative raw values (Market Cap < Realized Cap) to +2.0, signaling undervaluation.

| Composite Range | Multiplier | Phase | Action |
|-----------------|------------|-------|--------|
| ≥ +1.5 | 3.0x | Deep Discount | Aggressive buy |
| ≥ +1.0 | 2.0x | Value | Buy |
| ≥ +0.5 | 1.5x | Fair-Low | Moderate buy |
| > -0.5 to < +0.5 | 1.0x | Fair | Normal DCA |
| ≤ -0.5 | 0.5x | Rich | Reduce |
| ≤ -1.0 | 0.0x | Expensive | Pause |
| ≤ -1.5 | -0.5x | Euphoria | DCA out (sell) |

#### Scenario: Deep Discount multiplier

- **WHEN** `valuation_composite` is +1.6
- **THEN** multiplier SHALL be 3.0x (aggressive buy at undervalued levels)

#### Scenario: Normal DCA multiplier

- **WHEN** `valuation_composite` is 0.2
- **THEN** multiplier SHALL be 1.0x

#### Scenario: Euphoria sell multiplier

- **WHEN** `valuation_composite` is -1.2
- **THEN** multiplier SHALL be 0.0x (pause buying at overvalued levels)

#### Scenario: Bubble sell multiplier

- **WHEN** `valuation_composite` is -1.7
- **THEN** multiplier SHALL be -0.5x (DCA out / sell at bubble levels)

#### Scenario: Boundary at +1.0

- **WHEN** `valuation_composite` is exactly +1.0
- **THEN** multiplier SHALL be 2.0x (inclusive lower bound for value zone)

#### Scenario: Boundary at -1.5

- **WHEN** `valuation_composite` is exactly -1.5
- **THEN** multiplier SHALL be -0.5x (inclusive upper bound for euphoria zone)

### Requirement: Cycle Phase Detection

The system SHALL classify the current market phase into one of 5 zones based on `valuation_composite`, price percentile (rolling 365-day), and composite trend (7-day vs 30-day moving average).

| Phase | Composite | Price Percentile | Trend |
|-------|-----------|------------------|-------|
| Deep Discount | ≥ +1.0 | < 25% | Positive |
| Value | ≥ +0.5 | < 40% | Any |
| Fair | > -0.5 to < +0.5 | < 60% | Any |
| Expansion | ≤ -0.5 | > 60% | Any |
| Euphoria | ≤ -1.0 | > 80% | Negative |

#### Scenario: Deep Discount detection

- **WHEN** `valuation_composite` is +1.2
- **AND** price is below 25th percentile of trailing 365 days
- **AND** 7-day composite average (+0.8) > 30-day composite average (+0.6)
- **THEN** phase SHALL be "Deep Discount"

#### Scenario: Euphoria detection

- **WHEN** `valuation_composite` is -1.2
- **AND** price is above 80th percentile of trailing 365 days
- **AND** 7-day composite average (-0.9) < 30-day composite average (-0.7)
- **THEN** phase SHALL be "Euphoria"

#### Scenario: Fair phase

- **WHEN** `valuation_composite` is 0.1
- **AND** price is at 50th percentile
- **THEN** phase SHALL be "Fair"

#### Scenario: Cold-start initialization

- **WHEN** less than 365 days of price data available
- **THEN** price percentile SHALL use available data (minimum 30 days required)
- **AND** phase SHALL be "Fair" until sufficient data is available

### Requirement: DCA Entry Rule

The system SHALL signal "START AGGRESSIVE DCA" when ALL conditions are met:

1. `valuation_composite` crosses above +1.0 from below (entering deep discount / undervaluation)
2. Price is below 25th percentile (rolling 365-day)
3. Composite trend is positive (7-day average > 30-day average)

#### Scenario: Entry signal triggered

- **WHEN** previous day `valuation_composite` was +0.9
- **AND** current day `valuation_composite` is +1.1
- **AND** price percentile is 20%
- **AND** 7-day composite average (+0.85) > 30-day composite average (+0.65)
- **THEN** action SHALL be "START_AGGRESSIVE_DCA"
- **AND** recommended allocation SHALL be 2-3x normal weekly amount

#### Scenario: Entry signal not triggered (trend negative)

- **WHEN** `valuation_composite` is +1.2
- **AND** price percentile is 15%
- **AND** 7-day composite average (+0.9) < 30-day composite average (+1.1)
- **THEN** action SHALL be "HOLD" (trend not confirmed — composite still rising from deeper discount)

### Requirement: DCA Exit Rule

The system SHALL signal "STOP DCA & SELL" when ANY of the following conditions are met:

1. `valuation_composite` crosses below -0.5 from above AND price > 80th percentile
2. `valuation_composite` crosses below -1.0 (aggressive exit — entering euphoria / overvaluation)
3. Composite has been < -0.5 for > 30 consecutive days (extended euphoria)

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

- **WHEN** `valuation_composite` has been < -0.5 for 35 consecutive days
- **AND** price percentile is 78%
- **THEN** action SHALL be "REDUCE_POSITION"
- **AND** recommended allocation SHALL be sell 1.5x weekly DCA allocation amount

#### Scenario: Sell amount clarification

- **WHEN** action is "REDUCE_POSITION" and multiplier is -0.5x
- **AND** weekly DCA amount is $100
- **THEN** sell amount SHALL be $50 worth of BTC (50% of weekly allocation)
- **AND** NOT 50% of total BTC holdings

### Requirement: Regime Confidence Metric

The system SHALL compute a regime confidence metric indicating the reliability of the current composite signal.

**Logic (CORRECTED):**

- If composite has been directionally consistent (same sign) for > 180 days: confidence = HIGH
- If composite has been directionally inconsistent (sign changes) in last 90 days: confidence = LOW
- If composite has been < -1.0 (overvalued) for > 180 days without price rise > 20%: confidence = LOW (potential regime shift)

#### Scenario: High confidence regime

- **WHEN** composite has been positive (undervalued) for 200 consecutive days
- **AND** price has dropped > 30% during this period
- **THEN** regime confidence SHALL be "HIGH"
- **AND** SDCA multiplier SHALL be applied at full weight

#### Scenario: Low confidence regime

- **WHEN** composite has been < -1.0 (overvalued) for 190 days
- **AND** price has only risen 5% during this period
- **THEN** regime confidence SHALL be "LOW"
- **AND** SDCA multiplier SHALL be reduced by 50% (e.g., -0.5x becomes -0.25x)
