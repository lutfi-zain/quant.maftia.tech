# Track A — Composite Chart (2-Panel) Audit Report

## Files Compared

| System | File | Lines |
|--------|------|-------|
| **Unified** | `/home/ubuntu/projects/quant.maftia.tech/web/src/components/studios/ValuationStudio.tsx` | 923 total, chart init ~240-320 |
| **Prior** | `/home/ubuntu/projects/quant-btc-valuation-system/frontend/src/components/CompositeChart.tsx` | ~200 total, chart init ~45-150 |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Major | 5 |
| Minor | 4 |
| Total | 9 |

---

## Detailed Findings

### A.1 BTC Chart Series Type — MAJOR

| Field | Detail |
|-------|--------|
| **Component** | BTC price subplot series type |
| **Unified** | `CandlestickSeries` — shows 4-price OHLC candles with up/down colors |
| **Prior** | `AreaSeries` — shows a single area fill price line with `#ededed` line color |
| **Expected** | `AreaSeries` (matching prior) or intentional upgrade to candlesticks |
| **Gap** | **FUNDAMENTAL VISUAL DIFFERENCE.** Unified shows candlesticks (bullish: `#22C55E`, bearish: `#EF4444`). Prior shows an area price line (unfilled, `#ededed`). This is a 1:1 parity miss — the composite chart in the prior system was a price **line**, not candlesticks. However, candlesticks may be an **intentional improvement** for the unified system since the BTC/USD trading pair is better represented as OHLC candles. |
| **Impact** | Users migrating from prior system will see a very different BTC price representation. The candlestick rendering provides more information (open/high/low/close per day) which is arguably better for analysis. |
| **Recommendation** | Document as intentional upgrade. Not a bug, but flag in migration guide. |

### A.2 BTC Price Data Source — MAJOR

| Field | Detail |
|-------|--------|
| **Component** | BTC price data source |
| **Unified** | `dailyData` from `useTerminal()` context (fetched via `GET /api/v1/quant/daily`), which includes `open`, `high`, `low`, `close` from `MasterOHLCV` |
| **Prior** | `data` prop of type `CompositeDataPoint[]` which has `btc_price: number` (single price value, not OHLC) |
| **Gap** | Prior only had close price; unified has full OHLC. Tied to A.1 — candlestick rendering requires OHLC data. |
| **Recommendation** | Document as intentional improvement. |

### A.3 Valuation Composite Area Colors — MINOR

| Field | Detail |
|-------|--------|
| **Component** | Composite oscillator area fill |
| **Unified** | `topColor: rgba(96,165,250,0.35)`, `bottomColor: rgba(96,165,250,0.02)`, `lineColor: #60A5FA` |
| **Prior** | `topColor: rgba(59, 130, 246, 0.2)`, `bottomColor: rgba(59, 130, 246, 0.0)`, `lineColor: #3b82f6` |
| **Gap** | Unified uses slightly different blue (`#60A5FA` vs `#3b82f6`) and higher top opacity (0.35 vs 0.2). Both are in the blue family. No data fidelity impact. |
| **Recommendation** | Acceptable — brand color evolution. |

### A.4 Reference Lines — MAJOR

| Field | Detail |
|-------|--------|
| **Component** | Reference/price lines on the oscillator panel |
| **Unified** | 2 lines: `+1.50` (red, "Bubble +1.50"), `-1.00` (green, "Discount -1.00") |
| **Prior** | 5 lines: `+2.0` (green, "Undervalued (+2)"), `+1.0` (green, no title), `0` (gray, no title), `-1.0` (red, no title), `-2.0` (red, "Bubble (-2)") |
| **Gap** | **3 MISSING REFERENCE LINES.** Unified lacks: `+2.0`, `0`, `-2.0`. The ±2.0 lines are important because the oscillator range is `[-2.0, +2.0]` — without them users can't see when the oscillator hits the boundary. The center line (`0`) provides a visual neutral reference. |
| **Impact** | Users lose visual reference for cycle extremes (±2.0) and neutral midpoint (0). The unified only shows the circuit breaker thresholds (1.5, -1.0) which are warning levels but not the full range boundaries. |
| **Reproduction** | Render Valuation Studio composite view — only 2 dashed lines appear on the oscillator panel instead of 5. |
| **Recommendation** | **HOTFIX NEEDED.** Add 3 missing reference lines: `+2.0` boundary, `0` center, `-2.0` boundary. |

