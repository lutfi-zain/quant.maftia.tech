# metric-detail-chart Specification

## Purpose
TBD - created by archiving change valuation-studio-parity-with-prior-system. Update Purpose after archive.
## Requirements
### Requirement: 3-Panel Metric Detail Chart View
The Valuation Studio SHALL render a 3-panel Lightweight Charts v5.2 layout when a user selects a specific metric indicator from the component breakdown table. The three panels are: (1) BTC OHLC Candlestick (top, log scale default), (2) Raw Metric Line with configurable threshold lines (middle), and (3) Oscillator Line with ±2.0 reference lines (bottom). On desktop viewports (`≥768px`), each subplot container SHALL enforce `rightPriceScale: { minimumWidth: 85 }`. On mobile viewports (`<768px`), each subplot container SHALL enforce `rightPriceScale: { minimumWidth: 65 }` to optimize horizontal plotting area while maintaining strict crosshair vertical synchronization.

#### Scenario: Metric detail view opens on indicator click
- **WHEN** a user clicks any indicator row in the Piecewise Linear Component Matrix table (or taps a compact list row on mobile, e.g., "MVRV Z-Score", "Puell Multiple")
- **THEN** the 3-panel chart view MUST replace the main composite chart area and fetch the metric's raw timeseries data from `GET /api/v1/analytics/metric/{metric_name}`

#### Scenario: 3-panel layout with correct Y-axis lock on desktop
- **WHEN** the 3-panel metric detail chart is rendered on a desktop viewport (`≥768px`)
- **THEN** each of the 3 subplots MUST enforce `rightPriceScale: { minimumWidth: 85 }` to ensure horizontal time-tick alignment across BTC price, raw metric, and oscillator panels

#### Scenario: 3-panel layout with correct Y-axis lock on mobile
- **WHEN** the 3-panel metric detail chart is rendered on a mobile viewport (`<768px`)
- **THEN** each of the 3 subplots MUST enforce `rightPriceScale: { minimumWidth: 65 }` to align time-ticks vertically across all 3 stacked panels (`BTC OHLC`, `Raw Metric`, `Oscillator`) while reclaiming canvas width

#### Scenario: Panel maximize/restore per subplot
- **WHEN** a user clicks the maximize button on any of the 3 subplots
- **THEN** that subplot MUST expand to fill the available chart area while the other 2 subplots collapse to 0 height (hidden via CSS class `.chart-subplot-hidden`, not removed from DOM)

#### Scenario: Close metric detail view
- **WHEN** a user clicks the close/restore button in the metric detail header
- **THEN** the 3-panel view MUST be removed and the main composite chart + component table MUST be restored

### Requirement: Raw Metric Panel with Threshold Lines

The middle panel of the 3-panel detail view SHALL display the raw metric value as a LineSeries with 5 configurable horizontal threshold price lines (`t_minus_2`, `t_minus_1`, `t_zero`, `t_plus_1`, `t_plus_2`) rendered via `createPriceLine`.

#### Scenario: Threshold lines render on raw metric chart

- **WHEN** the raw metric panel is initialized with threshold config from `GET /api/v1/analytics/metric/{metric_name}/config`
- **THEN** 5 horizontal dashed price lines MUST appear at the configured threshold values with color-coded labels: red for peak zones (`t_minus_2`, `t_minus_1`), gray for mid (`t_zero`), green for accumulation zones (`t_plus_1`, `t_plus_2`)

#### Scenario: Threshold lines update on editor input

- **WHEN** a user modifies a threshold value in the inline threshold editor
- **THEN** the corresponding price line on the raw metric chart MUST update in real-time (remove old line, create new line with updated price) without reinitializing the chart

### Requirement: Oscillator Panel with Reference Lines

