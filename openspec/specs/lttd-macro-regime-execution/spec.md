# LTTD Macro Long-Term Regime & Execution Engine (v3.3) Specification

## Purpose

Formal specification of the LTTD (Long-Term Trend Detection) Macro Long-Term Regime and Execution Engine (v3.3). This engine provides macro regime identification, causal signal filtering, continuous state machine execution, and risk-mitigating emergency exit gating tailored for long-term Bitcoin cyclical investment horizons.

## Requirements

### Requirement: HL-Driven Horizon Coherence

The system SHALL enforce mathematical coherence across all filter spans, holding periods, and indicator lookbacks derived from the calibrated Ornstein-Uhlenbeck half-life ($HL = 200\text{ days}$).

The execution parameters SHALL be configured as:
- Entry SuperSmoother Filter Period: $35\text{ days}$ ($\lfloor HL \times 0.175 \rfloor$)
- Exit SuperSmoother Filter Period: $20\text{ days}$ ($\lfloor HL \times 0.10 \rfloor$)
- Minimum Holding Period (MHP): $60\text{ days}$ ($\lfloor HL \times 0.30 \rfloor$)
- Re-entry Cool-Off (RCO): $30\text{ days}$ ($\lfloor HL \times 0.15 \rfloor$)
- Trend Moving Average Filter: $250\text{ days}$ ($\lfloor HL \times 1.25 \rfloor$)
- Forward Regime Target Horizon: $60\text{ days}$ ($\approx 30\%$ of macro cycle half-life)

#### Scenario: Parameter derivation from half-life
- **WHEN** the engine initializes under the macro configuration with $HL = 200\text{ days}$
- **THEN** the system SHALL set Entry SuperSmoother to 35, Exit SuperSmoother to 20, MHP to 60, RCO to 30, and MA filter to 250 days

#### Scenario: SuperSmoother 2-pole causal filtering
- **WHEN** raw composite scores are processed through John Ehlers' 2-pole SuperSmoother filter
- **THEN** the filter SHALL apply coefficients $c_1 = 1 - c_2 - c_3$, $c_2 = 2 a_1 \cos(\sqrt{2} \pi / \text{period})$, and $c_3 = -a_1^2$ with $a_1 = \exp(-\sqrt{2} \pi / \text{period})$
- **AND** output causal smoothed scores without lookahead lag

#### Scenario: Minimum Holding Period enforcement
- **WHEN** an active long position has been open for fewer than 60 days ($effective\_days\_in\_position < 60$)
- **AND** standard exit threshold conditions are met ($smoothed\_score\_exit \le exit\_thresh$)
- **AND** the emergency breakdown gate is not active
- **THEN** the system SHALL maintain exposure at 1.0 to prevent premature whipsaw exits during early trend progression

### Requirement: Continuous State Machine Execution

The system SHALL execute the position state machine continuously across all walk-forward evaluation periods, eliminating state resets at fold boundaries.

The execution engine SHALL maintain persistent tracking of:
- `previous_exposure`: Active position sizing ($1.0$ or $0.0$)
- `days_in_position`: Consecutive days in current trade
- `days_since_exit`: Consecutive days since last exit
- `is_circuit_breaker_active`: Active valuation circuit breaker latch state
- `previous_regime`: Prior day HMM regime classification

#### Scenario: Continuous position carry-over across fold boundaries
- **WHEN** a walk-forward evaluation transitions from fold $k$ to fold $k+1$
- **THEN** the state machine SHALL preserve the exact `previous_exposure` and `days_in_position` from fold $k$
- **AND** SHALL NOT force artificial liquidation or trade fragmentation at the fold boundary

#### Scenario: Re-entry cool-off continuity
- **WHEN** a position exits near the end of fold $k$
- **THEN** `days_since_exit` SHALL increment continuously into fold $k+1$
- **AND** the system SHALL enforce the 30-day RCO period seamlessly across the boundary

### Requirement: Macro Breakdown Emergency Exit Gate

The system SHALL implement an emergency exit override that liquidates long positions when a severe macro breakdown occurs in a structural bear market.

The emergency exit condition SHALL evaluate:
$$is\_macro\_breakdown = (smoothed\_score\_exit \le -0.10) \land (regime == \text{"BEAR"})$$

When $is\_macro\_breakdown$ is true, the system SHALL immediately override the Minimum Holding Period (MHP) and set `target_exposure = 0.0`.

#### Scenario: Emergency exit triggered on confirmed bear market breakdown
- **WHEN** an active position is held ($previous\_exposure \ge 0.9$)
- **AND** `days_in_position` is less than 60 days
- **AND** `smoothed_score_exit` drops to or below $-0.10$
- **AND** the HMM regime classifier outputs `regime == "BEAR"`
- **THEN** the system SHALL immediately set `target_exposure = 0.0` to prevent catastrophic drawdown

