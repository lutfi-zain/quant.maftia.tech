# metric-detail-chart (Delta Spec)

## MODIFIED Requirements

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

### Requirement: Responsive Layout
The 3-panel chart view MUST be responsive and resize correctly when the browser window is resized or device orientation changes, using ResizeObserver on the wrapper container. On desktop viewports (`≥768px`), the outer layout SHALL use `gridTemplateColumns: "1fr 280px"`. On mobile viewports (`<768px`), the outer layout SHALL use `gridTemplateColumns: "1fr"` with stacked full-width chart subplots (`width: 100%`).

#### Scenario: Window resize reflows charts
- **WHEN** the browser window is resized while the metric detail view is active across or within breakpoints
- **THEN** all 3 chart instances MUST be resized to match the new container width via ResizeObserver without layout drift or horizontal clipping
