## MODIFIED Requirements

### Requirement: Metric detail chart oscillator panel shows 5 reference lines
The `MetricDetailChart` oscillator panel SHALL display exactly 5 horizontal reference lines at `+2.0`, `+1.0`, `0`, `-1.0`, `-2.0`. The previous implementation showed only 3 lines (`+2.0`, `0`, `-2.0`), omitting `+1.0` and `-1.0`.

#### Scenario: All 5 lines visible on metric detail chart load
- **WHEN** the metric detail chart mounts
- **THEN** exactly 5 reference lines are visible on the oscillator panel: `+2.0`, `+1.0`, `0`, `-1.0`, `-2.0`

#### Scenario: Reference lines persist across threshold edits
- **WHEN** the user edits threshold values in the threshold editor
- **THEN** all 5 oscillator reference lines remain visible (threshold changes affect only the raw metric panel)

## ADDED Requirements

### Requirement: Threshold editor direction badge and dirty indicator
The `MetricDetailChart` threshold editor SHALL include:
1. A `DIR: NORMAL / DIR: INVERTED` badge computed live from current threshold values
2. A `● UNSAVED CHANGES` pulsing indicator when thresholds differ from the saved snapshot
3. A `Reset to Defaults` button

See `valuation-studio-threshold-editor-ux/spec.md` for full requirement details.

#### Scenario: All three UX elements present in threshold editor DOM
- **WHEN** the threshold editor panel is rendered
- **THEN** the direction badge, unsaved indicator slot, and reset button are all present in the DOM

### Requirement: Save threshold triggers renormalize then refresh
After a successful threshold config save, `MetricDetailChart` SHALL call the renormalize endpoint before calling `onRefresh()`.

See `valuation-studio-renormalize-flow/spec.md` for full requirement details.

#### Scenario: Save button triggers renormalize before chart refresh
- **WHEN** the user clicks Save in the threshold editor and the save succeeds
- **THEN** the renormalize API is called for the active metric before `onRefresh()` is invoked
