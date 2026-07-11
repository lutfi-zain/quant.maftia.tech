# chart-panel-layout Specification

## Purpose
TBD - created by archiving change frontend-dashboard-revamp. Update Purpose after archive.
## Requirements
### Requirement: Chart panel renders as single seamless multi-pane container
All chart subplots within a given view (Dashboard or any Studio) SHALL be rendered inside a single parent container with zero visual gap between panels. Subplots SHALL be separated by a 1px hairline divider (`var(--border-panel)`) only. No individual glass-card wrappers per subplot.

#### Scenario: Dashboard shows 4 seamlessly stacked panels
- **WHEN** the user loads the Executive Dashboard
- **THEN** the Price, Valuation, LTTD, and MTTD subplots appear as a contiguous stacked block with no visible gap between them

#### Scenario: Subplot bottom pane shows time axis; others hide it
- **WHEN** multiple subplots are rendered in a chart panel
- **THEN** only the bottom-most subplot displays a time axis; all others have `timeScale.visible: false`

#### Scenario: Y-axis 85px lock applies to all subplots
- **WHEN** any chart panel is rendered
- **THEN** every subplot's right price scale has `minimumWidth: 85` enforced, aligning all vertical chart areas horizontally

### Requirement: Log/Linear toggle applies to BTC price subplots
Each view containing a BTC Candlestick subplot SHALL expose a `[LOG | LIN]` toggle control. The toggle SHALL dynamically apply `PriceScaleMode.Logarithmic` or `PriceScaleMode.Normal` to the price chart's right scale without remounting the chart.

#### Scenario: Log scale applied on toggle
- **WHEN** user clicks the `LOG` option
- **THEN** the BTC price subplot switches to logarithmic scale within 100ms without data loss or chart remount

#### Scenario: Linear scale applied on toggle
- **WHEN** user clicks the `LIN` option
- **THEN** the BTC price subplot switches to linear scale within 100ms

#### Scenario: Default is logarithmic
- **WHEN** any chart view loads for the first time
- **THEN** the BTC price subplot is in logarithmic scale by default

### Requirement: Per-subplot maximize with three-state mode
Each chart panel SHALL support a maximize button per subplot header. Maximize SHALL operate in three modes: `null` (all subplots), `'btc'` (BTC fullscreen), `'<subplot-id>'` (BTC at 65% + chosen subplot at 35%).

#### Scenario: BTC maximize shows only BTC fullscreen
- **WHEN** user clicks the maximize button on the BTC subplot header
- **THEN** only the BTC candlestick subplot is visible at full available height; all other subplots are hidden

#### Scenario: Oscillator subplot maximize shows BTC + subplot
- **WHEN** user clicks the maximize button on a non-BTC subplot (e.g., Valuation Composite)
- **THEN** the BTC pane is shown at 65% height and the selected subplot at 35% height; all other subplots are hidden

#### Scenario: Restore returns to full 4-pane view
- **WHEN** user clicks the restore/close button while in any maximized state
- **THEN** all subplots return to their default heights and are all visible

#### Scenario: Crosshair sync remains active during maximize
- **WHEN** any maximize mode is active and visible subplots exist
- **THEN** crosshair movement in one visible subplot syncs to all other currently visible subplots

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


