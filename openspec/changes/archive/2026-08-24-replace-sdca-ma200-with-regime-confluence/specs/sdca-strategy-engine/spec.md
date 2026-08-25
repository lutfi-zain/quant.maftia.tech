## MODIFIED Requirements

### Requirement: DCA Entry Rule
The system SHALL signal "START AGGRESSIVE DCA" or "BUY_ALL" based on multi-system quantitative confluence:
1. `BUY_DCA` (Aggressive Weekly DCA): `valuation_composite >= buy_threshold (+0.5)` on Mondays when market is in value zone.
2. `BUY_ALL` (Bottom Breakout Allocation): Triggered when ALL of the following causal conditions are met at day $t-1$:
   - `valuation_composite >= buy_all_threshold (+1.0)` (Macro cycle bottom)
   - `lttd_prob_bull >= 0.60` OR `lttd_regime == 'BULL'` (LTTD Gaussian HMM structural bull confirmation)
   - `mttd_er >= 0.20` (Kaufman Efficiency Ratio showing non-random trend efficiency)
   - `buy_all_fired == False` (Single-shot firing per cycle to avoid repeat allocations)

Furthermore, once in the "AGGRESSIVE DCA" or "BUY_DCA" state, the system SHALL remain in that buying state until `valuation_composite` drops below the exit threshold, enforcing a hysteresis buffer before reverting to NEUTRAL/HOLD.

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
