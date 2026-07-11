## ADDED Requirements

### Requirement: Direction detection badge shown in threshold editor
The threshold editor panel in `MetricDetailChart.tsx` SHALL display a `DIR: NORMAL` or `DIR: INVERTED` badge computed from the current threshold values, so users can confirm the metric's direction before saving.

- `DIR: NORMAL` when `t_plus_2 > t_minus_2` (higher raw values = more overvalued)
- `DIR: INVERTED` when `t_plus_2 < t_minus_2` (higher raw values = more discounted)

#### Scenario: Direction badge shows NORMAL for typical metrics
- **WHEN** the threshold editor is open for a metric where `t_plus_2 = 8.0` and `t_minus_2 = 1.0`
- **THEN** the direction badge displays `DIR: NORMAL`

#### Scenario: Direction badge shows INVERTED for inverted metrics
- **WHEN** the threshold editor is open for a metric where `t_plus_2 = 1.0` and `t_minus_2 = 8.0`
- **THEN** the direction badge displays `DIR: INVERTED`

#### Scenario: Direction badge updates in real-time on threshold change
- **WHEN** the user modifies a threshold input field causing the direction to flip
- **THEN** the direction badge updates immediately without requiring a save or page reload

### Requirement: Dirty/unsaved indicator shown when thresholds are modified
The threshold editor SHALL display a `● UNSAVED CHANGES` indicator (with CSS pulse animation) when the current threshold values differ from the last-saved snapshot, and remove the indicator after a successful save.

#### Scenario: Unsaved indicator appears on first threshold edit
- **WHEN** the user changes any threshold input value
- **THEN** a pulsing `● UNSAVED CHANGES` indicator appears in the threshold editor header

#### Scenario: Unsaved indicator disappears after successful save
- **WHEN** the user clicks Save and the save completes successfully
- **THEN** the `● UNSAVED CHANGES` indicator is hidden

#### Scenario: Unsaved indicator not shown on initial load
- **WHEN** the threshold editor first opens with the saved config
- **THEN** no unsaved indicator is visible

### Requirement: Reset-to-defaults button available in threshold editor
The threshold editor SHALL include a `Reset to Defaults` button that fetches the default threshold config for the active metric from `GET /api/v1/quant/metrics/defaults` and restores the input fields to those values (without saving).

#### Scenario: Reset button restores default thresholds
- **WHEN** the user clicks `Reset to Defaults`
- **THEN** the threshold inputs are updated to the default values for the active metric
- **AND** the `● UNSAVED CHANGES` indicator appears (reset is pending save)

#### Scenario: Bulk defaults endpoint returns all 17 indicator defaults
- **WHEN** `GET /api/v1/quant/metrics/defaults` is called
- **THEN** the response contains default threshold configs for all 17 `UnifiedComponentSignals` indicators
- **AND** each entry matches the `DEFAULT_THRESHOLDS` map in the backend