The bottom panel SHALL display the piecewise-mapped oscillator value (`[-2.0, +2.0]`) as a LineSeries computed client-side via the `mapToOscillator` function using the current threshold config. Reference lines at +2.0 (bottom/undervalued), 0 (neutral), and -2.0 (peak/overvalued) SHALL be rendered.

#### Scenario: Oscillator recalculates on threshold change

- **WHEN** a user adjusts any threshold value in the editor
- **THEN** the oscillator series data MUST be recomputed from the raw metric timeseries + updated thresholds and the chart MUST re-render with the new oscillator curve within 100ms

#### Scenario: Oscillator reference lines

- **WHEN** the oscillator panel is rendered
- **THEN** it MUST display horizontal reference lines at +2.0 (green, "Bottom"), 0 (gray), and -2.0 (red, "Peak") via `createPriceLine`

### Requirement: Crosshair Sync Across 3 Panels

The 3-panel metric detail view SHALL implement bidirectional vertical crosshair synchronization across all three subplots (BTC OHLC, Raw Metric, Oscillator) using `subscribeCrosshairMove` and `setCrosshairPosition`.

#### Scenario: Crosshair drag syncs all 3 panels

- **WHEN** a user hovers or drags the crosshair on any of the 3 panels
- **THEN** the other 2 panels MUST simultaneously display their vertical crosshair line at the same time index without triggering recursive event loops

### Requirement: BTC OHLC Panel with Log Scale Toggle

The top panel SHALL display BTC OHLC data as a CandlestickSeries with a Log/Linear scale toggle button.

#### Scenario: Log scale toggle

- **WHEN** a user clicks the LOG/LIN toggle button
- **THEN** the BTC OHLC panel's right price scale mode MUST switch between `PriceScaleMode.Logarithmic` and `PriceScaleMode.Normal`

#### Scenario: Data source for BTC OHLC

- **WHEN** the metric detail view is opened
- **THEN** the BTC OHLC data SHALL be fetched from `MasterOHLCV` via the metric detail API route, aligned by date with the raw metric timeseries to prevent misaligned bars

### Requirement: Threshold Editor UI
The metric detail view SHALL include a Piecewise Threshold Editor with 5 numeric input fields (`t_minus_2`, `t_minus_1`, `t_zero`, `t_plus_1`, `t_plus_2`) and a "Save Config" button that persists the configuration to the backend (`POST /api/v1/analytics/metric/{metric_name}/config`). On desktop viewports (`≥768px`), the editor SHALL render as an inline side-by-side sidebar column (`280px` width) adjacent to the 3-panel charts. On mobile viewports (`<768px`), the editor SHALL render inside a slide-up `<BottomSheet />` component that floats over the bottom of the screen, leaving the 3-panel charts to occupy full width (`100%`).

#### Scenario: Threshold inputs display current config on desktop
- **WHEN** the metric detail view mounts on a desktop viewport (`≥768px`)
- **THEN** the 5 threshold input fields MUST be rendered in the right-side `280px` panel and populated with values from `GET /api/v1/analytics/metric/{metric_name}/config`

#### Scenario: Threshold inputs display inside BottomSheet on mobile
- **WHEN** the metric detail view mounts on a mobile viewport (`<768px`)
- **THEN** the right-side `280px` column MUST NOT render inline; instead, a trigger button ("CONFIGURE THRESHOLDS") MUST be visible near the chart header, and tapping it (or opening the detail view by default in peek state) MUST render the 5 threshold inputs inside the slide-up `<BottomSheet />`

#### Scenario: Save config to backend from either layout
- **WHEN** a user modifies thresholds and clicks "Save Config" inside the desktop sidebar or the mobile bottom sheet
- **THEN** the system SHALL POST the updated thresholds to `POST /api/v1/analytics/metric/{metric_name}/config` and display a success/error confirmation toast

#### Scenario: Auto-detect oscillator direction
- **WHEN** threshold values are loaded or changed
- **THEN** the `mapToOscillator` function MUST auto-detect whether the metric is inverted (higher raw = more overvalued) or normal (higher raw = more undervalued) based on the relative positions of `t_plus_2` and `t_minus_2`

