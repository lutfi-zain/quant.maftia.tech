## 1. Parallel Scouting — 8 Audit Tracks

Each audit track is independent. Run all 8 in parallel sessions, each producing a focused gap report section.

### Track A: Composite Chart (2-Panel) Audit

- [x] 1.A.1 Compare BTC candlestick rendering in `ValuationStudio.tsx` (lines 240-254) vs prior `CompositeChart.tsx` — verify candlestick colors, price format, up/down colors match or document difference
- [x] 1.A.2 Compare valuation composite area rendering — unified uses `AreaSeries` with `rgba(96,165,250,0.35)` → `rgba(96,165,250,0.02)` vs prior `rgba(59,130,246,0.2)` → `rgba(59,130,246,0.0)` — document any intended difference
- [x] 1.A.3 Verify reference lines: unified creates price lines at `+1.50` and `-1.00` only — prior had `+2.0`, `+1.0`, `0`, `-1.0`, `-2.0` — document missing +2.0, +1.0, -2.0 line gap
- [x] 1.A.4 Verify crosshair sync implementation matches prior — compare `isSyncingRef` guard, `subscribeCrosshairMove` callback, `setCrosshairPosition` for 2 panels
- [x] 1.A.5 Verify time range sync via `subscribeVisibleLogicalRangeChange` matches prior pattern
- [x] 1.A.6 Compare maximize behavior: unified uses CSS class hide with height=0 vs prior body overflow hidden — verify both prevent chart drift
- [x] 1.A.7 Compare LOG/LIN toggle: unified applies to `priceScale("right").applyOptions({ mode })` — prior same pattern on BTC chart only — verify parity
- [x] 1.A.8 Verify Y-axis width lock enforced at 85px on both panels — prior used 90px hardcoded — document width difference

### Track B: Metric Detail Chart (3-Panel) Audit

- [x] 1.B.1 Compare 3-panel layout in `MetricDetailChart.tsx` vs prior `AvivRatioChart.tsx` + `MetricDetail.tsx` — verify panel order, series types (Candlestick/Line/Line vs Candlestick/Line/Area)
- [x] 1.B.2 Compare BTC data source: unified uses `timeseriesData.btc_ohlc` from single API response vs prior used separate `/api/metrics/btc_ohlc` endpoint — verify data alignment quality
- [x] 1.B.3 Compare raw metric threshold lines: unified uses `updateRawPriceLines` helper with dynamic `removePriceLine`/`createPriceLine` vs prior static `createPriceLine` at mount — verify both show correct line colors
- [x] 1.B.4 Compare oscillator reference lines: unified creates 3 lines (`+2.0`, `0`, `-2.0`) vs prior created 5 lines (`+2.0`, `+1.0`, `0`, `-1.0`, `-2.0`) — document missing +1.0, -1.0 gap
- [x] 1.B.5 Verify crosshair sync across 3 panels — compare `isSyncingRef` guard pattern, ensure all 3 panels are bidirectionally synced
- [x] 1.B.6 Compare `mapToOscillator` usage: unified imports from `../../lib/oscillator` with specific signature vs prior embedded inline `mapToOscillator` — verify both produce same oscillator values
- [x] 1.B.7 Compare LOG/LIN toggle in detail view: verify it applies to BTC panel only (consistent with prior)
- [x] 1.B.8 Compare per-panel maximize: unified introduces this as new feature not present in prior — document as NEW capability
- [x] 1.B.9 Verify 85px Y-axis width lock on all 3 panels — prior used 90px — document width difference

### Track C: Threshold Editor Audit

- [x] 1.C.1 Compare 5 threshold inputs in `MetricDetailChart.tsx` vs prior `ThresholdEditor.tsx` — verify labels, colors, step sizes match (Peak=red, Warning=light red, Neutral=gray, Opportunity=light green, Bottom=green)
- [x] 1.C.2 Verify direction detection logic: both use `t_plus_2 > t_minus_2` inverted detection — compare badge display — prior shows "DIR: NORMAL" or "DIR: INVERTED" — unified does not show direction badge
- [x] 1.C.3 Verify dirty/unsaved indicator: prior had `* UNSAVED CHANGES` with pulse animation — unified has no equivalent dirty indicator — document gap
- [x] 1.C.4 Verify real-time oscillator recomputation: unified recalculates on every keystroke via `handleThresholdChange` — prior used separate `useEffect` on thresholds — verify both update immediately
- [x] 1.C.5 Compare save-to-backend flow: unified calls `saveMetricConfig` only — prior called `saveMetricConfig` THEN `renormalizeMetric` — verify whether renormalization is still needed
- [x] 1.C.6 Compare reset-to-defaults: unified has no reset button — prior had `handleReset` fetching defaults from `/api/metrics/config/defaults` — document missing reset functionality
- [x] 1.C.7 Compare save feedback: unified uses inline toast with 3-4s auto-dismiss — prior used colored banner with persistent success/error messages — document difference
- [x] 1.C.8 Verify threshold editor layout: desktop = inline sidebar, mobile = BottomSheet — prior was always below charts — document layout difference

### Track D: Component Matrix & Metric Grid Audit

