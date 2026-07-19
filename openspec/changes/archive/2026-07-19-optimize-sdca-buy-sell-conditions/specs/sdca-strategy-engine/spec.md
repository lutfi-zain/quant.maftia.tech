# SDCA Strategy Engine — Delta Spec

## MODIFIED Requirements

### Requirement: SDCA Multiplier Function

The system SHALL implement a piecewise linear multiplier function that maps `valuation_composite ∈ [-2.0, +2.0]` to an allocation multiplier `[-0.5x, +3.0x]`.

**Sign Convention (CRITICAL — CORRECTED):**

The Valuation System produces composite scores where:

- **Positive composite (+1.0 to +2.0)**: Many indicators showing **overvaluation** → SELL zone (cycle tops)
- **Negative composite (-1.0 to -2.0)**: Many indicators showing **undervaluation** → BUY zone (cycle bottoms)
- Composite 0.0 = Fair value

This is confirmed by:

- Valuation System Doc §4.1: `Composite ≥ +1.50` = Overvalued (bubble risk)
- API Daily Route: `bubble_warning: composite >= 1.5`
- Test expectations: `sdcaMultiplier(1.6)` → expects `-0.5` (sell)
- `studioBacktest.ts`: `composite >= 1.5` → `-0.5` (sell)

| Composite Range | Multiplier | Phase | Action |
|-----------------|------------|-------|--------|
| ≥ +1.5 | -0.5x | Euphoria | DCA out (sell) |
| ≥ +1.0 | 0.0x | Expensive | Pause |
| ≥ +0.5 | 0.5x | Rich | Reduce |
| > -0.5 to < +0.5 | 1.0x | Fair | Normal DCA |
| ≤ -0.5 | 1.5x | Fair-Low | Moderate buy |
| ≤ -1.0 | 2.0x | Value | Buy |
| ≤ -1.5 | 3.0x | Deep Discount | Aggressive buy |

**Adaptive Scaling (Phase B):**

For composites ≤ -1.5 (deep discount zone), the multiplier SHALL scale proportionally:

- At composite -1.5: multiplier = 3.0x × min(1.0, 1.5/2.0) = 2.25x
- At composite -2.0: multiplier = 3.0x × min(1.0, 2.0/2.0) = 3.0x (max)

#### Scenario: Deep Discount multiplier

- **WHEN** `valuation_composite` is -1.6
- **THEN** multiplier SHALL be 3.0x (aggressive buy at undervalued levels)

#### Scenario: Deep Discount adaptive scaling (Phase B)

- **WHEN** `valuation_composite` is -1.8
- **THEN** multiplier SHALL be 3.0x × min(1.0, 1.8/2.0) = 2.7x (scaled aggressive buy)

#### Scenario: Normal DCA multiplier

- **WHEN** `valuation_composite` is 0.2
- **THEN** multiplier SHALL be 1.0x

#### Scenario: Euphoria sell multiplier

- **WHEN** `valuation_composite` is +1.2
- **THEN** multiplier SHALL be 0.0x (pause buying at overvalued levels)

#### Scenario: Bubble sell multiplier

- **WHEN** `valuation_composite` is +1.7
- **THEN** multiplier SHALL be -0.5x (DCA out / sell at bubble levels)

#### Scenario: Boundary at -1.0

- **WHEN** `valuation_composite` is exactly -1.0
- **THEN** multiplier SHALL be 2.0x (inclusive upper bound for value zone)

#### Scenario: Boundary at +1.5

- **WHEN** `valuation_composite` is exactly +1.5
- **THEN** multiplier SHALL be -0.5x (inclusive lower bound for euphoria zone)

### Requirement: Cycle Phase Detection

The system SHALL classify the current market phase into one of 5 zones based on `valuation_composite`, price percentile (rolling 365-day), and composite trend (7-day vs 30-day moving average).

| Phase | Composite | Price Percentile | Trend |
|-------|-----------|------------------|-------|
| Deep Discount | ≤ -1.0 | < 25% | Positive |
| Value | ≤ -0.5 | < 40% | Any |
| Fair | > -0.5 to < +0.5 | < 60% | Any |
| Expansion | ≥ +0.5 | > 60% | Any |
| Euphoria | ≥ +1.0 | > 80% | Negative |

