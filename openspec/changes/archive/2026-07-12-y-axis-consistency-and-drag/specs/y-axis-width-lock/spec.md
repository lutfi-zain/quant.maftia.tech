## ADDED Requirements

### Requirement: All subplot Y-axes SHALL render at the same visible width

The right price scale width SHALL be identical across all subplots within a studio, regardless of label content length. The BTC candlestick pane's wider price labels MUST NOT cause its Y-axis to expand beyond the oscillator/indicator subplot Y-axes.

#### Scenario: Desktop Y-axis width consistency

- **WHEN** all charts in a studio are initialized on a desktop viewport (width > 768px)
- **THEN** every subplot's right price scale SHALL have the same `minimumWidth` value of `85` (from `--chart-yaxis-width`)
- **AND** the actual rendered pixel width of each subplot's price scale area SHALL match

#### Scenario: Mobile Y-axis width consistency

- **WHEN** all charts in a studio are initialized on a mobile viewport (width ≤ 768px)
- **THEN** every subplot's right price scale SHALL have the same `minimumWidth` value of `65` (from `--chart-yaxis-width` mobile override)
- **AND** the actual rendered pixel width of each subplot's price scale area SHALL match

#### Scenario: Y-axis width re-locked after maximize

- **WHEN** a subplot is maximized or restored (maximize state changes)
- **THEN** the resize effect SHALL re-apply `minimumWidth` to all subplots' right price scales
- **AND** the price scale width SHALL remain consistent across all visible subplots

### Requirement: Price scale width SHALL be enforced on chart resize

When the chart panel resizes (via ResizeObserver), each subplot's right price scale `minimumWidth` SHALL be re-applied to prevent auto-expansion by Lightweight Charts.

#### Scenario: Container resize preserves equal width

- **WHEN** the browser window is resized or the device orientation changes
- **THEN** the ResizeObserver callback SHALL call `priceScale("right").applyOptions({ minimumWidth: yWidth })` on every subplot
- **AND** all subplot Y-axis widths SHALL remain equal