- [x] 1.D.1 Verify all 17 indicators in `INDICATOR_METADATA` exist with correct names matching prior system's metrics list — cross-reference each by name/category
- [x] 1.D.2 Verify category assignment: unified has Fundamental/Technical/Sentiment — prior had fundamental/technical/sentiment — verify each indicator's category matches
- [x] 1.D.3 **CRITICAL**: Compare score mapping — unified displays `normalized_score * 2` to produce [-2.0, +2.0] range — prior displayed `normalized_value` directly as already in [-2.0, +2.0] — verify whether double-scaling is occurring
- [x] 1.D.4 Compare signal direction display: unified shows OVERVALUED (+1) / DISCOUNT (-1) / NEUTRAL (0) — prior showed "UNDERVALUED (BUY)" / "OVERVALUED (SELL)" / "NEUTRAL" — document terminology difference
- [x] 1.D.5 Compare category filtering: unified uses filter buttons (All/Fundamental/Technical/Sentiment) — prior used section-based layout with headers — document as architectural difference
- [x] 1.D.6 Verify mobile compact list layout renders correctly
- [x] 1.D.7 Verify metric detail navigation on row click sets `selectedMetric` correctly

### Track E: Sparkline Audit

- [x] 1.E.1 Compare 90-day data window: unified uses `sortedHistory.slice(-90)` from component signals — prior fetched per-metric sparkline data from metric timeseries API — verify data source produces equivalent values
- [x] 1.E.2 Compare color coding: unified colors by `signal_direction` (green for discount, red for overvalued, gray for neutral) — prior colored by `valuationToHex(metric.normalized_value)` (HSL gradient from green to red) — document fundamental difference
- [x] 1.E.3 Verify SVG polyline rendering: unified uses `<polyline>` with viewBox=0,0,width,height — prior used Recharts `<AreaChart>` with gradient fill — document technology difference
- [x] 1.E.4 Verify hover tooltip functionality: unified uses custom SVG onMouseMove/onMouseLeave with nearest-point detection — document as NEW interaction not present in prior
- [x] 1.E.5 Verify no broken SVGs or rendering errors for all 17 indicators

### Track F: PNG Export Audit

- [x] 1.F.1 Compare canvas compositing in `exportChartsToPng.ts` vs prior `CompositeChart.exportToPng()` — verify `getBoundingClientRect` positioning of subplot canvases
- [x] 1.F.2 Verify `devicePixelRatio` scaling is applied correctly for high-DPI output
- [x] 1.F.3 Compare watermark text: unified = "QUANT UNIFIED PLATFORM // VALUATION" — prior = "QUANT BTC VALUATION SYSTEM // MASTER.COMPOSITE.OSCILLATOR" — verify intentional brand change
- [x] 1.F.4 Compare filename: unified = `btc-valuation-YYYY-MM-DD.png` — prior = `btc-composite-oscillator-YYYY-MM-DD.png` — verify naming difference
- [x] 1.F.5 Verify export captures all visible subplots (not hidden/collapsed panels)
- [x] 1.F.6 Verify export works from both composite view and metric detail view

### Track G: API Routes & Data Audit

- [x] 1.G.1 Compare metric timeseries endpoint: unified `GET /api/v1/quant/metric/:metric_name` vs prior `GET /api/metrics/:name` — verify both return same data shape
- [x] 1.G.2 Verify date intersection logic: unified uses SQL INNER JOIN by date — prior used JavaScript Set-based intersection — verify both produce same date-aligned output
- [x] 1.G.3 Compare config endpoint: unified `GET /api/v1/quant/metric/:metric_name/config` — verify thresholds match prior's `metric_config` data
- [x] 1.G.4 Compare config save endpoint: unified `POST /api/v1/quant/metric/:metric_name/config` uses `INSERT OR REPLACE` — verify WAL mode and parameterized SQL
- [x] 1.G.5 Verify `DEFAULT_THRESHOLDS` in backend matches prior system's seed config — cross-reference all 17 indicators
- [x] 1.G.6 Verify causal filter verification in data responses (t-1 stamp check)

### Track H: State Management & Navigation Audit

- [x] 1.H.1 Compare metric selection flow: unified `selectedMetric` state vs prior `activeMetric` — verify both clear on close/back
- [x] 1.H.2 Verify loading state: unified shows spinner animation — prior had skeleton loaders — document difference
- [x] 1.H.3 Verify error state handling: prior had retry button and error panel — verify unified has equivalent
- [x] 1.H.4 Compare mobile BottomSheet threshold editor renders correctly
- [x] 1.H.5 Verify maximize state (fullscreen mode) works correctly on mobile and desktop
- [x] 1.H.6 Verify hoveredPoint crosshair data display updates correctly

## 2. Consolidate Audit Report

- [x] 2.1 Merge all 8 track findings into a single `audit-report.md` in the change root with executive summary, gap severity table, and per-domain detailed findings
- [x] 2.2 For each Critical gap found, implement a hotfix inline
- [x] 2.3 Verify hotfixes compile and pass TypeScript checks (`cd web && npx tsc --noEmit`)
- [x] 2.4 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` to confirm data pipeline integrity is unaffected
- [x] 2.5 Run `openspec status --change valuation-studio-complete-parity-audit` to confirm all artifacts complete

## 3. Finalize

- [x] 3.1 Review report with user — confirm Critical/Major/Minor gap assessments
- [x] 3.2 If requested, implement Major gap fixes
- [x] 3.3 Commit all changes with Conventional Commits format (`quant:`, `feat:`, `fix:`)
