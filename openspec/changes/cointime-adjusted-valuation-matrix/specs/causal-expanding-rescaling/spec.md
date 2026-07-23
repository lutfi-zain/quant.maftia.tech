# causal-expanding-rescaling Specification

## ADDED Requirements

### Requirement: Per-Indicator Expanding Rescaling

The Valuation System SHALL support optional per-indicator expanding-window percentile rescaling as a preprocessing step before composite averaging. When enabled for a specific indicator, the indicator's normalized values SHALL be rescaled through its own expanding-window distribution (independent of other indicators) before contributing to the composite average.

#### Scenario: Optional per-indicator rescaling

- **WHEN** the `metric_config` table has `rescale_method = 'expanding_window'` for a given indicator
- **THEN** the system SHALL compute `p2_5`, `p50`, and `p97_5` using only historical values of that specific indicator up to day `t-1`
- **AND** map the indicator's value at day `t` to [-2, +2] using these parameters before the value enters the composite average

#### Scenario: Co-existing with composite rescaling

- **WHEN** both per-indicator rescaling and composite-level expanding-window rescaling are enabled
- **THEN** the per-indicator rescaling SHALL run first (as a preprocessing step on individual normalized scores)
- **AND** the composite-level rescaling SHALL run second (on the averaged DR-immune composite)

### Requirement: Rescaling Method Configuration

The `metric_config` table SHALL support a `rescale_method` column that controls whether each indicator uses `'none'` (default, existing behavior), `'expanding_window'` (per-indicator causal rescaling), or `'rolling_mean'` (365-day rolling mean normalization).

#### Scenario: Configuration-driven rescaling

- **WHEN** the pipeline reads the `metric_config` table
- **THEN** it SHALL apply the `rescale_method` specified for each indicator before computing the composite average
- **AND** default to `'none'` if the column is NULL or missing