#### Scenario: Normal bull market pullback preserves position
- **WHEN** an active position is held with $days\_in\_position < 60$
- **AND** `smoothed_score_exit` temporarily falls below $-0.10$ during a sharp correction
- **AND** the HMM regime remains `regime == "BULL"` or `regime == "SIDEWAYS"`
- **THEN** the emergency exit SHALL NOT trigger
- **AND** the position SHALL remain open ($target\_exposure = 1.0$)

#### Scenario: Standard MHP exit after holding maturity
- **WHEN** an active position has matured ($days\_in\_position \ge 60$)
- **AND** `smoothed_score_exit` drops below `exit_thresh` (default 0.22 or dynamic 35th percentile)
- **THEN** the system SHALL execute an orderly exit setting `target_exposure = 0.0`

### Requirement: Dynamic Quantile Entry/Exit Thresholds

The system SHALL compute dynamic entry and exit score thresholds using rolling quantiles over historical indicator scores.

The threshold parameters SHALL be calculated as:
- Lookback Window: Trailing 750 days ($min(750, \text{history length})$)
- Entry Quantile: 65th percentile (`SCORE_ENTRY_Q = 0.65`)
- Exit Quantile: 35th percentile (`SCORE_EXIT_Q = 0.35`)
- Minimum Sample Requirement: 100 historical score points

#### Scenario: Dynamic threshold adaptation over rolling window
- **WHEN** at least 100 historical score records are available
- **THEN** the system SHALL compute `entry_thresh = quantile(0.65)` and `exit_thresh = quantile(0.35)` over the trailing 750-day window
- **AND** use these dynamic thresholds for hysteresis state transition evaluation

#### Scenario: Fallback to fixed thresholds on insufficient history or inversion
- **WHEN** fewer than 100 historical scores exist OR $entry\_thresh \le exit\_thresh$
- **THEN** the system SHALL fall back to fixed calibrated thresholds: `entry_thresh = 0.30` and `exit_thresh = 0.22`

#### Scenario: Multi-condition entry gating
- **WHEN** evaluated for a new long entry ($previous\_exposure < 0.9$)
- **AND** `days_since_exit >= 30` (RCO satisfied)
- **AND** `smoothed_score_entry >= entry_thresh`
- **AND** $price > ma\_val$ (250-day MA filter)
- **AND** $er\_val \ge 0.25$ (Kaufman Efficiency Ratio gate)
- **AND** $entropy\_val \le 2.40$ (Shannon Entropy noise gate)
- **AND** $price \ge cloud\_min$ (Ichimoku Cloud confirmation gate)
- **THEN** the system SHALL set `target_exposure = 1.0`

### Requirement: Causal Filter & Zero Lookahead Bias Invariant

The system SHALL enforce strict $t-1$ causal execution and validation purging to eliminate any forward-looking data leakage.

The causal invariants SHALL include:
- All features, indicators, and model scores computed for day $t$ SHALL use data strictly available at or before close of day $t-1$.
- Walk-forward cross-validation folds SHALL include a 60-day purge window between training and test sets to account for the 60-day forward return target horizon.
- Expanding feature scalers and HMM transition fits SHALL only fit on training partition indices.

#### Scenario: Point-in-time signal execution
- **WHEN** generating target exposure for date $t$
- **THEN** the system SHALL only access market data and indicator values up to date $t-1$
- **AND** the realized return for date $t$ SHALL be calculated as $exposure_{t-1} \times (price_t - price_{t-1}) / price_{t-1}$

#### Scenario: Walk-forward validation purge enforcement
- **WHEN** the WFO iterator constructs training, validation, and test fold splits
- **THEN** the system SHALL insert a minimum 60-day purge gap between training end and test start
- **AND** verify that no target labels derived from forward test period returns exist in the training fold

### Requirement: Dual-Mode Configuration Support

The system SHALL provide first-class support for both Macro Long-Term (`macro`) and Weekly Mid-Term (`weeks`) operating modes via environment configuration.

The operational modes SHALL configure:
- `LTTD_MODE=macro` (v3.3 LTTD-L): SuperSmoother 35/20, MHP 60d, RCO 30d, MA 250d, Entry/Exit 0.30/0.22
- `LTTD_MODE=weeks` (v2.1 LTTD-M): SuperSmoother 14/10, MHP 25d, RCO 14d, MA 226d, Entry/Exit 0.28/0.22

#### Scenario: Default macro mode initialization
- **WHEN** the system boots with `LTTD_MODE` unset or set to `"macro"`
- **THEN** the engine SHALL configure LTTD-L macro parameters with $HL=200$, MHP 60d, and RCO 30d

#### Scenario: Explicit weeks mode initialization
- **WHEN** the system boots with `LTTD_MODE=weeks`
- **THEN** the engine SHALL configure LTTD-M weekly parameters with MHP 25d, RCO 14d, and SuperSmoother 14/10
