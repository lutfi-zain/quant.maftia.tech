## ADDED Requirements

### Requirement: Inline Sparkline Charts in Component Matrix

Each row of the Piecewise Linear Component Matrix table in the Valuation Studio SHALL include a small inline sparkline chart displaying the last 90 data points of the metric's normalized score trend.

#### Scenario: Sparkline renders for each metric row

- **WHEN** the component breakdown table is rendered with the list of 17 valuation indicators
- **THEN** each row MUST contain a sparkline SVG showing the 90-day normalized score trend for that specific metric

#### Scenario: Sparkline data source

- **WHEN** the Valuation Studio loads component signals from `GET /api/v1/analytics/components?system=quant-btc-valuation-system`
- **THEN** the sparkline for each metric SHALL be derived from the `normalized_score` field of the component signal timeseries, filtered to the most recent 90 data points sorted by date ascending

#### Scenario: Sparkline color reflects signal direction

- **WHEN** a sparkline is rendered for a metric
- **THEN** the sparkline stroke color MUST reflect the latest signal direction: green (`#22C55E`) when `signal_direction == -1` (discount), red (`#EF4444`) when `signal_direction == 1` (overvalued), and gray (`#64748B`) when `signal_direction == 0` (neutral)

### Requirement: Sparkline SVG Implementation

Sparklines SHALL be rendered as lightweight SVG `<polyline>` elements with no external charting library dependency. Each sparkline MUST fit within a fixed-width container (approximately 80px wide, 24px tall) with automatic Y-axis scaling to the min/max of the 90-point data window.

#### Scenario: Sparkline container sizing

- **WHEN** a sparkline SVG is rendered in a table cell
- **THEN** the SVG viewBox MUST be sized to fit within the table cell without causing horizontal overflow or layout reflow

#### Scenario: Empty sparkline state

- **WHEN** a metric has fewer than 2 data points in the 90-day window
- **THEN** the sparkline cell MUST display a subtle dash or empty state instead of a broken SVG path

### Requirement: Sparkline Hover Tooltip

When a user hovers over a sparkline, a small tooltip SHALL appear showing the date and value of the nearest data point.

#### Scenario: Sparkline hover interaction

- **WHEN** a user moves their cursor over the sparkline SVG
- **THEN** a tooltip MUST appear near the cursor position displaying the date and normalized score value of the closest data point in the 90-day window
