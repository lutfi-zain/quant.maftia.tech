# Track H — State Management & Navigation Audit: Unified vs Prior System

## Files Compared

- **Unified**: `web/src/components/studios/ValuationStudio.tsx`, `MetricDetailChart.tsx`, `context/TerminalContext.tsx`
- **Prior**: `frontend/src/components/DashboardLayout.tsx`, `Sidebar.tsx`, `CompositeChart.tsx`, `MetricDetail.tsx`

---

## Findings

### H1. Metric Selection Flow — Minor Gap

**Status**: Working, minor structural difference

| Aspect | Unified | Prior System |
|--------|---------|-------------|
| State name | `selectedMetric: string \| null` | `activeMetric: string \| null` |
| Location | In `ValuationStudio.tsx` directly | In `DashboardLayout.tsx` (orchestrator) |
| On close | `onClose={() => setSelectedMetric(null)}` | `handleCloseDetail()` sets `activeMetric=null` + clears `detailData` |
| Conditional render | `{selectedMetric ? <MetricDetailChart ... /> : <main composite view>}` | `{activeMetric && activeSummary && <MetricDetail ... />}` rendered alongside other elements |
| Data passing | MetricDetailChart fetches own data via `Promise.all([getMetricTimeseries, getMetricConfig])` | DashboardLayout fetches detail data, passes as props to MetricDetail |
| Sidebar navigation | No sidebar — uses component matrix table | Has full Sidebar with category expand/collapse, metric nav items, dashboard/audit navigation |

**Gap**: Unified does not clear detail data on close (no `setDetailData([])` equivalent — MetricDetailChart unmounts so this is fine). Key difference: prior system had a sidebar navigation with **dashboard** and **audit** pseudo-routes. Unified lacks sidebar and audit panel entirely.

**Severity**: Minor — different architecture, same user outcome.

---

### H2. Loading State — Major Gap

| Aspect | Unified | Prior System |
|--------|---------|-------------|
| Composite initial load | No loading state in ValuationStudio. `dailyData` comes from TerminalContext; ValuationStudio renders immediately with empty data if not loaded. Charts init effect checks `!dailyData.length` and returns early without rendering. | Has explicit `loading` state. Renders full-screen "INITIALIZING.BTC.VALUATION.ENGINE..." spinner until all 4 parallel fetches complete. |
| Components fetch | Has `loading` state from `getComponents`, sets to false on success/error. But this only controls component matrix, not charts. | N/A — components/metrics loaded together. |
| Metric detail loading | MetricDetailChart has its own `loading` state showing "FETCHING METRIC CYCLE HISTORY..." with animated Sparkles. | Has `detailLoading` state propagated from parent, renders "LOADING.DETAILED.METRIC.ANALYSIS..." skeleton loader. |
| Chart initialization | Charts init only after data loaded, but there's a brief flash of empty container before charts mount. | Similar — charts init only after data available. |

**Gap**: **Unified has no loading state for the composite charts during initial TerminalContext load.** The 2-panel chart init effect has `!dailyData.length` early return, but there's no visual loading indicator shown during this period. Users see an empty chart area with header info already rendered (because header derives `latestValScore` from `displayPoint` which falls through to `dailyData[0]` or null). When `dailyData` is empty, `latestValScore = 0` so the user sees "FAIR MARKET CYCLE ZONE" with score `0.0000` — a false neutral signal.

**Severity**: Major — misleading UI state during initial load.

---

### H3. Error State Handling — Major Gap

| Aspect | Unified | Prior System |
|--------|---------|-------------|
| Error state variable | No error state in ValuationStudio. `useTerminal()` provides `error` but **not consumed** by ValuationStudio. | Has explicit `error` state. Renders "SYSTEM.INIT_FAILURE" panel with error message and `RETRY_INITIALIZATION` button calling `loadDashboardData()`. |
| Components fetch error | `.catch()` sets loading false, logs to console. No error UI. | N/A |
| Metric detail error | No error state — `.catch()` sets loading false, logs. MetricDetailChart renders nothing. | Has separate "FAILED_TO_LOAD_METRIC_HISTORY" error UI with CLOSE button. |
| Retry capability | No retry. `useTerminal().refreshData()` is available but ValuationStudio never calls it. | Retry button calls `loadDashboardData()` which re-fetches everything. |

**Gap**: **Unified has no error state handling.** If the API fails, users see an empty page with no error message, no retry button, and no indication that something went wrong. The TerminalContext does have error state, but ValuationStudio doesn't use it.

**Severity**: Major — users get no feedback on failures.

---

### H4. Mobile BottomSheet Threshold Editor — Working

| Aspect | Unified | Prior System |
|--------|---------|-------------|
| Mobile layout | Threshold editor in `BottomSheet` triggered by "THRESHOLDS" button | Threshold editor always visible below charts (no mobile adaptation) |
| State management | `sheetOpen: boolean` state passed to BottomSheet | No BottomSheet — rendered unconditionally |
| Desktop layout | Inline sidebar (280px grid) | Below charts with border-top separator |

