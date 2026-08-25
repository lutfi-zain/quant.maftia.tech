## MODIFIED Requirements

### Requirement: DCA Entry Rule
The system SHALL execute a 4-State Cycle Rotation Hysteresis FSM:
1. `OUT_ALL` $\rightarrow$ `DCA_IN`: Enters value accumulation mode when `valuation_composite >= dca_in_start (+1.80)`.
2. `DCA_IN` $\rightarrow$ `ALL_IN`: Triggers 100% cash allocation into BTC (`BUY_ALL`, multiplier `999.0`) when `valuation_composite <= all_in_val (+1.50)` OR when multi-system consensus confirms a breakout.
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

The system SHALL signal "STOP DCA & SELL" (`SELL_DCA` and `OUT_ALL`) based on macro cycle bubble boundaries:
1. `ALL_IN` $\rightarrow$ `DCA_OUT`: Enters gradual distribution when `valuation_composite <= dca_out_start (-1.50)`. Executes weekly Monday sales (trimming 15% of active BTC position).
2. `DCA_OUT` $\rightarrow$ `OUT_ALL`: Liquidates 100% of remaining BTC position to cash (`OUT_ALL`, multiplier `-1.0`) when the macro bubble bursts and valuation returns to fair value (`valuation_composite >= all_out_val (0.00)`), preserving accumulated capital in cash throughout the ensuing bear market.

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
