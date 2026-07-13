## ADDED Requirements

### Requirement: LttdLab shall display Feature Diagnostics panel

The LTTD Studio SHALL render a Feature Diagnostics panel below the equity curve chart showing an interactive breakdown of technical indicators with VIF/PCA statistics, expandable per-indicator details (formula, description, historical performance), and on-chain override logic explanation.

#### Scenario: Indicator breakdown table with VIF

- **WHEN** the panel renders with indicator data from `/api/v1/lttd/diagnostics` or component signals
- **THEN** it displays a table with columns: Indicator Name, Category, Normalized Value, VIF Score, Regime Contribution (Bull/Neutral/Bear badge)
- **THEN** rows with VIF > 10 are highlighted in red with a "CRITICAL: VIF > 10" label

#### Scenario: Expandable indicator details

- **WHEN** user clicks an indicator row
- **THEN** the row expands to show:
  - Full indicator name with mathematical formula
  - Description of how the indicator works
  - LTTD-specific interpretation logic
  - Historical Performance section with Correlation, Accuracy, PCA Weight stats
- **THEN** clicking again collapses the row

#### Scenario: PCA variance card

- **WHEN** the panel renders
- **THEN** it shows a card with PCA Variance Explained percentage, color-coded green if > 85%

#### Scenario: VIF warning card

- **WHEN** any VIF exceeds 10
- **THEN** a warning card shows the count of collinear indicators in red

#### Scenario: Date slider navigation

- **WHEN** multiple days of diagnostics data exist
- **THEN** a range slider at the bottom allows navigating through historical diagnostic snapshots

#### Scenario: On-chain overrides tab

- **WHEN** user switches to "Overrides" tab
- **THEN** the panel displays:
  - Explanation of override logic (Layer 2)
  - STH-MVRV threshold card (> 2.0 → Forced Exit)
  - STH-NUPL threshold card (> 0.75 → Forced Exit)
  - STH-SOPR threshold card (Breakdown below 1.0 → Exit Trigger)
  - Supply In Profit card
- **THEN** each card shows the current value, formula, description, and action
