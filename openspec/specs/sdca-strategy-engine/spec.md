# SDCA Strategy Engine

## Purpose

Core Strategic Dollar Cost Averaging signal engine that maps valuation composite scores to DCA allocation multipliers with cycle phase detection and entry/exit rules.

## Requirements

### Requirement: SDCA Multiplier Function

The system SHALL implement a piecewise linear multiplier function that maps `valuation_composite ∈ [-2.0, +2.0]` to an allocation multiplier `[-0.5x, +3.0x]`.

**Sign Convention (CRITICAL — CORRECTED):**

The Valuation System produces composite scores where:

- **Positive composite (+1.0 to +2.0)**: Many indicators showing **overvaluation** → SELL zone (cycle tops)
- **Negative composite (-1.0 to -2.0)**: Many indicators showing **undervaluation** → BUY zone (cycle bottoms)
- Composite 0.0 = Fair value

| Composite Range | Multiplier | Phase | Action |
|-----------------|------------|-------|--------|
| ≥ +1.5 | -0.5x | Euphoria | DCA out (sell) |
| ≥ +1.0 | 0.0x | Expensive | Pause |
| ≥ +0.5 | 0.5x | Rich | Reduce |
| > -0.5 to < +0.5 | 1.0x | Fair | Normal DCA |
| ≤ -0.5 | 1.5x | Fair-Low | Moderate buy |
| ≤ -1.0 | 2.0x | Value | Buy |
| ≤ -1.5 | 3.0x | Deep Discount | Aggressive buy |

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
| Deep Discount | ≤ -1.0 | < 30% | Positive |
| Value | ≤ -0.5 | < 40% | Any |
| Fair | > -0.5 to < +0.5 | < 60% | Any |
| Expansion | ≥ +0.5 | > 60% | Any |
| Euphoria | ≥ +1.0 | > 75% | Negative |

#### Scenario: Deep Discount detection

- **WHEN** `valuation_composite` is -1.2
- **AND** price is below 25th percentile of trailing 365 days
- **AND** 7-day composite average (-0.8) > 30-day composite average (-0.6)
- **THEN** phase SHALL be "Deep Discount"

#### Scenario: Euphoria detection

- **WHEN** `valuation_composite` is +1.2
- **AND** price is above 80th percentile of trailing 365 days
- **AND** 7-day composite average (+0.9) < 30-day composite average (+0.7)
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
The system SHALL execute the Bayesian-optimized 4-State Cycle Rotation Hysteresis FSM:
1. `OUT_ALL` $\rightarrow$ `DCA_IN`: Enters value accumulation mode when `valuation_composite >= dca_in_start (+1.70)`.
2. `DCA_IN` $\rightarrow$ `ALL_IN`: Triggers 100% cash allocation into BTC (`BUY_ALL`, multiplier `999.0`) when `valuation_composite <= all_in_val (+1.25)` OR when multi-system consensus confirms a breakout.
3. While in `DCA_IN`, the system SHALL execute weekly Monday `BUY_DCA` purchases.

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

#### Scenario: Bottom breakout allocation triggered via regime confluence
- **WHEN** `valuation_composite` is +1.2 (undervalued)
- **AND** `lttd_prob_bull` is 0.65
- **AND** `mttd_er` is 0.24
- **AND** `buy_all_fired` is false
- **THEN** action SHALL be "BUY_ALL"
- **AND** multiplier SHALL allocate 100% of remaining cash (multiplier code 999.0)

#### Scenario: Bottom allocation rejected due to noise or chop regime
- **WHEN** `valuation_composite` is +1.2 (undervalued)
- **AND** `lttd_regime` is 'SIDEWAYS' (`lttd_prob_sideways > 0.60`)
- **THEN** action SHALL remain "BUY_DCA" (gradual accumulation only, no BUY_ALL)

#### Scenario: Unanimous 4-system consensus triggers ALL_IN
- **WHEN** `valuation_composite` is +0.40 (fair-value/discount)
- **AND** `lttd_regime` is 'BULL' (`lttd_prob_bull` is 0.72)
- **AND** `mttd_position` is 1.0 (ER=0.28, Entropy=1.85)
- **AND** `ichimoku_position` is 1.0 (IMO=0.55)
- **AND** `buy_all_fired` is false
- **THEN** action SHALL be "BUY_ALL"
- **AND** portfolio SHALL allocate 100% of remaining cash into BTC

#### Scenario: Continuous DCA accumulation during multi-stage bear capitulation
- **WHEN** market experiences multiple capitulation waves (e.g. June 2022 followed by November 2022)
- **AND** trend systems remain in BEAR regime throughout the period
- **THEN** SDCA engine SHALL continuously execute `BUY_DCA` on every Monday without being halted or deadlocked by interim relief bounces

### Requirement: DCA Exit Rule

The system SHALL signal "STOP DCA & SELL" (`SELL_DCA` and `OUT_ALL`) based on Bayesian-optimized macro cycle bubble boundaries:
1. `ALL_IN` $\rightarrow$ `DCA_OUT`: Enters gradual distribution when `valuation_composite <= dca_out_start (-1.70)`. Executes weekly Monday sales (trimming 19% of active BTC position into cash).
2. `DCA_OUT` $\rightarrow$ `OUT_ALL`: Liquidates 100% of remaining BTC position to cash (`OUT_ALL`, multiplier `-1.0`) when the macro bubble bursts and valuation returns to `valuation_composite >= all_out_val (+0.40)`, preserving accumulated capital in cash throughout the ensuing bear market.

