# valuation-studio-parity-audit Specification

## Purpose
TBD - created by archiving change valuation-studio-complete-parity-audit. Update Purpose after archive.
## Requirements
### Requirement: Composite Chart (2-Panel) Parity Audit

The system SHALL verify that the unified `ValuationStudio.tsx` 2-panel composite chart (BTC Candlestick + Valuation Composite Area) renders identically to the prior `CompositeChart.tsx`.

#### Scenario: BTC candlestick data alignment

- **WHEN** the composite chart renders
- **THEN** BTC candlestick data SHALL be sourced from `MasterOHLCV` via `dailyData` and rendered with the same up/down colors (green/#22C55E up, red/#EF4444 down) as prior system (green/#10b981 up, red/#f43f5e down)

#### Scenario: Valuation composite area rendering

- **WHEN** the composite chart renders
- **THEN** the valuation composite SHALL use `AreaSeries` with semi-transparent top fill and gradient bottom (prior: `rgba(59,130,246,0.2)` → `rgba(59,130,246,0.0)`, unified: `rgba(96,165,250,0.35)` → `rgba(96,165,250,0.02)`)

#### Scenario: Reference line parity

- **WHEN** the composite chart renders
- **THEN** reference lines SHALL exist at `+2.0`, `+1.5`, `+1.0`, `0`, `-1.0`, `-2.0` matching prior system's 5 reference lines — verify unified only has `+1.50` and `-1.00`

#### Scenario: Crosshair sync across 2 panels

- **WHEN** user hovers on any subplot
- **THEN** crosshair SHALL sync bidirectionally across BTC and Valuation panels with `requestAnimationFrame` guard — same pattern as prior system's `isSyncing` flag

#### Scenario: Time range sync

- **WHEN** user zooms or scrolls on any subplot
- **THEN** visible logical range SHALL sync across all subplots via `subscribeVisibleLogicalRangeChange` / `setVisibleLogicalRange` — verify parity with prior system's approach

#### Scenario: LOG/LIN toggle

- **WHEN** user clicks LOG/LIN toggle
- **THEN** BTC price scale SHALL toggle between `PriceScaleMode.Logarithmic` and `PriceScaleMode.Normal` — verify it applies to `priceScale("right")` only

#### Scenario: Maximize/restore 2-panel

- **WHEN** user clicks maximize on BTC pane
- **THEN** BTC pane SHALL expand to full viewport height, Valuation pane SHALL collapse to height 0 using CSS class (not DOM removal) — prior system used body overflow hidden for fullscreen

#### Scenario: PNG export button location

- **WHEN** user views composite chart
- **THEN** a SAVE PNG button SHALL exist in the chart control bar — verify filename convention matches prior system (`btc-valuation-YYYY-MM-DD.png`)

### Requirement: Metric Detail Chart (3-Panel) Parity Audit

The system SHALL verify that the unified `MetricDetailChart.tsx` 3-panel detail view (BTC Candlestick + Raw Metric Line + Piecewise Oscillator Line) behaves identically to the prior `AvivRatioChart.tsx` and `MetricDetail.tsx`.

#### Scenario: 3-panel layout parity

- **WHEN** user clicks a metric in the component matrix
- **THEN** the detail view SHALL show BTC OHLC Candlestick (top), Raw Metric Line with threshold lines (middle), and Piecewise Oscillator Line with ±2 reference lines (bottom) — matching prior system's 3-panel arrangement

#### Scenario: BTC candlestick in metric detail

- **WHEN** metric detail renders
- **THEN** BTC OHLC data SHALL be sourced from the metric timeseries API response's `btc_ohlc` field with proper date intersection — prior system used separate `/api/metrics/btc_ohlc` endpoint

#### Scenario: Raw metric line with threshold lines

- **WHEN** raw metric panel renders
- **THEN** threshold lines SHALL be rendered via `createPriceLine` on the raw metric series for all 5 thresholds (t_minus_2 red, t_minus_1 light red, t_zero gray, t_plus_1 light green, t_plus_2 green) — matching prior system's color scheme

#### Scenario: Oscillator reference lines

- **WHEN** oscillator panel renders
- **THEN** reference lines SHALL exist at `+2.0` (green), `0` (gray), and `-2.0` (red) with axis labels — verify parity with prior system which had 5 reference lines: `+2.0`, `+1.0`, `0`, `-1.0`, `-2.0`

#### Scenario: Crosshair sync across 3 panels

- **WHEN** user hovers on any panel
- **THEN** crosshair SHALL sync across all 3 panels — prior system used `getCrosshairData` helper looking up data by time string, unified uses `param.time` directly — verify both achieve same result

#### Scenario: Per-panel maximize/restore

- **WHEN** user clicks maximize on any of the 3 panels
- **THEN** that panel SHALL expand to 500px height, others collapse to 0 using CSS class — verify prior system did NOT have per-panel maximize (only chart-level maximize)

#### Scenario: Threshold editor visibility

- **WHEN** metric detail loads
- **THEN** threshold editor SHALL be visible as an inline sidebar on desktop and a BottomSheet on mobile — prior system had it below the chart panels after a border-top separator

### Requirement: Threshold Editor Parity Audit

The system SHALL verify that the threshold editor in `MetricDetailChart.tsx` operates identically to the prior `ThresholdEditor.tsx`.

#### Scenario: 5 threshold inputs

- **WHEN** threshold editor renders
- **THEN** SHALL display 5 numeric inputs: t_minus_2 (Peak, red), t_minus_1 (Warning, light red), t_zero (Neutral, gray), t_plus_1 (Opportunity, light green), t_plus_2 (Bottom, green) — matching prior system's labels and color coding

#### Scenario: Direction detection

- **WHEN** thresholds are entered
- **THEN** direction SHALL be auto-detected as NORMAL or INVERTED based on `t_plus_2 > t_minus_2` — prior system showed direction badge in the editor, verify unified shows it

#### Scenario: Dirty/unsaved state indicator

- **WHEN** thresholds change from saved state
- **THEN** SHALL show an unsaved changes indicator — prior system had `* UNSAVED CHANGES` with pulse animation, verify unified equivalent

#### Scenario: Real-time oscillator recomputation

- **WHEN** any threshold input changes
- **THEN** oscillator data SHALL be recomputed client-side via `mapToOscillator` and series data updated in real-time — verify parity with prior system's useEffect on thresholds

#### Scenario: Real-time price line updates

- **WHEN** any threshold input changes
- **THEN** threshold price lines on the raw metric chart SHALL update in real-time via `removePriceLine`/`createPriceLine` — verify parity

#### Scenario: Save to backend

- **WHEN** user clicks SAVE CONFIG
- **THEN** thresholds SHALL be persisted via POST to `/api/v1/quant/metric/:metric_name/config` — prior system called `saveMetricConfig` then also called `renormalizeMetric` — verify unified only saves config without renormalization

#### Scenario: Reset to defaults

- **WHEN** user clicks reset
- **THEN** thresholds SHALL revert to default seed values — prior system fetched defaults from `/api/metrics/config/defaults`, unified has hardcoded `DEFAULT_THRESHOLDS` in backend route — verify matches

### Requirement: Component Matrix & Metric Grid Parity Audit

The system SHALL verify that the component breakdown table in `ValuationStudio.tsx` renders identically to the prior `MetricGrid.tsx` + `MetricCard.tsx` combination.

#### Scenario: 17 indicators rendered

- **WHEN** component matrix loads
- **THEN** all 17 indicators SHALL be rendered — verify unified's `INDICATOR_METADATA` has all 17 with correct names matching prior system's metrics list

#### Scenario: Category filtering

- **WHEN** user selects a category filter
- **THEN** SHALL filter to show only indicators of that category (Fundamental, Technical, Sentiment) — prior system used section-based layout, unified uses filter buttons — verify all indicators appear under correct categories

#### Scenario: Score display parity

- **WHEN** component matrix renders
- **THEN** SHALL display `normalized_score * 2` to map from `[-1.0, +1.0]` to `[-2.0, +2.0]` — prior system displayed `normalized_value` directly which was already in `[-2.0, +2.0]` — verify This Is A Critical Data Difference

#### Scenario: Signal direction display

- **WHEN** component matrix renders
- **THEN** SHALL display signal direction as OVERVALUED (+1) / DISCOUNT (-1) / NEUTRAL (0) with color-coded badges — verify parity with prior system's regime state text

#### Scenario: Sparkline column

- **WHEN** component matrix renders
- **THEN** SHALL show a sparkline for each indicator using 90-day window of component signal data — prior system fetched per-metric data for sparklines, unified uses `component_signals` — verify data sources match

#### Scenario: Metric detail navigation

- **WHEN** user clicks a table row
- **THEN** SHALL navigate to the 3-panel metric detail view for that indicator — prior system used `onSelectMetric` flow opening `MetricDetail` — verify parity

### Requirement: Sparkline Parity Audit

The system SHALL verify that the `Sparkline.tsx` SVG polyline component renders equivalently to the prior system's Recharts `AreaChart` sparklines in `MetricCard.tsx`.

#### Scenario: 90-day data window

- **WHEN** sparkline renders
- **THEN** SHALL use last 90 data points from component signal history — prior system fetched per-metric sparkline data from metric timeseries API — verify unified uses `components.filter(...)` and picks last 90

#### Scenario: Color coding by signal direction

- **WHEN** sparkline renders
- **THEN** SHALL be colored according to the latest signal direction: green (#22C55E) for DISCOUNT (-1), red (#EF4444) for OVERVALUED (+1), gray (#64748B) for NEUTRAL (0) — prior system colored based on `valuationToHex(metric.normalized_value)`

#### Scenario: Hover tooltip

- **WHEN** user hovers over sparkline
- **THEN** SHALL show a tooltip with date and value — prior system's Recharts sparklines had hover via library; unified uses custom SVG event handlers — verify tooltip appears

### Requirement: PNG Export Parity Audit

The system SHALL verify that `exportChartsToPng.ts` produces equivalent results to the prior system's export functionality in `CompositeChart.tsx` and `AvivRatioChart.tsx`.

#### Scenario: Canvas compositing

- **WHEN** user clicks SAVE PNG
- **THEN** SHALL composite all visible subplot canvases into a single merged canvas — prior system used `getBoundingClientRect` to position canvases, unified uses `getBoundingClientRect` too — verify positioning

#### Scenario: DevicePixelRatio handling

- **WHEN** exporting PNG
- **THEN** SHALL scale the composite canvas by `window.devicePixelRatio` for high-DPI output — verify parity with prior system

#### Scenario: Branding watermark

- **WHEN** exporting PNG
- **THEN** SHALL add a branded watermark footer: "QUANT UNIFIED PLATFORM // VALUATION" (left) and "DATE: YYYY-MM-DD" (right) — prior system used "QUANT BTC VALUATION SYSTEM // MASTER.COMPOSITE.OSCILLATOR" — verify text difference is intentional

#### Scenario: Filename conventions

- **WHEN** exporting PNG from composite view
- **THEN** filename SHALL be `btc-valuation-YYYY-MM-DD.png` — prior system used `btc-composite-oscillator-YYYY-MM-DD.png` — verify naming difference

### Requirement: API Routes & Data Parity Audit

The system SHALL verify that the unified backend routes in `src/api/routes/metrics.ts` provide data equivalent to the prior system's API.

#### Scenario: Metric timeseries endpoint

- **WHEN** `GET /api/v1/quant/metric/:metric_name` is called
- **THEN** SHALL return raw_values, normalized_values, and btc_ohlc with dates intersected for perfect alignment — prior system returned `MetricDataPoint[]` with `raw_value`, `normalized_value`, `btc_price` — verify data shape works correctly

#### Scenario: Date intersection alignment

- **WHEN** metric timeseries is fetched
- **THEN** SHALL inner-join raw values and BTC OHLC by date to prevent index-based chart sync drift — prior system used JavaScript Set intersection — verify SQL-level date join produces same result

#### Scenario: Config GET endpoint

- **WHEN** `GET /api/v1/quant/metric/:metric_name/config` is called
- **THEN** SHALL return threshold values from `metric_config` table, falling back to `DEFAULT_THRESHOLDS` — verify threshold objects match prior system's defaults

#### Scenario: Config POST endpoint

- **WHEN** `POST /api/v1/quant/metric/:metric_name/config` is called
- **THEN** SHALL upsert threshold values using `INSERT OR REPLACE INTO metric_config` with parameterized SQL — verify WAL mode is enabled

### Requirement: State Management & Navigation Parity Audit

The system SHALL verify that state management in `ValuationStudio.tsx` matches the prior `DashboardLayout.tsx`.

#### Scenario: Metric selection flow

- **WHEN** user clicks a metric row
- **THEN** `selectedMetric` state SHALL be set and the component matrix/composite chart replaced by `MetricDetailChart` — prior system used `onSelectMetric` which set `activeMetric` and rendered `MetricDetail` — verify parity

#### Scenario: Back navigation

- **WHEN** user clicks back arrow in metric detail
- **THEN** `selectedMetric` SHALL be cleared and composite chart restored — verify parity

#### Scenario: Loading and error states

- **WHEN** data is loading
- **THEN** SHALL show loading spinner/animation — prior system had skeleton loaders — verify unified has equivalent

#### Scenario: Mobile layout

- **WHEN** on mobile viewport
- **THEN** threshold editor SHALL be in a BottomSheet, component matrix SHALL use two-line list layout — verify parity with prior system's responsive behavior

