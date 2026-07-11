# valuation-studio-reference-lines Specification

## Purpose
TBD - created by archiving change valuation-studio-major-gap-fixes. Update Purpose after archive.
## Requirements
### Requirement: Composite chart shows 5 reference lines on valuation area panel
The composite valuation area panel in `ValuationStudio.tsx` SHALL display 5 horizontal reference lines at the following levels with the specified visual treatment:

| Level | Color | Dash | Label |
|-------|-------|------|-------|
| +2.0  | `rgba(239,68,68,0.8)` | dashed | Extreme Overvalued |
| +1.5  | `rgba(251,146,60,0.8)` | dashed | Bubble Risk |
| 0     | `rgba(148,163,184,0.5)` | solid | Neutral |
| -1.0  | `rgba(96,165,250,0.8)` | dashed | Discount Zone |
| -2.0  | `rgba(239,68,68,0.8)` | dashed | Extreme Undervalued |

#### Scenario: All 5 lines visible on composite chart load
- **WHEN** the composite chart loads with data
- **THEN** all 5 reference lines are visible on the valuation area panel
- **AND** each line is positioned at its correct Y level within the `[-2.0, +2.0]` oscillator scale

#### Scenario: Reference lines do not interfere with candlestick BTC panel
- **WHEN** reference lines are drawn on the valuation panel
- **THEN** the BTC candlestick panel above shows no reference lines from the valuation panel

### Requirement: Detail chart shows 5 reference lines on oscillator panel
The oscillator panel in `MetricDetailChart.tsx` SHALL display 5 horizontal reference lines at `+2.0`, `+1.0`, `0`, `-1.0`, `-2.0`, consistent with the prior system's 5-line pattern.

#### Scenario: All 5 oscillator reference lines visible on metric detail load
- **WHEN** the user selects a metric and the detail chart loads
- **THEN** all 5 reference lines (`+2.0`, `+1.0`, `0`, `-1.0`, `-2.0`) are visible on the oscillator panel
- **AND** the `0` line is gray and the `±1.0`, `±2.0` lines are colored per the existing design system

#### Scenario: Reference lines persist across metric navigation
- **WHEN** the user navigates from one metric to another in the detail view
- **THEN** all 5 oscillator reference lines are visible on the new metric's chart without requiring a page reload

