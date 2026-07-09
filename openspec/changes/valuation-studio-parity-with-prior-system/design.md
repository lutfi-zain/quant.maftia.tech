## Context

The Valuation Studio in the unified platform currently renders a 2-panel chart (BTC Candlestick + Valuation Composite area chart) alongside a component breakdown table. The prior standalone `quant-btc-valuation-system` provided a richer experience:

- **3-panel metric detail view**: BTC OHLC candlestick, raw metric line chart with configurable threshold lines, and oscillator line chart — all with crosshair sync
- **Inline threshold editor**: 5 piecewise threshold inputs (`t_minus_2` through `t_plus_2`) that recalculate the oscillator in real-time and persist to the backend
- **Metric sparklines**: 90-day mini-charts embedded in each metric card for at-a-glance trend detection
- **PNG export**: Merged multi-subplot canvas export with system branding

The unified platform's `ValuationStudio.tsx` has the 2-panel chart and component table but is missing the individual metric drill-down, sparklines, threshold editor, and export functionality. API routes for fetching per-metric timeseries data (`GET /api/v1/analytics/components?system=quant-btc-valuation-system`) already exist. New routes for per-metric raw timeseries and threshold config read/write need to be added to the Hono API Gateway.

## Goals / Non-Goals

**Goals:**

- Add a 3-panel metric detail chart view (BTC OHLC + Raw Metric + Oscillator) with 85px right Y-axis lock and crosshair sync
- Add an inline threshold editor with save-to-backend persistence
- Add 90-day sparkline mini-charts in the component table rows
- Add PNG export of the current chart state
- Ensure all chart subplots enforce `rightPriceScale: { minimumWidth: 85 }` and vertical crosshair sync per the executive terminal spec

**Non-Goals:**

- Modifying the standalone `quant-btc-valuation-system` frontend
- Adding new quantitative indicators or changing piecewise interpolation algorithms
- Touching `quant-technical-indicator-bank` (deprecated)
- Real-time WebSocket streaming of metric data
- Modifying LTTD, MTTD, or Ichimoku studios

## Decisions

### 1. Component Architecture: New `MetricDetailChart` component extracted from `ValuationStudio.tsx`

**Decision**: Create a dedicated `MetricDetailChart.tsx` component that encapsulates the 3-panel chart view, threshold editor, and export logic. `ValuationStudio.tsx` orchestrates visibility between the main composite view and the detail view.

**Rationale**: Keeps `ValuationStudio.tsx` as the layout orchestrator (consistent with other studios) while isolating the complex 3-panel chart logic. The prior system had `AvivRatioChart.tsx` as a standalone component — same pattern.

**Alternatives considered**: Inline the 3-panel logic directly into `ValuationStudio.tsx` — rejected due to the component already being 400+ lines and the 3-panel chart having its own complex lifecycle (threshold state, 3 chart instances, crosshair sync).

### 2. Data Flow: Fetch per-metric timeseries from new API route, compute oscillator client-side

**Decision**: Add `GET /api/v1/analytics/metric/{metric_name}` route returning raw metric timeseries + BTC OHLC, and `GET /api/v1/analytics/metric/{metric_name}/config` + `POST /api/v1/analytics/metric/{metric_name}/config` for threshold persistence. Oscillator computation (`mapToOscillator`) runs client-side.

**Rationale**: The prior system computed the oscillator client-side from raw values + thresholds. This avoids backend changes to the quant engines and keeps the threshold editor interactive without round-trips for each adjustment.

**Alternatives considered**: Compute oscillator server-side — rejected because the threshold editor needs sub-100ms recalculation on input change, and the piecewise mapping is simple enough for client-side.

### 3. Sparklines: Lightweight SVG path rendering (no chart library)

**Decision**: Render sparklines as simple SVG `<polyline>` elements from the 90-day data window. No Lightweight Charts instance per row.

**Rationale**: 17 sparkline instances as full Lightweight Charts would be heavy on initial render. SVG polylines are ~2KB each and render instantly. The prior system used the same approach in its `MetricGrid`.

### 4. PNG Export: Canvas compositing with `devicePixelRatio` scaling

**Decision**: Iterate over all chart canvas elements in the detail view, draw them onto a merged canvas with `devicePixelRatio` scaling, add branding watermark, and trigger download. Same approach as the prior system's `CompositeChart.exportToPng()`.

**Rationale**: Lightweight Charts exposes canvas elements that can be composited. This is the only reliable way to get a single PNG from multiple chart instances.

### 5. Right Y-Axis Lock: Enforced at 85px across all new subplots

**Decision**: All new chart instances (Raw Metric panel, Oscillator panel) MUST set `rightPriceScale: { minimumWidth: 85 }`. The existing 2-panel chart already enforces this.

**Rationale**: Per the executive terminal spec, 85px lock is mandatory for horizontal time-tick alignment across stacked subplots.

## Risks / Trade-offs

- **[Risk] Performance with 3 chart instances** → Lightweight Charts v5.2 handles 3 instances well. The prior system ran 3 charts simultaneously without issues. Monitor initial render time; lazy-init the detail view only when a metric is selected.

- **[Risk] Threshold editor state sync** → Local state for thresholds could diverge from backend if save fails silently. Mitigation: show save status indicator, auto-retry on failure, and re-fetch config on detail view mount.

- **[Risk] Sparkline SVG performance with 17 rows** → 17 inline SVGs could cause reflow on scroll. Mitigation: use `will-change: transform` on sparkline containers and virtualize the table if needed.

- **[Trade-off] Client-side oscillator computation** → Adds ~50ms of computation per threshold change. Acceptable for interactivity; the piecewise mapping is O(n) over ~2000 data points.
