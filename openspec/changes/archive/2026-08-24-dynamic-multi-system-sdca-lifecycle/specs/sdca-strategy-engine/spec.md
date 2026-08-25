## MODIFIED Requirements

### Requirement: DCA Entry Rule
The system SHALL signal "START AGGRESSIVE DCA" or "BUY_ALL" based on dynamic multi-system quantitative consensus without hardcoded price thresholds:
1. `BUY_DCA` (Continuous Value Accumulation): Active whenever `valuation_composite >= buy_threshold (+0.50)` on Mondays, executing value-weighted purchases ($1.5\times$ for $[0.5, 1.0)$, $2.0\times$ for $[1.0, 1.5)$, $3.0\times$ for $\ge 1.50$) throughout bear markets without deadlock lockouts.
2. `BUY_ALL` (Unanimous Breakout Allocation): Triggered dynamically when ALL 4 quantitative systems reach positive consensus at day $t-1$:
   - `valuation_composite >= 0.0` (Aset berada di zona valuasi wajar atau diskon)
   - `lttd_regime == 'BULL'` OR `lttd_prob_bull >= 0.60` (LTTD Gaussian HMM tren makro terkonfirmasi)
   - `mttd_position > 0` OR (`mttd_er >= 0.20` AND `mttd_entropy <= 2.30`) (MTTD efisiensi tren terkonfirmasi tanpa noise)
   - `ichimoku_position > 0` OR `ichimoku_imo > 0.30` (Ichimoku SuperSmoother momentum awan terkonfirmasi)
   - `buy_all_fired == False` (Single-shot execution per macro cycle to avoid repeat all-in allocations)

Furthermore, if market conditions revert to deep undervaluation (`valuation_composite >= 1.50`) and trend systems drop back to BEAR, the FSM SHALL reversibly return to `DCA_IN` accumulation mode so weekly DCA purchases resume automatically.

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