#### Scenario: Deep Discount detection

- **WHEN** `valuation_composite` is -1.2
- **AND** price is below 25th percentile of trailing 365 days
- **AND** 7-day composite average (-0.8) < 30-day composite average (-0.6) (more negative = deeper discount)
- **THEN** phase SHALL be "Deep Discount"

#### Scenario: Euphoria detection

- **WHEN** `valuation_composite` is +1.2
- **AND** price is above 80th percentile of trailing 365 days
- **AND** 7-day composite average (+0.9) > 30-day composite average (+0.7) (more positive = more overvalued)
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

1. `valuation_composite` crosses below -1.0 from above (entering deep discount / undervaluation)
2. Price is below 25th percentile (rolling 365-day)
3. Composite trend is negative (7-day average < 30-day average, i.e., becoming more undervalued)

**Phase B Optimization:** Lower entry threshold from -1.0 to -0.5.

#### Scenario: Entry signal triggered

- **WHEN** previous day `valuation_composite` was -0.9
- **AND** current day `valuation_composite` is -1.1
- **AND** price percentile is 20%
- **AND** 7-day composite average (-0.85) < 30-day composite average (-0.65)
- **THEN** action SHALL be "START_AGGRESSIVE_DCA"
- **AND** recommended allocation SHALL be 2-3x normal weekly amount

#### Scenario: Entry signal not triggered (trend positive)

- **WHEN** `valuation_composite` is -1.2
- **AND** price percentile is 15%
- **AND** 7-day composite average (-0.9) > 30-day composite average (-1.1)
- **THEN** action SHALL be "HOLD" (trend not confirmed — composite still falling from deeper discount)

#### Scenario: Entry signal with low price percentile

- **WHEN** previous day `valuation_composite` was -0.3
- **AND** current day `valuation_composite` is -0.7
- **AND** price percentile is 15%
- **AND** 7-day composite average (-0.5) < 30-day composite average (-0.3)
- **THEN** action SHALL be "START_AGGRESSIVE_DCA"

### Requirement: DCA Exit Rule

The system SHALL signal "STOP DCA & SELL" when ANY of the following conditions are met:

1. `valuation_composite` crosses above +0.5 from below AND price > 80th percentile
2. `valuation_composite` crosses above +1.0 (aggressive exit — entering euphoria / overvaluation)
3. Composite has been > +0.5 for > 30 consecutive days (extended euphoria)

**Phase B Optimization:** Tighten exit threshold from +1.0 to +1.5.

#### Scenario: Gradual exit signal

- **WHEN** previous day `valuation_composite` was +0.4
- **AND** current day `valuation_composite` is +0.6
- **AND** price percentile is 85%
- **THEN** action SHALL be "REDUCE_POSITION"
- **AND** recommended allocation SHALL be sell amount equal to weekly DCA allocation (not % of holdings)

#### Scenario: Aggressive exit signal

- **WHEN** `valuation_composite` is +1.2
- **AND** price percentile is 92%
- **THEN** action SHALL be "SELL_ALL"
- **AND** recommended allocation SHALL be sell all BTC holdings

#### Scenario: Extended euphoria exit

- **WHEN** `valuation_composite` has been > +0.5 for 35 consecutive days
- **AND** price percentile is 78%
- **THEN** action SHALL be "REDUCE_POSITION"
- **AND** recommended allocation SHALL be sell 1.5x weekly DCA allocation amount

#### Scenario: Sell amount clarification

- **WHEN** action is "REDUCE_POSITION" and multiplier is -0.5x
- **AND** weekly DCA amount is $100
- **THEN** sell amount SHALL be $50 worth of BTC (50% of weekly allocation)
- **AND** NOT 50% of total BTC holdings

### Requirement: Causal Filtering

The system SHALL enforce strict t-1 causal execution. All signals for day `t` SHALL be computed using only data available at end of day `t-1`. No future data leakage is permitted.

