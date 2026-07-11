## MODIFIED Requirements

### Requirement: Chart Panel Visual Container

The `.chart-panel` CSS class SHALL use the following properties:
- `background: var(--bg-card)` (solid, no backdrop-filter)
- `border: 1px solid var(--border-card)`
- `border-radius: 4px`
- `box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.24)`
- `overflow: hidden`

The `.chart-panel` SHALL NOT apply `backdrop-filter` or `-webkit-backdrop-filter`.

#### Scenario: Chart panel renders with solid background
- **WHEN** a `.chart-panel` element renders
- **THEN** its `background` SHALL be `var(--bg-card)` (solid `#0f172a`)
- **THEN** its `border-radius` SHALL be `4px`
- **THEN** its `backdrop-filter` SHALL be `none`

### Requirement: Chart Subplot Header Density

The `.chart-subplot-header` SHALL use compact padding of `6px 10px` (reduced from `8px 14px`). Font size SHALL remain `11px`. The header background SHALL be `rgba(255, 255, 255, 0.02)`.

#### Scenario: Subplot header renders compact
- **WHEN** a `.chart-subplot-header` element renders
- **THEN** its padding SHALL be `6px 10px`

### Requirement: Y-Axis Width Lock

The chart Y-axis width SHALL remain locked at `85px` on desktop and `65px` on mobile. This requirement is UNCHANGED.

#### Scenario: Y-axis width preserved
- **WHEN** a chart subplot renders on desktop
- **THEN** the right Y-axis width SHALL be `85px`