### A.5 Crosshair Sync — MAJOR

| Field | Detail |
|-------|--------|
| **Component** | Crosshair synchronization between panels |
| **Unified** | Uses `isSyncingRef` boolean guard with `requestAnimationFrame` debounce. Sets crosshair position to `0` on other charts: `c.setCrosshairPosition(0, param.time, s)` — **arbitrary Y=0 value** |
| **Prior** | Uses `alignedData.find(d => d.date.substring(0,10) === param.time)` to get the **actual data value** for that time point, then sets crosshair to that value: `chartOsc.setCrosshairPosition(item.composite_value, param.time, oscSeries)`. |
| **Gap** | **Crosshair Y position is wrong on synced panels.** Unified always sets Y=0 on the other panel instead of the actual data value at that time. This means crosshair on the valuation panel will always show at Y=0, and crosshair on the BTC panel will also show at Y=0, rather than tracking the actual price/composite value for the hovered time. |
| **Impact** | Users hovering on one panel won't see the crosshair line tracking the actual data curve on the other panel. The crosshair will float at Y=0 instead of following the data. |
| **Reproduction** | Hover on BTC candlestick at a specific date — the valuation composite crosshair will appear at Y=0, not at the actual composite score for that date. |
| **Recommendation** | **HOTFIX NEEDED.** Replace `c.setCrosshairPosition(0, ...)` with lookup of actual data value, similar to prior system's `getCrosshairData()` pattern. For the valuation→BTC sync, use `dailyData.find(d => d.date === timeStr)?.close` or similar. |

### A.6 Time Range Sync — MINOR

| Field | Detail |
|-------|--------|
| **Component** | Visible logical range sync |
| **Unified** | Uses `isRangeSyncingRef` ref + `requestAnimationFrame` to debounce. Calls `c.timeScale().setVisibleLogicalRange(range)` on other charts. |
| **Prior** | Uses local `isSyncing` boolean (no ref) without rAF debounce. Same `setVisibleLogicalRange` approach. |
| **Gap** | Both achieve same behavior. Unified uses more robust guard (useRef avoids stale closure issues) and rAF for debounce. This is actually an improvement over the prior. |
| **Recommendation** | Acceptable — improvement over prior. |

### A.7 Maximize Behavior — MAJOR

| Field | Detail |
|-------|--------|
| **Component** | Panel maximize/restore |
| **Unified** | Per-pane maximize (`"btc"` or `"val"`) via state `MaximizedPanel`. Uses CSS class `.chart-subplot-hidden { height: 0; overflow: hidden }` to collapse panels. Wrapper gets `.chart-fullscreen-active` to hide sibling UI. Maximized BTC: `window.visualViewport.height` full height. Maximized Val: 65/35 split. |
| **Prior** | Single chart-level maximize via `isMaximized` boolean. Sets `document.body.style.overflow = 'hidden'` to prevent page scroll. Uses CSS class `.maximized` on the wrapper div. All subplots remain visible, just expanded. |
| **Gap** | **DIFFERENT ARCHITECTURE.** Unified introduces per-pane maximize (not in prior) which collapses other panes. Prior only had a single full-chart maximize. The unified approach is actually more featured — users can maximize individual panes to focus on them. However, the prior's body overflow hidden approach is simpler and more reliable for preventing scroll during maximize. |
| **Impact** | Unified offers more flexibility (per-pane maximize). Prior was simpler (chart-level toggle). The unified collapse approach may be confusing for users who expect all panes to remain visible when maximizing. |
| **Recommendation** | Document as intentional upgrade. Verify that `.chart-fullscreen-active` class properly hides sibling UI elements (sidebars, headers). |

