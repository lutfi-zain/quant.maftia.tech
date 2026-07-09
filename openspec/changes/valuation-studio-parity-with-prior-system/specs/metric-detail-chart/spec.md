## ADDED Requirements

### Requirement: 3-Panel Metric Detail Chart View

The Valuation Studio SHALL render a 3-panel Lightweight Charts v5.2 layout when a user selects a specific metric indicator from the component breakdown table. The three panels are: (1) BTC OHLC Candlestick (top, log scale default), (2) Raw Metric Line with configurable threshold lines (middle), and (3) Oscillator Line with ±2.0 reference lines (bottom).

#### Scenario: Metric detail view opens on indicator click

- **WHEN** a user clicks any indicator row in the Piecewise Linear Component Matrix table (e.g., "MVRV Z-Score", "Puell Multiple")
- **THEN** the 3-panel chart view MUST replace the main composite chart area and fetch the metric's raw timeseries data from `GET /api/v1/analytics/metric/{metric_name}`

#### Scenario: 3-panel layout with correct Y-axis lock

- **WHEN** the 3-panel metric detail chart is rendered
- **THEN** each of the 3 subplots MUST enforce `rightPriceScale: { minimumWidth: 85 }` to ensure horizontal time-tick alignment across BTC price, raw metric, and oscillator panels

#### Scenario: Panel maximize/restore per subplot

- **WHEN** a user clicks the maximize button on any of the 3 subplots
- **THEN** that subplot MUST expand to fill the available chart area while the other 2 subplots collapse to 0 height (hidden via CSS class, not removed from DOM)

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

The metric detail view SHALL include an inline threshold editor with 5 numeric input fields (`t_minus_2`, `t_minus_1`, `t_zero`, `t_plus_1`, `t_plus_2`) and a "Save Config" button that persists the configuration to the backend.

#### Scenario: Threshold inputs display current config

- **WHEN** the metric detail view mounts
- **THEN** the 5 threshold input fields MUST be populated with values from `GET /api/v1/analytics/metric/{metric_name}/config`

#### Scenario: Save config to backend

- **WHEN** a user modifies thresholds and clicks "Save Config"
- **THEN** the system SHALL POST the updated thresholds to `POST /api/v1/analytics/metric/{metric_name}/config` and display a success/error confirmation

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

The 3-panel chart view MUST be responsive and resize correctly when the browser window is resized, using ResizeObserver on the wrapper container.

#### Scenario: Window resize reflows charts

- **WHEN** the browser window is resized while the metric detail view is active
- **THEN** all 3 chart instances MUST be resized to match the new container width via ResizeObserver without layout drift
