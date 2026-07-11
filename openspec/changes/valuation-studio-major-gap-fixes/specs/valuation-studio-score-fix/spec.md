## ADDED Requirements

### Requirement: normalized_score displayed without multiplier
The Valuation Studio SHALL display `UnifiedComponentSignals.normalized_score` values directly in the `[-2.0, +2.0]` range without any multiplier, in all UI locations where scores appear: the metric matrix grid, sparkline data series, and per-metric score badge.

#### Scenario: Metric score badge shows value in [-2.0, +2.0]
- **WHEN** a metric's latest `normalized_score` is `1.20`
- **THEN** the score badge displays `1.20` (not `2.40`)

#### Scenario: Sparkline data range is bounded to [-2.0, +2.0]
- **WHEN** 90 days of `normalized_score` values are mapped to sparkline polyline points
- **THEN** all Y values are in the range `[-2.0, +2.0]` without multiplication
- **AND** no sparkline point exceeds `+2.0` or goes below `-2.0` unless the raw DB value itself does

#### Scenario: Score display update after metric selection
- **WHEN** the user clicks a different metric in the matrix
- **THEN** the displayed score for the newly selected metric is taken directly from `normalized_score`
- **AND** is not scaled, doubled, or transformed before display

### Requirement: Score multiplier removed from codebase
The `* 2` multiplier SHALL NOT appear in any score computation path in `ValuationStudio.tsx` or any file it imports for scoring purposes.

#### Scenario: TypeScript source does not contain score double-scaling
- **WHEN** a developer searches the codebase for `normalized_score * 2`
- **THEN** no results are found in any Valuation Studio component file