### A.8 LOG/LIN Toggle — MINOR

| Field | Detail |
|-------|--------|
| **Component** | Log/linear scale toggle |
| **Unified** | Two toggle buttons (LIN/LOG) in a `.toggle-group`. Dedicated `useEffect` applies `priceScale("right").applyOptions({ mode })` when `isLogScale` changes. Default: `true` (log). |
| **Prior** | Single button showing "SCALE: LOG" or "SCALE: LINEAR". The full chart initialization `useEffect` depends on `isLogScale` and re-runs entirely on toggle. Default: `true` (log). Same `PriceScaleMode.Logarithmic` / `Normal` on BTC chart priceScale("right"). |
| **Gap** | Same functional behavior. UI difference (single button vs toggle pair). Unified is more idiomatic for a toggle (two buttons with active state). |
| **Recommendation** | Acceptable — cosmetic difference. |

### A.9 Y-Axis Width — MINOR

| Field | Detail |
|-------|--------|
| **Component** | Right price scale minimum width |
| **Unified** | `getChartYAxisWidth()` reads CSS variable `--chart-yaxis-width`, defaults to `85`. Applied in `makeCommonOptions()` and re-applied on resize via `priceScale("right").applyOptions({ minimumWidth: yWidth })`. |
| **Prior** | Hardcoded `minimumWidth: 90` in both chart `rightPriceScale` configs. |
| **Gap** | 85px vs 90px (5px difference). CSS variable approach is more maintainable. No functional impact. |
| **Recommendation** | Acceptable — the CSS variable approach is better. However, verify the `85px` label shown in the subplot header matches the actual minimumWidth. |

### A.10 PNG Export — MINOR

