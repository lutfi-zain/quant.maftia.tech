## Why

The Valuation Studio in the unified platform was rebuilt from the prior standalone `quant-btc-valuation-system` frontend. While the previous parity change (`2026-07-10-valuation-studio-parity-with-prior-system`) established the structural scaffolding (MetricDetailChart, Sparkline, Threshold Editor, PNG Export, API routes), a systematic component-by-component audit has never been performed. Individual components may have subtle but critical differences in data rendering, crosshair sync behavior, threshold editor flow, sparkline data sources, column accuracy, mobile behavior, export fidelity, and state management. Users migrating from the prior system expect identical visual and analytical fidelity — 1:1 parity must be verified and any gaps closed.

## What Changes

- Conduct a **parallel scouting audit** comparing every component/feature in the unified Valuation Studio against the prior standalone `quant-btc-valuation-system` frontend
- Compare each of the following areas systematically, documenting gaps with severity (Critical/Major/Minor):
  - **Composite Chart (2-Panel)**: BTC candlestick pricing, composite oscillator rendering, reference lines (±1.5, ±1.0, ±2.0), LOG/LIN scale toggle, maximize/restore, crosshair synchronization, time range sync, PNG export watermark & compositing
  - **Metric Detail Chart (3-Panel)**: BTC candlestick pricing, raw metric line with threshold lines, piecewise oscillator rendering, reference lines (±1.0, ±2.0, 0), per-panel maximize/restore, crosshair sync across 3 panels, time range sync, LOG/LIN toggle, PNG export
  - **Threshold Editor**: 5-piecewise threshold inputs (t_minus_2 through t_plus_2), direction detection logic, save-to-backend persistence, real-time oscillator recomputation, real-time price line updates, dirty/unsaved indicator, reset to defaults, success/error feedback
  - **Component Matrix / Metric Grid**: 17 indicator list, category filtering (Fundamental/Technical/Sentiment), sparkline rendering, score display, signal direction display, mobile layout, metric detail navigation on click
  - **Sparklines**: SVG polyline rendering, 90-day data window, hover tooltip with date+value, color coding by signal direction, data source alignment with prior system
  - **PNG Export**: Canvas compositing, devicePixelRatio handling, branding watermark, multi-subplot capture, filename conventions
  - **API Routes & Data Flow**: Metric timeseries endpoint, threshold config GET/POST, data alignment (date intersection), causal filter verification, log scale handling, t_zero handling
  - **State Management & Navigation**: selectedMetric drill-down, back navigation, mobile BottomSheet threshold editor, maximize state preservation
- For each gap found, provide a clear reproduction case and proposed fix
- Produce an **audit report** summarizing all findings, severity levels, and whether each area achieves 1:1 parity or requires remediation

## Capabilities

### New Capabilities

- `valuation-studio-parity-audit`: Systematic component-by-component audit comparing unified Valuation Studio against the prior standalone `quant-btc-valuation-system` frontend. Covers Composite Chart, Metric Detail Chart, Threshold Editor, Component Matrix/Sparklines, PNG Export, API routes, state management, and mobile behavior.

### Modified Capabilities

- *(No existing specs are modified — this is a verification/audit pass)*

## Impact

- **Frontend Components**: `web/src/components/studios/ValuationStudio.tsx`, `MetricDetailChart.tsx`, `Sparkline.tsx`
- **Libraries**: `web/src/lib/oscillator.ts`, `web/src/lib/exportPng.ts`
- **Backend**: `src/api/routes/metrics.ts` (GET/POST metric config, metric timeseries)
- **Prior System Reference**: All files under `/home/ubuntu/projects/quant-btc-valuation-system/frontend/src/components/` (AvivRatioChart, CompositeChart, MetricDetail, MetricGrid, MetricCard, ThresholdEditor, DashboardLayout, Sidebar, AuditPanel)
- **Data**: `unified_component_signals`, `master_ohlcv`, subsystem `metrics.db`
- **Systems Impacted**: Quant BTC Valuation System (primary — 17 indicators, piecewise scoring, composite oscillator, metric detail view, threshold config)

## Non-Goals

- Modifying the prior standalone `quant-btc-valuation-system` frontend
- Adding new quantitative indicators or changing the piecewise linear interpolation algorithm
- Changing the threshold auto-detect direction logic
- Touching `quant-technical-indicator-bank` (deprecated)
- Modifying LTTD, MTTD, or Ichimoku studios
- Adding real-time WebSocket streaming of metric data
- Architectural restructuring of the Valuation Studio beyond fixing identified parity gaps
