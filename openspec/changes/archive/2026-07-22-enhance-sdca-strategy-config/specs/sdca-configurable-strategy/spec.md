# sdca-configurable-strategy Specification

## Purpose

Defines requirements for interactive frontend configuration of SDCA hysteresis strategy thresholds (`dca_in_start`, `all_in_val`, `dca_out_start`, `all_out_val`) and real-time backend recalculations in Valuation Studio.

## Requirements

### Requirement: Interactive Hysteresis Parameter Controls

The `SdcaPanel` component in `ValuationStudio` SHALL render numerical input controls and sliders allowing users to customize 4 hysteresis strategy thresholds:
- `dca_in_start` (Start DCA In: valuation_composite threshold to trigger DCA buying, range +1.00 to +2.00, default +1.80)
- `all_in_val` (All In: valuation_composite threshold to allocate 100% cash to BTC, range 0.00 to +1.80, default +1.50)
- `dca_out_start` (Start DCA Out: valuation_composite threshold to trigger DCA selling, range -2.00 to -0.50, default -1.50)
- `all_out_val` (All Out: valuation_composite threshold to sell 100% BTC to cash, range -1.50 to +0.50, default 0.00)

#### Scenario: Display default strategy parameters
- **WHEN** the `SdcaPanel` component mounts for the first time
- **THEN** it SHALL display default values: `dca_in_start = 1.80`, `all_in_val = 1.50`, `dca_out_start = -1.50`, `all_out_val = 0.00`

#### Scenario: User adjusts parameter controls
- **WHEN** the user modifies any of the 4 hysteresis input controls
- **THEN** the panel SHALL validate the values within allowed bounds and enable the "Save & Recalculate Strategy" action button

### Requirement: Real-Time Strategy Recalculation Trigger

The `SdcaPanel` component SHALL provide a "Save & Recalculate Strategy" button that sends the customized threshold parameters to `POST /api/v1/sdca/backtest` and updates the studio's state.

#### Scenario: Recalculation execution on save
- **WHEN** the user clicks "Save & Recalculate Strategy"
- **THEN** the frontend SHALL issue a `POST /api/v1/sdca/backtest` request with payload containing `thresholds: { dca_in_start, all_in_val, dca_out_start, all_out_val }`
- **AND** update `SdcaChart` equity curve, backtest metrics badges (Sharpe Ratio, Total Return, Max Drawdown), and transaction ledger table dynamically

#### Scenario: Parameter validation error
- **WHEN** the user inputs an invalid parameter (e.g. `all_in_val > dca_in_start` or out-of-bounds value)
- **THEN** the UI SHALL highlight the invalid input field with an error message and disable the "Save & Recalculate Strategy" button

### Requirement: Preset Hysteresis Configurations

The UI SHALL provide pre-configured macro strategy presets (e.g. "Cycle Hysteresis Default", "High Sharpe Focus", "Maximum Yield Focus") alongside custom inputs.

#### Scenario: Selecting strategy preset
- **WHEN** the user selects "High Sharpe Focus" from the preset dropdown
- **THEN** input controls SHALL auto-populate with `dca_in_start = 1.80`, `all_in_val = 1.50`, `dca_out_start = -1.50`, `all_out_val = -0.50`
- **AND** automatically trigger backend strategy recalculation