#### Scenario: Causal signal computation

- **WHEN** computing SDCA signal for 2024-03-15
- **THEN** system SHALL only use `valuation_composite` and price data up to 2024-03-14
- **AND** signal for 2024-03-15 SHALL NOT use any data from 2024-03-15 or later

#### Scenario: Backtest causal enforcement

- **WHEN** backtesting SDCA strategy
- **THEN** position on day `t` SHALL be determined by signal computed from data up to day `t-1`
- **AND** return on day `t` SHALL be `position[t-1] × (price[t] - price[t-1]) / price[t-1]`

#### Scenario: Price percentile causal boundary

- **WHEN** computing price percentile for day `t`
- **THEN** percentile SHALL use prices from day `t-365` to day `t-1` (excluding day `t`)

### Requirement: Regime Confidence Metric

The system SHALL compute a regime confidence metric indicating the reliability of the current composite signal and SHALL apply confidence weighting to position sizing.

**Logic (CORRECTED):**

- If composite has been directionally consistent (same sign) for > 180 days: confidence = HIGH
- If composite has been directionally inconsistent (sign changes) in last 90 days: confidence = LOW
- If composite has been > +1.0 (overvalued) for > 180 days without price rise > 20%: confidence = LOW (potential regime shift)

**Confidence Weighting (Phase B):**

- HIGH confidence: multiplier SHALL be applied at full weight (1.0x)
- LOW confidence: multiplier SHALL be reduced by 50% (e.g., 3.0x becomes 1.5x)

#### Scenario: High confidence regime

- **WHEN** composite has been negative (undervalued) for 200 consecutive days
- **AND** price has dropped > 30% during this period
- **THEN** regime confidence SHALL be "HIGH"
- **AND** SDCA multiplier SHALL be applied at full weight

#### Scenario: Low confidence regime

- **WHEN** composite has been > +1.0 (overvalued) for 190 days
- **AND** price has only risen 5% during this period
- **THEN** regime confidence SHALL be "LOW"
- **AND** SDCA multiplier SHALL be reduced by 50% (e.g., 3.0x becomes 1.5x)

#### Scenario: Low confidence buy signal (Phase B)

- **WHEN** regime confidence is "LOW"
- **AND** composite is -0.8 (buy zone)
- **AND** base multiplier is 1.6x
- **THEN** final multiplier SHALL be 1.6x × 0.5 = 0.8x

#### Scenario: High confidence sell signal (Phase B)

- **WHEN** regime confidence is "HIGH"
- **AND** composite is +1.6 (sell zone)
- **AND** base multiplier is -0.5x
- **THEN** final multiplier SHALL be -0.5x × 1.0 = -0.5x

## ADDED Requirements

### Requirement: Adaptive Position Sizing (Phase B)

The system SHALL implement adaptive position sizing that scales multiplier based on composite strength to reduce overexposure at extreme valuations.

**Specification:**

For composites in the deep discount zone (≤ -1.5), the multiplier SHALL scale proportionally:

- `multiplier = base_multiplier × min(1.0, Math.abs(composite) / 2.0)`

For composites in the value zone (≤ -1.0 but > -1.5), the multiplier SHALL scale proportionally:

- `multiplier = base_multiplier × min(1.0, Math.abs(composite) / 1.5)`

#### Scenario: Extreme undervaluation scaling

- **WHEN** `valuation_composite` is -1.9
- **AND** base multiplier is 3.0x
- **THEN** final multiplier SHALL be 3.0x × min(1.0, 1.9/2.0) = 2.85x

#### Scenario: Moderate undervaluation scaling

- **WHEN** `valuation_composite` is -1.3
- **AND** base multiplier is 2.0x
- **THEN** final multiplier SHALL be 2.0x × min(1.0, 1.3/1.5) = 1.73x

#### Scenario: No scaling at fair value

- **WHEN** `valuation_composite` is 0.3
- **AND** base multiplier is 1.0x
- **THEN** final multiplier SHALL be 1.0x (no scaling applied)
