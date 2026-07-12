## ADDED Requirements

### Requirement: Subplot meta text SHALL be removed

The `.subplot-meta` span elements SHALL be removed from all subplot headers. This includes but is not limited to: "BTC / USD · DAILY", "RANGE [-2.00, +2.00]", "REGIME-COLORED CANDLES", "LOG RETURN BASIS", "MULTI-PRINCIPLE TRACKING", "ER ≥ 0.20 · H ≤ 2.30", "SUPERSMOOTHER FILTERED CLOUD", "BOUNDED TANH [-1.00, +1.00]", "ZERO-LAG IIR".

#### Scenario: Subplot header has no subtitle

- **WHEN** a subplot header is rendered
- **THEN** it SHALL NOT contain a `.subplot-meta` element
- **AND** the header SHALL show only the title (badge + name) and maximize button

### Requirement: Axis lock badge SHALL be removed

The `.subplot-axis-lock` span element (showing "85px") SHALL be removed from all subplot headers. The Y-axis width lock remains enforced via chart `priceScale("right").applyOptions({ minimumWidth })` — only the visual badge is removed.

#### Scenario: No axis lock badge visible

- **WHEN** a subplot header is rendered
- **THEN** it SHALL NOT contain a `.subplot-axis-lock` element
- **AND** the maximize button SHALL be the only element in `.subplot-controls`

### Requirement: Mobile header SHALL collapse to single row

With the metadata and axis lock removed, the mobile subplot header SHALL use a single-row layout instead of the current 2-row column layout. This recovers vertical space for the chart.

#### Scenario: Mobile header is compact

- **WHEN** the viewport is ≤ 768px
- **THEN** `.chart-subplot-header` SHALL use `flex-direction: row`
- **AND** the `min-height` SHALL be reduced from 48px to match desktop height
- **AND** the `.subplot-controls` SHALL NOT have a `border-top` separator

### Requirement: Change applies to all 4 studios

The header cleanup SHALL be applied consistently to ValuationStudio, LttdLab, MttdConsole, and IchimokuTerminal.

#### Scenario: All subplots cleaned

- **WHEN** each studio's subplot headers are inspected
- **THEN** all subplot headers across all 4 studios SHALL have the metadata and axis lock removed
- **AND** the header structure SHALL be consistent across all studios
