# sdca-threshold-editor Specification

## Purpose

Provide a frontend threshold slider UI in the SDCA Panel that allows users to customize all 4 hysteresis thresholds (DCA In Start, All In Val, DCA Out Start, All Out Val) and trigger a backend recalculation.

## Requirements

### Requirement: Threshold Slider Inputs

The SDCA Panel SHALL render 4 range sliders for the hysteresis thresholds with real-time value display.

#### Scenario: User adjusts threshold slider

- **WHEN** the user drags any of the 4 sliders (DCA In Start, All In Val, DCA Out Start, All Out Val)
- **THEN** the displayed value SHALL update in real-time as the slider moves
- **AND** the component SHALL debounce for 300ms before triggering a recalculate

#### Scenario: Threshold validation

- **WHEN** the user adjusts thresholds such that `all_in_val > dca_in_start` or `all_out_val < dca_out_start`
- **THEN** the Recalculate button SHALL be disabled
- **AND** a tooltip SHALL display: "All In must be ≤ DCA In Start" or "All Out must be ≥ DCA Out Start"

### Requirement: Preset Integration

The threshold sliders SHALL initialize from the selected preset's values, and selecting a new preset SHALL update all slider values.

#### Scenario: Preset selection updates sliders

- **WHEN** the user selects a preset (Optimized, High Sharpe, Max Yield, Conservative)
- **THEN** the 4 sliders SHALL snap to that preset's threshold values
- **AND** a "Custom" preset option SHALL appear when slider values diverge from all built-in presets

### Requirement: localStorage Persistence

Custom threshold values SHALL be persisted to `localStorage` and restored on component mount.

#### Scenario: Page refresh preserves thresholds

- **WHEN** the component mounts
- **THEN** it SHALL check `localStorage` key `sdca_custom_thresholds`
- **AND** if found, SHALL initialize the sliders from those values
- **AND** SHALL trigger an initial recalculate with those values
