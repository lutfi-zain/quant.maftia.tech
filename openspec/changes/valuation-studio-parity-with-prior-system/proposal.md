## Why

The current Valuation Studio in the unified system only shows the Master Composite Oscillator (2 subplots: BTC Candlestick + Valuation Composite). The prior standalone `quant-btc-valuation-system` had richer charting capabilities including individual metric detail views with 3-panel layouts (BTC OHLC + Raw Metric + Oscillator), interactive threshold editors, metric sparklines, PNG export, and a navigation sidebar. Users migrating to the unified platform are losing visibility into the per-indicator details that were critical for understanding valuation signals.

## What Changes

- Add **Metric Detail Chart View** — a 3-panel Lightweight Charts layout (BTC OHLC Candlestick, Raw Metric Line with configurable threshold lines, Oscillator Line with ±2 reference lines) that opens when a user clicks a metric card in the component matrix
- Add **Threshold Editor** — inline controls on the Raw Metric panel allowing users to adjust the 5 piecewise threshold values (`t_minus_2`, `t_minus_1`, `t_zero`, `t_plus_1`, `t_plus_2`) and see the Oscillator recalculate in real-time, persisted via `POST /api/metrics/config`
- Add **Metric Sparkline Cards** — small inline sparkline charts (last 90 data points) rendered inside each row of the component breakdown table for at-a-glance trend visibility
- Add **PNG Export** — a "SAVE PNG" button that merges all subplot canvases into a single downloadable PNG with system branding watermark
- Enhance **Crosshair Synchronization** — extend the existing crosshair sync to support 3-panel mode when the metric detail view is active, keeping time alignment across all subplots
- Add **Panel Maximize/Restore per subplot** — each of the 3 subplots (BTC, Raw Metric, Oscillator) gets an individual maximize button in addition to the existing chart-level maximize

## Capabilities

### New Capabilities

- `metric-detail-chart`: 3-panel chart view for individual valuation metrics with BTC OHLC, raw metric line, oscillator line, threshold editor, and crosshair sync
- `metric-sparklines`: Inline sparkline charts rendered in the component matrix table rows for trend visibility
- `chart-png-export`: Export merged multi-subplot chart canvases to a single branded PNG file

### Modified Capabilities

- `valuation-studio`: Extend existing Valuation Studio to include metric detail navigation, sparkline cards, and PNG export controls

## Impact

- **Frontend Components**: `ValuationStudio.tsx` — add metric detail view toggle, sparkline rendering, export button; new `MetricDetailChart.tsx` component for the 3-panel layout
- **API Endpoints**: `GET /api/metrics/{metric_name}` (timeseries data), `GET /api/metrics/config/{metric_name}` (threshold config), `POST /api/metrics/config` (save thresholds) — must exist in the Hono API Gateway on `:8765`
- **Database**: `unified_component_signals` table provides per-indicator normalized scores; `unified_daily_analytics` provides daily composite + per-system values; subsystem `.db` files store raw metric timeseries
- **Dependencies**: Lightweight Charts v5.2 (already installed), no new npm packages needed
- **Systems Impacted**: Quant BTC Valuation System (primary — all 17 indicators and their piecewise scoring)

## Non-Goals

- Modifying the standalone `quant-btc-valuation-system` frontend — it is being superseded by the unified platform
- Adding new quantitative indicators or changing the piecewise linear interpolation algorithm
- Touching `quant-technical-indicator-bank` — explicitly deprecated and removed
- Modifying the LTTD, MTTD, or Ichimoku systems — this change is scoped to Valuation only
- Real-time WebSocket streaming of metric data — historical fetch is sufficient for this phase