| Field | Detail |
|-------|--------|
| **Component** | PNG export functionality |
| **Unified** | Calls `exportChartsToPng(subplots, filename)` from `../../lib/exportPng`. Uses `document.querySelectorAll(".chart-subplot")` to find containers. Background: `#0B1220`. Watermark: "QUANT UNIFIED PLATFORM // VALUATION". Filename: `btc-valuation-YYYY-MM-DD.png`. Font: `JetBrains Mono`. |
| **Prior** | Inline `exportToPng()` in `CompositeChart.tsx`. Uses container refs directly (btcContainerRef, oscContainerRef). Adds explicit 16px panelGap between subplots. Background: `#0f172a`. Watermark: "QUANT BTC VALUATION SYSTEM // MASTER.COMPOSITE.OSCILLATOR". Filename: `btc-composite-oscillator-YYYY-MM-DD.png`. Font: `monospace`. |
| **Gap** | Different watermark text (platform branding update), different filename, slightly different background color (#0B1220 vs #0f172a). Unified uses selector-based container detection (more flexible) while prior used direct refs. Prior explicitly handles panelGap (16px) between subplots; unified relies on container `clientHeight` which already includes any spacing. |
| **Impact** | Watermark text and filename changes are expected for unified platform branding. The unified approach of using `querySelectorAll` is more flexible but could pick up unintended elements if selectors overlap. |
| **Recommendation** | Acceptable — intentional rebranding. Verify the PNG export works correctly from both composite view and metric detail view. |

### A.11 Background Color — MINOR

| Field | Detail |
|-------|--------|
| **Component** | Chart background |
| **Unified** | Solid `#0B1220` background via `ColorType.Solid` |
| **Prior** | `'transparent'` background — relied on parent container for background |
| **Gap** | Unified uses explicit solid dark background. Prior was transparent (inherits from parent). The unified approach is more robust for standalone chart embedding. |
| **Recommendation** | Acceptable — improvement over prior. |

---

## Cross-Reference: SAVE PNG Button Location

| Field | Unified | Prior |
|-------|---------|-------|
| **Button location** | In the chart control bar (between LOG/LIN toggle and restore button) | In the card header alongside SCALE toggle, MAXIMIZE button, and Latest Score badge |
| **Filename (composite)** | `btc-valuation-YYYY-MM-DD.png` | `btc-composite-oscillator-YYYY-MM-DD.png` |
| **Watermark** | "QUANT UNIFIED PLATFORM // VALUATION" | "QUANT BTC VALUATION SYSTEM // MASTER.COMPOSITE.OSCILLATOR" |

Both differences are intentional branding changes.

---

## 1:1 Parity Assessment

| Area | Parity | Notes |
|------|--------|-------|
| BTC price rendering | ❌ **FAIL** | CandlestickSeries vs AreaSeries — intentional improvement |
| Composite oscillator rendering | ✅ PASS | Minor color difference |
| Reference lines | ❌ **FAIL** | Missing +2.0, 0, -2.0 lines |
| Crosshair sync | ❌ **FAIL** | Y position set to 0 instead of actual value |
| Time range sync | ✅ PASS | Improvement over prior |
| Maximize behavior | ⚠️ **DIFFERENT** | Per-pane vs chart-level — intentional upgrade |
| LOG/LIN toggle | ✅ PASS | UI style difference only |
| Y-axis width | ✅ PASS | 85px vs 90px — acceptable |
| PNG export | ✅ PASS | Intentional branding changes |

---

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Completed Track A audit comparing unified ValuationStudio.tsx composite chart against prior CompositeChart.tsx across 11 comparison points. Produced structured findings with severity, impact, and recommendations."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "read /home/ubuntu/projects/quant.maftia.tech/web/src/components/studios/ValuationStudio.tsx",
      "result": "passed",
      "summary": "Read unified composite chart component (923 lines)"
    },
    {
      "command": "read /home/ubuntu/projects/quant-btc-valuation-system/frontend/src/components/CompositeChart.tsx",
      "result": "passed",
      "summary": "Read prior system composite chart component (~200 lines)"
    },
    {
      "command": "read /home/ubuntu/projects/quant.maftia.tech/web/src/lib/exportPng.ts",
      "result": "passed",
      "summary": "Read PNG export utility for unified system"
    }
  ],
  "validationOutput": [
    "11 findings identified: 0 Critical, 5 Major, 6 Minor",
    "2 items need hotfix: missing reference lines (A.4), crosshair Y position (A.5)",
    "3 items are intentional improvements: candlestick series (A.1), OHLC data (A.2), per-pane maximize (A.7)",
    "6 items are acceptable differences: area colors (A.3), time range sync (A.6), LOG/LIN UI (A.8), y-axis width (A.9), PNG branding (A.10), background color (A.11)"
  ],
  "residualRisks": [
    "Crosshair Y position set to 0 instead of actual data value — users won't see crosshair tracking the data curve on non-hovered panels",
    "Missing reference lines at ±2.0 and 0 — users lose visual boundaries for the oscillator range",
    "PNG export uses querySelectorAll which could capture unintended elements if selectors overlap with other parts of the UI"
  ],
  "noStagedFiles": true,
  "diffSummary": "No code changes made — this is a read-only audit track producing findings only",
  "reviewFindings": [
    "blocker: unified ValuationStudio.tsx line ~312 - crosshair sync always uses Y=0 instead of actual data value, causing crosshair to float at 0 instead of tracking data curve",
    "blocker: unified ValuationStudio.tsx line ~267-274 - only 2 reference lines (1.5, -1.0) instead of prior's 5 lines (2.0, 1.0, 0, -1.0, -2.0)"
  ],
  "manualNotes": "Track A complete. Two items flagged for hotfix: (1) add missing reference lines at +2.0, 0, -2.0 on the oscillator panel, (2) fix crosshair sync to pass actual data Y value instead of 0."
}
```
