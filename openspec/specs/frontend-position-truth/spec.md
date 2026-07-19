# frontend-position-truth Specification

## Purpose
TBD - created by archiving change fix-price-source-and-audit-backend. Update Purpose after archive.
## Requirements
### Requirement: Database-Sourced Position Values

All studio components (`MttdConsole.tsx`, `ValuationStudio.tsx`, `LttdLab.tsx`, `IchimokuTerminal.tsx`) SHALL read position values from database columns rather than recomputing them from raw oscillator values.

#### Scenario: MttdConsole uses stored position

- **WHEN** `MttdConsole.tsx` renders backtest data
- **THEN** it SHALL use `mttd_position` from `dailyData.mttd_imo.position` instead of computing `imo > 0.15 && er >= 0.20 && entropy <= 2.30 ? 1 : 0`

#### Scenario: ValuationStudio uses stored position

- **WHEN** `ValuationStudio.tsx` renders backtest data
- **THEN** it SHALL use `ichimoku_position` from `dailyData.ichimoku_imo.position` as primary source; if NULL, fall back to `mttd_position` from `dailyData.mttd_imo.position`; if both NULL, default to `0.0`

#### Scenario: ValuationStudio position precedence

- **WHEN** both `ichimoku_position` and `mttd_position` are available
- **THEN** `ichimoku_position` SHALL take precedence (Ichimoku is the primary system for Valuation Studio)

#### Scenario: LttdLab uses stored position

- **WHEN** `LttdLab.tsx` renders backtest data
- **THEN** it SHALL use `lttd_exposure` from `dailyData.lttd_regime.target_exposure` directly (already correct, verify no fallback recomputation)

#### Scenario: LttdLab position verification

- **WHEN** auditing LttdLab position logic
- **THEN** `grep -n "regime === .BULL" LttdLab.tsx` SHALL return zero matches (no regime-based fallback recomputation)

### Requirement: Position Column Availability Check

When a studio component reads position from database and the value is `NULL` or `undefined`, it SHALL log a warning to console and default to `0.0` (flat position) rather than recomputing from oscillator values.

#### Scenario: Missing position value

- **WHEN** `mttd_position` is `NULL` for a given date
- **THEN** the component SHALL log `console.warn("mttd_position is NULL for {date}, defaulting to 0.0")` and use `0.0`

#### Scenario: Position value present

- **WHEN** `mttd_position` is `1.0` for a given date
- **THEN** the component SHALL use `1.0` without any local recomputation

### Requirement: Position Consistency Verification

The verification scripts (`verify_*_studio_metrics_1to1.py`) SHALL compare frontend output against the backend API endpoint (`/api/v1/lttd/backtest`) rather than self-verifying.

#### Scenario: Verification script cross-check

- **WHEN** `verify_lttd_studio_metrics_1to1.py` is executed
- **THEN** it SHALL call `GET /api/v1/lttd/backtest` and compare metrics against frontend computation, reporting any divergence > 0.01%

#### Scenario: Verification failure

- **WHEN** frontend and backend metrics differ by more than 0.01%
- **THEN** the script SHALL exit with code 1 and print the divergent metrics with expected vs actual values

