# interlocking-circuit-breakers Specification

## Purpose
TBD - created by syncing change phase-2. Update Purpose after archive.
## Requirements
### Requirement: LTTD Sideways Macro Regime Override on Mid-Term Systems
The cross-system orchestration logic SHALL monitor the posterior state probabilities of the `LTTDRegime` (`lttd_regime`). When the Gaussian HMM assigns `regime == SIDEWAYS` and the posterior probability $P_{\text{Sideways}} > 0.60$, the system MUST enforce an immediate macro override setting `mttd_position = 0.0` and `ichimoku_position = 0.0` regardless of individual oscillator readings (`MTTDIntegratedOscillator` or `IchimokuDenoisedOscillator`).

#### Scenario: Sideways regime forces zero trend exposure
- **WHEN** the `LTTDRegime` classification yields `SIDEWAYS` with posterior probability $P_{\text{Sideways}} > 0.60$ for date $t$
- **THEN** the orchestration layer overrides any active entry signals and forces `mttd_position = 0.0` and `ichimoku_position = 0.0` for date $t$

#### Scenario: Trend exposure allowed during Bull or Bear regimes
- **WHEN** the `LTTDRegime` classification yields `BULL` or `BEAR` ($P_{\text{Sideways}} \le 0.60$) for date $t$
- **THEN** `mttd_position` and `ichimoku_position` retain their native strategy outputs based on oscillator thresholds and gating rules

### Requirement: Valuation Macro Bubble Circuit Breaker Filter
The cross-system orchestration logic SHALL monitor `ValuationComposite` (`valuation_composite`). When `valuation_composite >= +1.50` (macro bubble risk / top-of-cycle danger zone), the system MUST activate the primary macro `CircuitBreakerFilter` to restrict new long exposure across mid-term systems (`MTTD` and `Ichimoku`) and flag high bubble risk in the consolidated analytics output.

#### Scenario: Valuation bubble risk restricts exposure
- **WHEN** `ValuationComposite` reaches or exceeds `+1.50` on date $t$
- **THEN** the `CircuitBreakerFilter` flags top-of-cycle risk and blocks new long position entries on `MTTD` and `Ichimoku` systems

### Requirement: Valuation Deep Discount Cycle Identification
The cross-system orchestration logic SHALL identify deep discount accumulation regimes when `ValuationComposite` (`valuation_composite`) falls to or below `-1.00`. When `valuation_composite <= -1.00`, the `CircuitBreakerFilter` MUST record deep macroeconomic value discount status in the consolidated analytics record.

#### Scenario: Valuation deep discount identification
- **WHEN** `ValuationComposite` is less than or equal to `-1.00` on date $t$
- **THEN** the system logs deep discount status in `UnifiedDailyAnalytics` (`unified_daily_analytics`) to permit high-conviction macro accumulation strategies
