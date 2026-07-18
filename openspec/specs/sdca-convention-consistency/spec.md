# sdca-convention-consistency Specification

## Purpose
TBD - created by archiving change revert-sdca-sign-convention. Update Purpose after archive.
## Requirements
### Requirement: Canonical SDCA sign convention

The system SHALL use a single canonical `valuation_composite` interpretation across all SDCA-facing code paths and displays:

- **Negative composite (-1.0 to -2.0)**: overvalued / bubble risk / DCA-out zone
- **Positive composite (+1.0 to +2.0)**: undervalued / discount / DCA-in zone
- `0.0`: fair value

This convention SHALL be used consistently by the SDCA signal engine, backend backtest, shared frontend helpers, and studio UI labels.

#### Scenario: Positive composite maps to accumulation

- **WHEN** `valuation_composite` is `+2.0`
- **THEN** the SDCA system SHALL classify it as a deep discount / accumulation condition
- **AND** the signal SHALL support DCA-in behavior rather than DCA-out behavior

#### Scenario: Negative composite maps to distribution

- **WHEN** `valuation_composite` is `-2.0`
- **THEN** the SDCA system SHALL classify it as a bubble / overvaluation condition
- **AND** the signal SHALL support DCA-out behavior rather than DCA-in behavior

### Requirement: Cross-surface label parity

The system SHALL present the same SDCA convention in every user-facing surface that renders valuation-dependent labels or thresholds, including the SDCA studio panel and any valuation studio banners tied to SDCA interpretation.

#### Scenario: Panel threshold labels match the canonical convention

- **WHEN** the SDCA studio panel renders its threshold badges
- **THEN** the buy and sell labels SHALL reflect the canonical sign convention
- **AND** the displayed copy SHALL not contradict the engine or backtest behavior

#### Scenario: Valuation banner matches the canonical convention

- **WHEN** the valuation studio renders a bubble or accumulation banner
- **THEN** the banner SHALL use the same sign interpretation as the SDCA engine
- **AND** the banner SHALL not imply the opposite action direction

### Requirement: Causal execution remains unchanged

The system SHALL preserve strict t-1 causal filtering for all SDCA signal and backtest computations.

#### Scenario: No lookahead bias introduced

- **WHEN** the SDCA engine computes a signal for day `t`
- **THEN** it SHALL use only data available at the end of day `t-1`
- **AND** it SHALL not inspect day `t` or future data in the decision logic

