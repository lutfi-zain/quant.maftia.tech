# sdca-studio-panel Specification

## ADDED Requirements

### Requirement: Threshold Configuration Section

The SDCA Panel SHALL include a collapsible "Threshold Configuration" section below the preset selector that contains 4 slider inputs and a Recalculate button.

#### Scenario: Threshold configuration interaction

- **WHEN** the user opens the SDCA Panel
- **THEN** the panel SHALL display the existing preset selector, signal gauge, and backtest metrics
- **AND** SHALL additionally display a [⚙ Configure Thresholds] toggle button
- **WHEN** the user clicks [⚙ Configure Thresholds]
- **THEN** a collapsible section SHALL expand with 4 sliders and a [Recalculate] button

### Requirement: Recalculate Trigger

The SDCA Panel SHALL call `POST /api/v1/sdca/recalculate` with the current threshold values whenever the user clicks [Recalculate] or changes a preset.

#### Scenario: Recalculate on threshold change

- **WHEN** the user adjusts a slider and the 300ms debounce timer expires
- **THEN** the panel SHALL set `isRecalculating = true`
- **AND** SHALL call the API with the current thresholds
- **AND** on success, SHALL update all displayed metrics, equity curve, and trade log
- **AND** SHALL set `isRecalculating = false`
- **AND** SHALL show a loading spinner during the request
