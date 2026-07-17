## ADDED Requirements

### Requirement: SDCA Multiplier Function

The system SHALL implement a piecewise linear multiplier function that maps `valuation_composite ∈ [-2.0, +2.0]` to an allocation multiplier `[-0.5x, +3.0x]`.

**Sign Convention (CRITICAL):**

- Positive composite (+1.0 to +2.0) = Overvalued / Bubble zone
- Negative composite (-1.0 to -2.0) = Undervalued / Deep discount
- Composite 0.0 = Fair value

| Composite Range | Multiplier | Phase | Action |
|-----------------|------------|-------|--------|
| ≤ -1.5 | 3.0x | Deep Discount | Aggressive buy |
| ≤ -1.0 | 2.0x | Value | Buy |
| ≤ -0.5 | 1.5x | Fair-Low | Moderate buy |
| > -0.5 to < +0.5 | 1.0x | Fair | Normal DCA |
| ≥ +0.5 | 0.5x | Rich | Reduce |
| ≥ +1.0 | 0.0x | Expensive | Pause |
| ≥ +1.5 | -0.5x | Euphoria | DCA out (sell) |

#### Scenario: Deep Discount multiplier

- **WHEN** `valuation_composite` is -1.6
- **THEN** multiplier SHALL be 3.0x (aggressive buy at undervalued levels)

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
- **AND** 7-day composite average (-0.8) > 30-day composite average (-1.0)
- **THEN** phase SHALL be "Deep Discount"

#### Scenario: Euphoria detection

- **WHEN** `valuation_composite` is +1.2
- **AND** price is above 80th percentile of trailing 365 days
- **AND** 7-day composite average (+0.9) < 30-day composite average (+1.1)
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

1. `valuation_composite` crosses below -1.0 from above (entering deep discount)
2. Price is below 25th percentile (rolling 365-day)
3. Composite trend is positive (7-day average > 30-day average)

#### Scenario: Entry signal triggered

- **WHEN** previous day `valuation_composite` was -0.9
- **AND** current day `valuation_composite` is -1.1
- **AND** price percentile is 20%
- **AND** 7-day composite average (-0.85) > 30-day composite average (-1.05)
- **THEN** action SHALL be "START_AGGRESSIVE_DCA"
- **AND** recommended allocation SHALL be 2-3x normal weekly amount

#### Scenario: Entry signal not triggered (trend negative)

- **WHEN** `valuation_composite` is -1.2
- **AND** price percentile is 15%
- **AND** 7-day composite average (-1.1) < 30-day composite average (-0.9)
- **THEN** action SHALL be "HOLD" (trend not confirmed — composite still declining)

### Requirement: DCA Exit Rule

The system SHALL signal "STOP DCA & SELL" when ANY of the following conditions are met:

1. `valuation_composite` crosses above +0.5 from below AND price > 80th percentile
2. `valuation_composite` crosses above +1.0 (aggressive exit — entering euphoria)
3. Composite has been > +0.5 for > 30 consecutive days (extended euphoria)

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

### Requirement: Walk-Forward Validation

The system SHALL support walk-forward validation for out-of-sample testing of SDCA strategy performance.

**Specification:**

- Training window: configurable (default 3 years)
- Out-of-sample test period: configurable (default 6 months)
- Minimum 4 folds required for valid validation
- Performance metrics SHALL be reported per fold

#### Scenario: Walk-forward validation execution

- **WHEN** running walk-forward validation on 2015-2026 data
- **AND** training window is 3 years
- **AND** test period is 6 months
- **THEN** system SHALL produce minimum 4 folds:
  - Fold 1: Train 2015-2018, Test 2018-H1
  - Fold 2: Train 2016-2019, Test 2019-H1
  - Fold 3: Train 2017-2020, Test 2020-H1
  - Fold 4: Train 2018-2021, Test 2021-H1
- **AND** each fold SHALL report Sharpe ratio, max drawdown, total return

#### Scenario: Insufficient data for walk-forward

- **WHEN** total data length < training window + test period
- **THEN** system SHALL fall back to single train/test split (70/30)
- **AND** clearly indicate results are in-sample only

### Requirement: Transaction Cost Modeling

The system SHALL explicitly model transaction costs in all backtest and portfolio calculations.

**Specification:**

- Default fee: 10 basis points (0.10%) per trade (configurable)
- Fee applies on position changes (buy or sell)
- Total fees paid SHALL be tracked in portfolio metrics

#### Scenario: Fee deduction on buy

- **WHEN** SDCA executes a BUY of $100 at $60,000/BTC
- **AND** fee rate is 10 bps
- **THEN** fee charged SHALL be $0.10
- **AND** BTC received SHALL be ($100 - $0.10) / $60,000 = 0.001665 BTC
- **AND** total_fees_paid SHALL increase by $0.10

#### Scenario: Fee deduction on sell

- **WHEN** SDCA executes a SELL of 0.5 BTC at $100,000/BTC
- **AND** fee rate is 10 bps
- **THEN** fee charged SHALL be $50.00
- **AND** proceeds SHALL be (0.5 × $100,000) - $50.00 = $49,950.00
- **AND** total_fees_paid SHALL increase by $50.00

#### Scenario: Fee-adjusted metrics

- **WHEN** reporting backtest performance
- **THEN** system SHALL report both fee-adjusted and fee-free Sharpe ratios
- **AND** clearly label which is which

### Requirement: Regime Confidence Metric

The system SHALL compute a regime confidence metric indicating the reliability of the current composite signal.

**Logic:**

- If composite has been directionally consistent (same sign) for > 180 days: confidence = HIGH
- If composite has been directionally inconsistent (sign changes) in last 90 days: confidence = LOW
- If composite has been > +1.0 for > 180 days without price drop > 20%: confidence = LOW (potential regime shift)

#### Scenario: High confidence regime

- **WHEN** composite has been negative (undervalued) for 200 consecutive days
- **AND** price has dropped > 30% during this period
- **THEN** regime confidence SHALL be "HIGH"
- **AND** SDCA multiplier SHALL be applied at full weight

#### Scenario: Low confidence regime

- **WHEN** composite has been > +1.0 for 190 days
- **AND** price has only dropped 5% during this period
- **THEN** regime confidence SHALL be "LOW"
- **AND** SDCA multiplier SHALL be reduced by 50% (e.g., 3.0x becomes 1.5x)