**Verdict**: Unified improves on prior system with responsive BottomSheet. Not a gap — enhancement.

**Severity**: None — enhancement over prior.

---

### H5. Maximize Fullscreen Mode — Minor Gap

| Aspect | Unified | Prior System |
|--------|---------|-------------|
| State variable | `maximized: MaximizedPanel` (null \| "btc" \| "val") | `isMaximized: boolean` (only in CompositeChart) |
| Mechanism | CSS class `chart-fullscreen-active` on root, `fullscreen` on chart panel, resize charts | `document.body.style.overflow = 'hidden'`, CSS class `maximized` on chart card |
| Per-panel maximize | Yes — BTC pane and Valuation pane individually | No — only chart-level maximize toggle |
| Detail view maximize | Yes — per-panel maximize for 3 panels (btc/raw/osc) | No — no per-panel maximize in detail view |
| Behavior on maximize | Resize charts to full viewport height, collapse other panel | Toggle chart card to full viewport with body overflow hidden |

**Gap**: Unified has richer maximize (per-panel), prior had only chart-level. Different implementation (CSS classes vs body overflow). Both achieve similar results for the composite view.

**Severity**: Minor — different implementation, richer in unified.

---

### H6. HoveredPoint Crosshair Data Display — Minor Gap

| Aspect | Unified | Prior System |
|--------|---------|-------------|
| State | `hoveredPoint` set on crosshair move via `setHoveredPoint(dailyData.find(...))` in composite chart callback | No hoveredPoint state exposed to header. CompositeChart's crosshair sync was internal only. |
| Display | Shows `latestValScore` from `displayPoint` (hovered or latest) in header info bar — composite score with color coding and bubble/discount/neutral badge | Prior header didn't update on crosshair hover — only showed latest score statically |
| Detail view | MetricDetailChart doesn't expose hovered point to ValuationStudio header (it's rendered separately) | Same — detail view had its own header |

**Gap**: Unified adds live crosshair data display in the header bar — improvement over prior. No gap detected for this feature.

**Verdict**: Enhancement over prior.

**Severity**: None — enhancement over prior.

---

### H7. Parallel Data Fetching — Architectural Difference

| Aspect | Unified | Prior System |
|--------|---------|-------------|
| Composite data | `TerminalContext` fetches `getDailyAnalytics(5000)` + `getCircuitBreakers()` via `Promise.all`. Separate from ValuationStudio. | `DashboardLayout` directly fetches `fetchMetrics()`, `fetchComposite()`, `fetchMetricConfigs()`, `fetchBtcOhlc()` via `Promise.all`. |
| Components data | ValuationStudio fetches `getComponents("quant-btc-valuation-system")` in its own `useEffect`. Not parallel with dailyData. | Metrics (components) fetched as part of `loadDashboardData` parallel batch. |
| Sparkline data | Computed from already-loaded component signals (`.slice(-90)` from `components` array). No extra fetches. | Fetched per-metric sparkline data via `fetchMetricData(m.name)` — 17 additional parallel fetches via `Promise.all(sparklinePromises)`. |
| Metric detail data | Fetched on-demand via `Promise.all([getMetricTimeseries, getMetricConfig])` in MetricDetailChart. | Fetched on-demand via `fetchMetricData(name)` in DashboardLayout, passed as props. |
| Threshold config | Fetched on-demand via `getMetricConfig` in detail view. | Fetched for all metrics upfront in `loadDashboardData` (`fetchMetricConfigs()`). |

**Gap**: Unified's approach is more efficient (no 17 extra sparkline fetches, no upfront config fetch). However, this means the detail view does 2 fetches on every open (timeseries + config) while prior had config pre-loaded.

**Severity**: Minor — architectural improvement with trade-off.

---

## Summary of Findings

| ID | Finding | Severity | Description |
|----|---------|----------|-------------|
| H1 | Metric selection flow | Minor | Unified lacks sidebar navigation and audit panel but core flow works |
| H2 | **Loading state missing for composite charts** | **Major** | No loading indicator during initial TerminalContext data load; shows false `0.0000` score |
| H3 | **Error state handling missing** | **Major** | No error UI, no retry button, no error message display |
| H4 | Mobile BottomSheet | None | Enhancement over prior |
| H5 | Maximize fullscreen | Minor | Richer per-panel maximize in unified |
| H6 | Crosshair data display | None | Enhancement over prior |
| H7 | Parallel fetching | Minor | Architectural improvement with trade-off |

**Critical gaps: 0**
**Major gaps: 2** (H2, H3)
**Minor gaps: 2** (H1, H5)

---

## Recommendations

### Hotfix H2: Add composite chart loading state

In `ValuationStudio.tsx`, add a check for `dailyData.length === 0` (from TerminalContext) and render a loading indicator during the initial load phase to prevent the false `0.0000` display.

### Hotfix H3: Add error state display

In `ValuationStudio.tsx`, consume the `error` from `useTerminal()` and render an error panel with retry button when `error` is non-null. Also add error UI for `components` fetch failure.
