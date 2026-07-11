## MODIFIED Requirements

### Requirement: Sparkline values drawn from normalized_score without multiplier
The `MetricSparkline` component and its parent data mapping in `ValuationStudio.tsx` SHALL use `normalized_score` values directly (no `* 2` multiplier). Sparkline Y values MUST be bounded to `[-2.0, +2.0]` matching the stored `UnifiedComponentSignals.normalized_score` range.

#### Scenario: Sparkline polyline points bounded to [-2.0, +2.0]
- **WHEN** sparkline data is mapped from 90 days of `UnifiedComponentSignals` rows
- **THEN** all Y values are the raw `normalized_score` without transformation
- **AND** no polyline point value exceeds `+2.0` or goes below `-2.0` due to multiplication
