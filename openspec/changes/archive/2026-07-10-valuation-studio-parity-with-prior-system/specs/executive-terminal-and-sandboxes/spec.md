## MODIFIED Requirements

### Requirement: Specialized Studio Deep-Dive Telemetry

Each of the 4 quantitative studios (`Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) SHALL provide dedicated telemetry views querying `/api/v1/analytics/components` to visualize underlying component metrics.

#### Scenario: Studio-specific component rendering

- **WHEN** a researcher selects a specific studio from the sidebar
- **THEN** that studio MUST render its domain-specific visualization:
  - `Valuation Pillar Studio`: 17-indicator piecewise breakdown matrix and score timeline, PLUS individual metric drill-down with 3-panel chart view (BTC OHLC + Raw Metric + Oscillator), inline threshold editor with save-to-backend, 90-day sparkline mini-charts in each matrix row, and PNG export capability
  - `LTTD Lab`: 3-state Gaussian HMM stacked probability bar chart (`P_Bull`, `P_Bear`, `P_Sideways`), Log Returns, 20-day Volatility, and PCA/VIF pruning verification
  - `MTTD Console`: 10 Statistical Families consensus matrix (`Smoothing`, `Filtering`, `Regression`, `Spectral`, `Fractal`, `GARCH`, `Entropy`, `Chaos`, `Bayesian`, `ML-Hybrid`) and ER/Entropy gate threshold charts
  - `Ichimoku Terminal`: Denoised $\tanh$ oscillator chart alongside raw and Ehlers 2-pole SuperSmoother IIR cloud curves (`S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`)

## ADDED Requirements

### Requirement: Valuation Studio Navigation State

The Valuation Studio SHALL maintain navigation state to switch between the main composite view and individual metric detail views.

#### Scenario: Switch between composite and detail view

- **WHEN** a user clicks an indicator row in the component matrix
- **THEN** the studio MUST transition to the metric detail view, storing the selected metric name in component state, and restore the composite view when the user closes the detail view

#### Scenario: Browser back/forward navigation

- **WHEN** a user navigates to a metric detail view and then presses the browser back button
- **THEN** the studio MUST restore the main composite view (note: this is a stretch goal and may be deferred to a future iteration)

### Requirement: Valuation Studio Header with Export Control

The Valuation Studio header bar SHALL include a "SAVE PNG" button alongside the existing LOG/LIN toggle and maximize controls.

#### Scenario: Export button visibility

- **WHEN** the Valuation Studio is rendered with chart data
- **THEN** the header control bar MUST display the "SAVE PNG" button in the same visual style as the existing LOG/LIN toggle buttons

#### Scenario: Export button in detail view

- **WHEN** the 3-panel metric detail view is active
- **THEN** the "SAVE PNG" button MUST export the 3-panel chart (not the composite chart)