### Requirement: Metric Detail API Routes

The Hono API Gateway on `:8765` SHALL provide the following routes for the metric detail view:

#### Scenario: Fetch metric timeseries

- **WHEN** a client requests `GET /api/v1/analytics/metric/{metric_name}`
- **THEN** the API SHALL return JSON with `raw_values` (array of `{date, value}`), `btc_ohlc` (array of `{date, open, high, low, close}`), and `normalized_values` (array of `{date, value}`) sourced from the subsystem database with t-1 causal filter verification

#### Scenario: Fetch metric threshold config

- **WHEN** a client requests `GET /api/v1/analytics/metric/{metric_name}/config`
- **THEN** the API SHALL return JSON with `{metric_name, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2}` from the metric config table, or default thresholds if no config exists

#### Scenario: Save metric threshold config

- **WHEN** a client sends `POST /api/v1/analytics/metric/{metric_name}/config` with threshold values in the body
- **THEN** the API SHALL upsert the threshold configuration into the metric config table using parameterized SQL with SQLite WAL mode and return `{status: "saved", metric_name, thresholds}`

### Requirement: Responsive Layout
The 3-panel chart view MUST be responsive and resize correctly when the browser window is resized or device orientation changes, using ResizeObserver on the wrapper container. On desktop viewports (`≥768px`), the outer layout SHALL use `gridTemplateColumns: "1fr 280px"`. On mobile viewports (`<768px`), the outer layout SHALL use `gridTemplateColumns: "1fr"` with stacked full-width chart subplots (`width: 100%`).

#### Scenario: Window resize reflows charts
- **WHEN** the browser window is resized while the metric detail view is active across or within breakpoints
- **THEN** all 3 chart instances MUST be resized to match the new container width via ResizeObserver without layout drift or horizontal clipping

### Requirement: Metric detail chart oscillator panel shows 5 reference lines
The `MetricDetailChart` oscillator panel SHALL display exactly 5 horizontal reference lines at `+2.0`, `+1.0`, `0`, `-1.0`, `-2.0`. The previous implementation showed only 3 lines (`+2.0`, `0`, `-2.0`), omitting `+1.0` and `-1.0`.

#### Scenario: All 5 lines visible on metric detail chart load
- **WHEN** the metric detail chart mounts
- **THEN** exactly 5 reference lines are visible on the oscillator panel: `+2.0`, `+1.0`, `0`, `-1.0`, `-2.0`

#### Scenario: Reference lines persist across threshold edits
- **WHEN** the user edits threshold values in the threshold editor
- **THEN** all 5 oscillator reference lines remain visible (threshold changes affect only the raw metric panel)

### Requirement: Threshold editor direction badge and dirty indicator
The `MetricDetailChart` threshold editor SHALL include:
1. A `DIR: NORMAL / DIR: INVERTED` badge computed live from current threshold values
2. A `● UNSAVED CHANGES` pulsing indicator when thresholds differ from the saved snapshot
3. A `Reset to Defaults` button

See `valuation-studio-threshold-editor-ux/spec.md` for full requirement details.

#### Scenario: All three UX elements present in threshold editor DOM
- **WHEN** the threshold editor panel is rendered
- **THEN** the direction badge, unsaved indicator slot, and reset button are all present in the DOM

### Requirement: Save threshold triggers renormalize then refresh
After a successful threshold config save, `MetricDetailChart` SHALL call the renormalize endpoint before calling `onRefresh()`.

See `valuation-studio-renormalize-flow/spec.md` for full requirement details.

#### Scenario: Save button triggers renormalize before chart refresh
- **WHEN** the user clicks Save in the threshold editor and the save succeeds
- **THEN** the renormalize API is called for the active metric before `onRefresh()` is invoked

