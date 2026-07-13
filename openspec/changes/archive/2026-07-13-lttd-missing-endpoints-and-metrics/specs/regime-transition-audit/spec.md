## ADDED Requirements

### Requirement: LttdLab shall display Regime Transition Audit table

The LTTD Studio SHALL render a Regime Transition Audit table showing historical BULL ↔ BEAR ↔ SIDEWAYS regime change events with dates, previous regime, new regime, and ensemble score at transition.

#### Scenario: Regime transition table rendering

- **WHEN** the table renders with daily data
- **THEN** it iterates through sorted daily records and detects changes in `lttd_regime` between consecutive days
- **THEN** each transition is displayed as a table row with columns: Date, Previous Regime, New Regime, Score at Transition

#### Scenario: Color-coded regime badges

- **WHEN** displaying a BULL regime
- **THEN** the badge is green-colored with "BULL" label
- **WHEN** displaying a BEAR regime
- **THEN** the badge is red-colored with "BEAR" label
- **WHEN** displaying a SIDEWAYS regime
- **THEN** the badge is amber/yellow-colored with "SIDEWAYS" label

#### Scenario: Empty state

- **WHEN** no daily data is available
- **THEN** the table shows "No regime transitions detected" in muted text

#### Scenario: Positioning in layout

- **WHEN** the LttdLab renders
- **THEN** the Regime Transition Audit table appears as a glass-card section between the Pipeline Control Center and the Component Telemetry table