#### Scenario: Gradual exit signal with trend confirmation
- **WHEN** the FSM evaluates the `SELL_DCA` trigger on Monday
- **AND** the composite is <= -0.5
- **AND** the short-term price trend (e.g. price relative to 30-day moving average or 7d vs 30d composite trend) is non-positive
- **THEN** action SHALL be "SELL_DCA"
- **AND** the multiplier SHALL be set to exit gradually (-0.08x or -0.15x)

#### Scenario: Aggressive exit signal with trend confirmation
- **WHEN** the FSM evaluates the `SELL_ALL` trigger
- **AND** the composite is <= -1.5
- **AND** the price drawdown from ATH is >= 20%
- **AND** the short-term price trend is non-positive (not rising)
- **THEN** action SHALL be "SELL_ALL"
- **AND** the multiplier SHALL be set to exit all remaining holdings (-1.0x)

#### Scenario: Sell delayed during upward breakout
- **WHEN** the composite is <= -1.5 and drawdown is >= 20%
- **AND** the short-term price trend is positive (e.g., price is currently climbing and above its 30-day average)
- **THEN** action SHALL remain "HOLD" or "SELL_DCA" (gradual only) to prevent premature liquidation during a breakout.

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

**Logic (CORRECTED):**

- If composite has been directionally consistent (same sign) for > 180 days: confidence = HIGH
- If composite has been directionally inconsistent (sign changes) in last 90 days: confidence = LOW
- If composite has been > +1.0 (overvalued) for > 180 days without price rise > 20%: confidence = LOW (potential regime shift)

#### Scenario: High confidence regime

- **WHEN** composite has been negative (undervalued) for 200 consecutive days
- **AND** price has dropped > 30% during this period
- **THEN** regime confidence SHALL be "HIGH"
- **AND** SDCA multiplier SHALL be applied at full weight

#### Scenario: Low confidence regime

- **WHEN** composite has been > +1.0 (overvalued) for 190 days
- **AND** price has only risen 5% during this period
- **THEN** regime confidence SHALL be "LOW"
- **AND** SDCA multiplier SHALL be reduced by 50% (e.g., -0.5x becomes -0.25x)

### Requirement: Parameter Presets

The system SHALL provide Bayesian Optuna-verified parameter presets for SDCA entry/exit thresholds.

**Available Presets:**

| Preset | dca_in_start | all_in_val | dca_out_start | all_out_val | dca_cash_frac | dca_sell_frac | Description |
|--------|--------------|------------|---------------|-------------|---------------|---------------|-------------|
| `optimized` | +1.70 | +1.25 | -1.70 | +0.40 | 0.07 | 0.19 | Bayesian Optuna TPE Walk-Forward Verified (Default) |
| `conservative` | +1.50 | +1.00 | -1.50 | +0.20 | 0.05 | 0.15 | Lower drawdown focus |
| `high_sharpe` | +1.70 | +1.25 | -1.70 | +0.40 | 0.07 | 0.19 | High Sharpe Ratio Focus (Sharpe 1.20+) |
| `max_yield` | +1.80 | +1.20 | -1.60 | 0.00 | 0.08 | 0.15 | Maximum Total Yield Focus |

#### Scenario: Apply optimized preset
- **WHEN** preset is set to "optimized"
- **THEN** system SHALL use: dca_in_start=1.70, all_in_val=1.25, dca_out_start=-1.70, all_out_val=0.40

#### Scenario: Apply moderate preset
- **WHEN** preset is set to "moderate"
- **THEN** system SHALL use: buy_threshold=-1.0, sell_threshold=+1.0
- **AND** entry triggers on composite crossing below -1.0
- **AND** exit triggers on composite reaching +1.0

#### Scenario: Custom threshold overrides
- **WHEN** user provides buy_threshold=-0.8 and sell_threshold=+1.2
- **THEN** system SHALL use provided values instead of preset defaults
- **AND** values SHALL be validated: buy in [-2.0, 0.0], sell in [0.0, +2.0]

### Requirement: Proportional Lifecycle Cash Deployment

The system SHALL calculate the weekly DCA deployment amount dynamically as a proportion of remaining portfolio cash rather than a static dollar figure, eliminating cash drag in multi-cycle portfolio simulations:
$$\text{DCA Amount} = \min\left(\text{Cash}, \max\left(\text{base\_dca}, \text{Cash} \times \min(1.0, \text{dca\_cash\_pct} \times \text{Multiplier})\right)\right)$$
where `dca_cash_pct` defaults to `0.08` (8% base cash deployment per Monday).

When trimming positions in `DCA_OUT` mode, the system SHALL sell a dynamic fraction ($8\%–15\%$) of the active BTC position into cash to lock in cycle top gains without selling 100% of holdings prematurely.

#### Scenario: Value zone proportional deployment
- **WHEN** portfolio cash is $100,000
- **AND** `valuation_composite` is +0.80 (Multiplier = 1.5x)
- **AND** `dca_cash_pct` is 0.08
- **THEN** weekly deployment amount SHALL be $100,000 \times (0.08 \times 1.5) = \$12,000$ (12% of cash)

#### Scenario: Deep discount bottom proportional deployment
- **WHEN** portfolio cash is $50,000
- **AND** `valuation_composite` is +1.80 (Multiplier = 3.0x)
- **AND** `dca_cash_pct` is 0.08
- **THEN** weekly deployment amount SHALL be $50,000 \times (0.08 \times 3.0) = \$12,000$ (24% of cash)

#### Scenario: Macro top proportional position trimming
- **WHEN** market enters bubble overvaluation (`valuation_composite <= -1.25`)
- **AND** portfolio holds 20.0 BTC
- **THEN** weekly sell execution SHALL sell $8\%–15\%$ of active BTC position into cash
