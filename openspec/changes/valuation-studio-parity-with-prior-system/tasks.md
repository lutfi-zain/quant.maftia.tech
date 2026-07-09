## 1. Backend API Routes

- [x] 1.1 Create `GET /api/v1/analytics/metric/{metric_name}` route in `src/api/routes/metrics.ts` — query raw metric timeseries from subsystem `.db`, BTC OHLC from `master_ohlcv`, normalized values from `unified_component_signals`, all with t-1 causal filter verification. Register router in main API gateway.
- [x] 1.2 Create `GET /api/v1/analytics/metric/{metric_name}/config` route — read threshold config (`t_minus_2` through `t_plus_2`) from metric config table using parameterized SQL with SQLite WAL mode. Return defaults if no config exists.
- [x] 1.3 Create `POST /api/v1/analytics/metric/{metric_name}/config` route — upsert threshold values into metric config table using parameterized SQL. Return `{status: "saved", metric_name, thresholds}`.
- [x] 1.4 Add `mapToOscillator` utility function in `src/lib/oscillator.ts` — pure function implementing the piecewise linear mapping with auto-detect direction logic (mirrors prior system's `mapToOscillator`). Export for potential backend use.

## 2. Frontend Types & Client

- [x] 2.1 Add TypeScript types to `web/src/api/types.ts`: `MetricTimeseriesResponse`, `MetricThresholdConfig`, `MetricThresholdSaveResponse` interfaces.
- [x] 2.2 Add client methods to `web/src/api/client.ts`: `getMetricTimeseries(metricName)`, `getMetricConfig(metricName)`, `saveMetricConfig(metricName, config)` — all routing through the API Gateway on `:8765`.

## 3. Sparkline Component

- [x] 3.1 Create `web/src/components/Sparkline.tsx` — lightweight SVG `<polyline>` component accepting `{data: {date: string, value: number}[], color?: string, width?: number, height?: number}` props. Auto-scales Y-axis to min/max of data. Renders within fixed viewBox.
- [x] 3.2 Add sparkline hover tooltip state to `Sparkline.tsx` — on mouse move, compute nearest data point and render a positioned tooltip with date + value.
- [x] 3.3 Integrate sparklines into the Piecewise Linear Component Matrix table in `ValuationStudio.tsx` — add a "Trend" column rendering a `Sparkline` for each indicator using the 90-day component signal data.

## 4. Metric Detail Chart Component

- [x] 4.1 Create `web/src/components/studios/MetricDetailChart.tsx` — 3-panel Lightweight Charts layout: BTC OHLC Candlestick (top, log scale), Raw Metric Line with threshold lines (middle), Oscillator Line with ±2 reference lines (bottom). All panels enforce `rightPriceScale: { minimumWidth: 85 }`.
- [x] 4.2 Implement `mapToOscillator` client-side utility in `web/src/lib/oscillator.ts` — piecewise linear mapping with auto-detect direction (same logic as backend utility).
- [x] 4.3 Implement crosshair sync across 3 panels — bidirectional `subscribeCrosshairMove` + `setCrosshairPosition` with `isSyncingRef` guard to prevent recursive event loops.
- [x] 4.4 Implement ResizeObserver on the 3-panel wrapper for responsive resize handling.
- [x] 4.5 Implement panel maximize/restore per subplot — each panel gets a maximize button; maximized panel takes full height, others collapse to 0 height via CSS class (not DOM removal).

## 5. Threshold Editor

- [x] 5.1 Add inline threshold editor UI to `MetricDetailChart.tsx` — 5 numeric input fields (`t_minus_2` through `t_plus_2`) with labels, plus "Save Config" button.
- [x] 5.2 Implement threshold state management — local state synced with fetched config on mount; price lines on raw metric chart update in real-time via `removePriceLine`/`createPriceLine` on each input change.
- [x] 5.3 Implement oscillator recomputation on threshold change — when any threshold input changes, recompute oscillator data from raw values + new thresholds and update the oscillator series data.
- [x] 5.4 Implement save-to-backend — "Save Config" button calls `saveMetricConfig`, displays success/error toast.

## 6. PNG Export

- [x] 6.1 Create `web/src/lib/exportPng.ts` — utility function that accepts an array of chart container refs, composites their canvas elements onto a single merged canvas with `devicePixelRatio` scaling, draws branding watermark footer, and triggers browser download.
- [x] 6.2 Add "SAVE PNG" button to `ValuationStudio.tsx` header controls — exports current view (composite or detail) using the `exportPng` utility.

## 7. ValuationStudio Integration

- [x] 7.1 Add navigation state to `ValuationStudio.tsx` — `selectedMetric: string | null` state; clicking a table row sets it, closing detail view clears it.
- [x] 7.2 Render `MetricDetailChart` conditionally in `ValuationStudio.tsx` when `selectedMetric` is set — replace the main composite chart area with the 3-panel detail view.
- [x] 7.3 Add "SAVE PNG" button to the Valuation Studio header control bar alongside LOG/LIN toggle.

## 8. Verification & Polish

- [x] 8.1 Verify all chart subplots enforce `rightPriceScale: { minimumWidth: 85 }` — manual visual check that time-ticks align across stacked panels.
- [x] 8.2 Verify crosshair sync works across 3 panels without recursive event loops — hover on each panel and confirm other panels follow.
- [x] 8.3 Verify sparkline rendering for all 17 indicators — confirm no broken SVGs, correct colors per signal direction.
- [x] 8.4 Verify PNG export produces correct output — download and inspect PNG for correct canvas composition, watermark, and high-DPI quality.
- [x] 8.5 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` to confirm data pipeline integrity is unaffected.
- [ ] 8.6 Commit all changes with Conventional Commits format (`feat: ...`).
