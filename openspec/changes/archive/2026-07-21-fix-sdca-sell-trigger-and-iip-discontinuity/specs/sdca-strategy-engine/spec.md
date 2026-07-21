## MODIFIED Requirements

### Requirement: DCA Exit Rule

The system SHALL signal "STOP DCA & SELL" (e.g. `SELL_ALL` or `SELL_DCA`) based on FSM states. The `SELL_ALL` (Total Exit) trigger MUST require that: (1) `ValuationComposite` is extremely overvalued (score <= -1.5), (2) price/MA200 ratio is compressed (< 2.0), (3) price drawdown from ATH is >= 20%, and (4) the short-term price trend is not positive (to prevent selling during a strong upward breakout). The `SELL_DCA` (Gradual Exit) trigger MUST execute only on Mondays when `ValuationComposite` is <= -0.5 and the short-term price trend is not positive.

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
