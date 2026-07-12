# Track B — Metric Detail Chart (3-Panel) Audit

**Files Compared:**

- Unified: `web/src/components/studios/MetricDetailChart.tsx`
- Prior (AvivRatioChart): `quant-btc-valuation-system/frontend/src/components/AvivRatioChart.tsx`
- Prior (MetricDetail): `quant-btc-valuation-system/frontend/src/components/MetricDetail.tsx`

**Date:** 2026-07-11

---

## Findings

### B.1 3-Panel Layout — Panel Order & Series Types

| Feature | Unified | Prior (AvivRatioChart) | Prior (MetricDetail) |
|---|---|---|---|
| Panel 1 (Top) | BTC Candlestick (`CandlestickSeries`) | BTC Candlestick (`CandlestickSeries`) | BTC Candlestick (`CandlestickSeries`) |
| Panel 2 (Mid) | Raw Metric Line (`LineSeries`, #38BDF8) | Raw Metric Line (`LineSeries`, #f59e0b) | Raw Metric Line (`LineSeries`, #3b82f6) |
| Panel 3 (Bot) | Oscillator Line (`LineSeries`, #A855F7) | Oscillator Line (`LineSeries`, #00e5ff) | Oscillator Area (`AreaSeries`, dynamic color) |
| Panel heights desktop | 220 / 180 / 160 | 300 / 300 / 250 | 220 / 180 / 150 |

**Gap:** Minor — Oscillator series type varies across priors. MetricDetail used `AreaSeries` (with gradient fill based on `valuationToHex` dynamic color). Unified and AvivRatioChart both use `LineSeries`. Colors are also different across all three.

**Severity:** Minor — LineSeries vs AreaSeries is a visual preference. Unified matches AvivRatioChart (the more detailed prior component).

---

### B.2 BTC Data Source

| Aspect | Unified | Prior (AvivRatioChart) | Prior (MetricDetail) |
|---|---|---|---|
| Source | `timeseriesData.btc_ohlc` from `GET /api/v1/quant/metric/:metric_name` (single API response) | Separate `GET /api/metrics/btc_ohlc` endpoint | Receives `btcOhlCData` as prop, fetched by parent |
| Date alignment | SQL INNER JOIN in backend | JavaScript Set intersection client-side | JavaScript Set intersection in component |
| Number of API calls | 1 (metric + config) + 1 (config) | 3 separate calls (metric, config, btc) | N/A (parent-handled) |

**Gap:** Major — Data shape differs. Prior returned `btc_price` as a single number per day in the metric data. Unified returns full OHLC (`open, high, low, close`) from a joined response. This is an improvement (more data), but changes the consumption pattern.

**Severity:** Major — The data is equivalent but sourced differently. The unified approach is cleaner (single API call with date alignment done server-side).

---

### B.3 Raw Metric Threshold Lines

| Aspect | Unified | Prior (AvivRatioChart) | Prior (MetricDetail) |
|---|---|---|---|
| Mechanism | `updateRawPriceLines` helper — dynamic `removePriceLine`/`createPriceLine` on every threshold change | `useEffect` on thresholds with `removePriceLine`/`createPriceLine` via `linesRef` | Static `createPriceLine` at mount only |
| Colors | t-2: #EF4444, t-1: #F87171, t0: #64748B, t+1: #4ADE80, t+2: #22C55E | t-2: #f43f5e, t-1: #fb7185, t0: #555555, t+1: #34d399, t+2: #10b981 | Same as AvivRatioChart |
| Titles | "Peak (T-2)" / "Warning (T-1)" / "Neutral (T-0)" / "Opportunity (T+1)" / "Bottom (T+2)" | "Peak (-2)" / "Distribution (-1)" / "Mid" / "Accumulation (+1)" / "Bottom (+2)" | Same as AvivRatioChart |
| Dynamic updates | ✓ Immediate on keystroke | ✓ Immediate on keystroke | ✗ Only at mount |

**Gap:** Minor — Color hex codes differ slightly but semantic colors are the same (red→green spectrum). Title text differs in format but carries same meaning. Both support dynamic threshold line updates. MetricDetail's static approach is superseded by the dynamic approach in both unified and AvivRatioChart.

**Severity:** Minor — Colors and titles differ slightly but functionally equivalent.

---

### B.4 Oscillator Reference Lines

| Aspect | Unified | Prior (AvivRatioChart) | Prior (MetricDetail) |
|---|---|---|---|
| Lines | 3 lines: +2.0 ("Bottom (+2.00)"), 0 ("Neutral (0.00)"), -2.0 ("Peak (-2.00)") | 3 lines: +2.0 ("Bottom"), 0 (no title), -2.0 ("Peak") | **5 lines**: +2.0 ("Undervalued (+2)"), +1.0, 0, -1.0, -2.0 ("Bubble (-2)") |
| Colors | +2: #22C55E, 0: #64748B, -2: #EF4444 | +2: #10b981, 0: #555555, -2: #f43f5e | Multi-color per prior MetricDetail |

**Gap:** Unified matches AvivRatioChart (3 lines) but MetricDetail had 5 lines (+1.0 and -1.0 intermediate reference lines with axis labels). Users migrating from MetricDetail's richer experience will miss the intermediate reference lines.

**Severity:** Major — Missing +1.0 and -1.0 reference lines that were present in one of the prior implementations. The labels also differ: "Peak (-2.00)" vs "Bubble (-2)" carry different semantic connotations.

---

### B.5 Crosshair Sync Across 3 Panels

| Aspect | Unified | Prior (AvivRatioChart) | Prior (MetricDetail) |
|---|---|---|---|
| Guard | `isSyncingRef` with `requestAnimationFrame` | Plain `isSyncing` boolean | Plain `isSyncing` boolean |
| Value passed | `setCrosshairPosition(0, time, series)` — **always passes 0** | `getCrosshairData(timeStr)` — passes actual data value | `getCrosshairData(timeStr)` — passes actual data value |
| Lookup helper | None — uses constant 0 | `getCrosshairData` looks up from data refs by matching time string | `getCrosshairData` looks up from component state by matching time string |
| Edge case handling | Checks `param.point` and `param.point.x < 0` | Same as unified | Same as unified |

**Critical Gap:** Unified passes `0` as the price value to `setCrosshairPosition(0, param.time, series)` on all 3 panels. This means the horizontal crosshair line will be positioned at y=0 on each panel's price scale, NOT at the actual data value. Both prior implementations correctly passed the actual data value from a lookup helper.

**Severity:** **CRITICAL** — Crosshair horizontal line position is incorrect. Users see the vertical line at the correct time but the horizontal cursor line is always at y=0, which is wrong for:

- BTC panel (price ≠ 0 ever)
- Raw metric panel (metric values are rarely 0)
- Oscillator panel (oscillator values range [-2, +2], 0 is just one position)

**Reproduction:** Hover on any panel → vertical line syncs between panels → horizontal crosshair line is at y=0 on all panels regardless of actual data value at that time point.

---

### B.6 mapToOscillator Comparison

| Aspect | Unified (`lib/oscillator.ts`) | Prior (AvivRatioChart inline) |
|---|---|---|
| Signature | `(rawValue, t_plus_2, t_plus_1, t_minus_1, t_minus_2) → number \| null` | `(rawValue, ThresholdConfig) → number` |
| NaN check | `Number.isNaN()` | `isNaN()` |
| Out-of-range returns | `null` for intermediate ranges | `0.0` for intermediate ranges |
| Null safety | `rawValue === null` → `null` | `rawValue === null` → `NaN` |
| Usage in chart | `oscVal ?? 0.0` coalesces null to 0.0 | Directly returns `number`, no coalesce needed |

**Gap:** Minor — Different signatures but mathematically equivalent. When `is_bottom_only` is true and `rawValue >= t_plus_1` (normal), prior returns `0.0`, unified returns `null`. But the unified's `?? 0.0` coalesces that to `0.0`, making the chart output identical.

**Severity:** Minor — Functionally equivalent for charting purposes.

---

### B.7 LOG/LIN Toggle on BTC Panel Only

| Aspect | Unified | Prior (AvivRatioChart) | Prior (MetricDetail) |
|---|---|---|---|
| Applies to | BTC panel only | BTC panel only | BTC panel only |
| Mechanism | `useEffect` on `isLogScale` → `btc.priceScale("right").applyOptions({ mode })` | `useEffect` on `isLogScale` → same API | mode set at chart creation in main effect |
| Toggle UI | LOG/LIN toggle group in header | LOG/LIN button inside BTC panel | LOG/LIN button in header actions |

**Gap:** None — All three apply LOG/LIN to BTC panel only. The toggle is in the header for unified, inside the panel for AvivRatioChart. This is a layout difference, not a behavior difference.

**Severity:** None — ✓ PARITY

---

### B.8 Per-Panel Maximize (New Feature)

| Aspect | Unified | Prior (AvivRatioChart) | Prior (MetricDetail) |
|---|---|---|---|
| Per-panel maximize | ✓ — Each of 3 panels has a maximize button. Maximized → 500px, others → 0px with CSS class | ✗ — No per-panel maximize | ✗ — No per-panel maximize |
| Maximized state | `maximizedPanel: "btc" | "raw" | "osc" | null` | N/A | N/A |
| Restore button | ✓ — "Restore subplots" button appears when maximized | N/A | N/A |

**Gap:** Documented as NEW capability — Unified adds per-panel maximize which was not present in either prior component.

**Severity:** N/A — This is an enhancement, not a regression.

---

### B.9 Y-Axis Width: 85px vs 90px

| Aspect | Unified | Prior (AvivRatioChart) | Prior (MetricDetail) |
|---|---|---|---|
| Y-axis width | 85px (from CSS variable `--chart-yaxis-width`, fallback 85) | 90px (hardcoded `minimumWidth: 90`) | 90px (hardcoded `minimumWidth: 90`) |

**Gap:** Minor — Difference is intentional per AGENTS.md requirement: all subplots in the unified platform must enforce 85px lock. The prior standalone system used 90px.

**Severity:** Minor — Intentional design difference.

---

## Summary

| # | Check | Severity | Status |
|---|---|---|---|
| B.1 | 3-panel layout & series types | Minor | ⚠️ Oscillator type varies (Line vs Area) |
| B.2 | BTC data source | Major | ℹ️ Different but functionally equivalent |
| B.3 | Raw metric threshold lines | Minor | ⚠️ Colors/titles differ slightly |
| B.4 | Oscillator reference lines | Major | ⚠️ Missing +1.0 and -1.0 ref lines (vs MetricDetail) |
| B.5 | Crosshair sync | **CRITICAL** | ❌ **Always passes 0, never actual data value** |
| B.6 | mapToOscillator | Minor | ⚠️ Different signature, same output |
| B.7 | LOG/LIN toggle | None | ✓ Parity |
| B.8 | Per-panel maximize | N/A | ✓ New capability |
| B.9 | Y-axis width (85 vs 90) | Minor | ℹ️ Intentional difference |