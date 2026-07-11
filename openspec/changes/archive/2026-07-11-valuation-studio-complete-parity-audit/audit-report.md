# Valuation Studio Parity Audit Report

**Change:** `valuation-studio-complete-parity-audit`  
**Date:** 2026-07-11  
**Method:** 8 parallel scouting tracks (A-H), each comparing unified vs prior system components  
**Auditor:** Automated parallel subagent analysis

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total Findings | 52 |
| **Critical** (data fidelity, must fix) | **3** |
| **Major** (feature regression, should fix) | **15** |
| **Minor** (cosmetic/architectural) | **26** |
| **Pass** (parity achieved) | **8** |

**Parity Score: ~65%** (34 of 52 findings are gaps requiring attention; 3 critical)

---

## Critical Gaps (Must Fix)

### C-GAP-1: Crosshair Y-Position Fixed at 0 (Composite & Detail)

**Severity:** CRITICAL  
**Tracks:** A.5, B.5  
**Files:** `web/src/components/studios/ValuationStudio.tsx` (line ~278-286), `MetricDetailChart.tsx` (line ~260-269)

**Description:** Both composite and detail chart crosshair sync pass `0` as the Y-axis position when calling `setCrosshairPosition()` on the other panels. The prior system correctly looked up the actual data value at that time point using a `getCrosshairData` helper. This means the horizontal crosshair line is always at Y=0 instead of tracking actual prices/scores.

**Evidence:**

```typescript
// Unified (WRONG):
allCharts.forEach(({ chart: c, series: s }, i) => {
  if (i !== idx) c.setCrosshairPosition(0, param.time as Time, s);
});

// Prior (CORRECT):
const data = getCrosshairData(param.time as string);
if (data) {
  chartOsc.setCrosshairPosition(data.oscVal, param.time, oscSeries);
}
```

**Fix:** Replace `0` with actual data lookup for each panel type.

---

### C-GAP-2: Score Double-Scaling (`normalized_score * 2`)

**Severity:** CRITICAL  
**Tracks:** D.3, E.1  
**Files:** `web/src/components/studios/ValuationStudio.tsx` (lines ~395-401)

**Description:** The unified system applies `normalized_score * 2` to display scores and sparkline values. The `normalized_score` field from `unified_component_signals` is already in the [-2.0, +2.0] range (confirmed by database query showing min=-2.0, max=2.0). This double-scales displayed values to [-4.0, +4.0], making all indicators appear more extreme.

**Evidence:**

```typescript
// Unified (WRONG):
value: toNum(s.normalized_score) * 2,   // sparkline data
const score = latestSignal ? toNum(latestSignal.normalized_score) * 2 : 0;  // score display

// Prior (CORRECT):
value: pt.normalized_value   // no multiplication
```

And the database query confirmed: `SELECT MIN(normalized_score), MAX(normalized_score), AVG(normalized_score) FROM unified_component_signals` → min=-2.0, max=2.0, avg≈0.25.

**Fix:** Remove the `* 2` multiplier.

---

### C-GAP-3: Missing Renormalization After Threshold Save

**Severity:** CRITICAL  
**Tracks:** C.5  
**Files:** `web/src/components/studios/MetricDetailChart.tsx` (line ~389-399)

**Description:** Saving threshold config only persists to the database but does not trigger renormalization of stored normalized scores. The prior system called `renormalizeMetric(metricName)` after saving, which propagated the new thresholds into the stored `timeseries_metrics.normalized_value` column. Without this, saved threshold changes have no effect on actual valuation data until the next full pipeline run.

**Evidence:**

```typescript
// Unified (WRONG):
quantClient.saveMetricConfig(metricName, thresholds).then(() => { ... });

// Prior (CORRECT):
await saveMetricConfig(parsedConfig);
await renormalizeMetric(metricName);  // ← MISSING
onRefresh();
```

**Fix:** Add a renormalize endpoint or server-side trigger, and call it after config save.

---

## Major Gaps Summary

| ID | Track | Description | Severity | File |
|----|-------|-------------|----------|------|
| A.1 | A | BTC chart uses CandlestickSeries (intentional upgrade from AreaSeries) | Major | ValuationStudio.tsx |
| A.4 | A | Reference lines: missing +2.0, 0, -2.0 on composite chart | Major | ValuationStudio.tsx |
| B.4 | B | Oscillator reference lines: missing +1.0, -1.0 (vs MetricDetail prior) | Major | MetricDetailChart.tsx |
| C.2 | C | Direction detection badge not shown in threshold editor | Major | MetricDetailChart.tsx |
| C.3 | C | Dirty/unsaved indicator missing in threshold editor | Major | MetricDetailChart.tsx |
| C.6 | C | Reset-to-defaults button missing in threshold editor | Major | MetricDetailChart.tsx |
| D.9 | D | Sparkline color coding differs (discrete by direction vs HSL gradient) | Major | ValuationStudio.tsx |
| E.2 | E | Sparkline color coding strategy fundamentally different | Major | ValuationStudio.tsx / Sparkline.tsx |
| F.2 | F | PNG export missing panel gap (16px) between subplots | Major | exportChartsToPng.ts |
| G.3 | G | No bulk config defaults endpoint | Major | src/api/routes/metrics.ts |
| G.4 | G | No renormalize API endpoint | Major | src/api/routes/metrics.ts |
| G.7 | G | mapToOscillator returns null vs 0.0 for out-of-range values | Major | web/src/lib/oscillator.ts |
| G.8 | G | No pipeline trigger endpoint | Major | src/api/routes/ |
| H.2 | H | No loading state for composite charts during initial data load | Major | ValuationStudio.tsx |
| H.3 | H | No error state handling for failed API calls | Major | ValuationStudio.tsx |

---

## Minor Gaps Summary

| ID | Description |
|----|-------------|
| A.2 | Composite area fill colors differ (0.35 vs 0.2 opacity) |
| A.6 | Maximize architecture differs (per-panel vs chart-level) — unified is richer |
| A.8 | Y-axis width 85px vs prior 90px |
| A.10 | PNG background #0B1220 vs #0f172a |
| A.11 | Chart background solid vs transparent |
| B.1 | 3-panel series types vary (Line vs Area for oscillator) |
| B.3 | Threshold line colors/titles differ slightly |
| B.6 | mapToOscillator signature differs but functionally equivalent |
| B.9 | Y-axis width 85px vs prior 90px |
| C.1 | Threshold input labels use different terminology |
| C.4 | Oscillator recomputation trigger mechanism differs (equivalent) |
| C.7 | Save feedback style differs (toast vs banner) |
| C.8 | Threshold editor layout differs (sidebar vs below charts) |
| D.4 | Signal direction terminology inverted (unified is actually correct) |
| D.5 | Category filtering: table+buttons vs sections — architectural |
| F.1 | Background color difference (#0B1220 vs #0f172a) |
| F.3 | DPR scaling approach differs (equivalent result) |
| F.4 | Font size 11px vs 12px |
| F.5 | Filename naming convention change |
| G.2 | Date intersection approach (both produce same result) |
| G.6 | Causal filtering (unified more robust) |
| G.7b | Backend mapToOscillator dead code |
| G.9 | Metric name case handling |
| H.1 | Metric selection flow minor architectural difference |
| H.5 | Maximize fullscreen — richer in unified |
| H.7 | Parallel fetching architecture (improvement) |

---

## Per-Track Detail

### Track A: Composite Chart (2-Panel) — 9 findings (0 critical, 2 major, 7 minor)

| # | Finding | Severity | Fix Needed? |
|---|---------|----------|-------------|
| A.1 | CandlestickSeries vs AreaSeries (intentional upgrade) | Major | No |
| A.2 | Area fill colors differ slightly | Minor | No |
| A.3 | Missing reference lines: +2.0, 0, -2.0 | Major | Yes |
| A.4 | Crosshair Y=0 instead of actual value | **Critical** | Yes |
| A.5 | Time range sync works (improvement over prior) | Minor | No |
| A.6 | Per-pane maximize (richer than prior) | Minor | No |
| A.7 | LOG/LIN toggle parity | Pass | No |
| A.8 | Y-axis 85px vs 90px | Minor | No |
| A.9 | PNG export branding changes (intentional) | Minor | No |

### Track B: Metric Detail Chart (3-Panel) — 9 findings (1 critical, 2 major, 5 minor, 1 pass)

| # | Finding | Severity | Fix Needed? |
|---|---------|----------|-------------|
| B.1 | Panel layout and series types differ | Minor | No |
| B.2 | BTC data source difference | Minor | No |
| B.3 | Threshold line colors/titles differ | Minor | No |
| B.4 | Missing +1.0 and -1.0 reference lines | Major | Yes |
| B.5 | Crosshair Y=0 bug (same as A.4) | **Critical** | Yes |
| B.6 | mapToOscillator functionally equivalent | Minor | No |
| B.7 | LOG/LIN toggle parity | Pass | No |
| B.8 | Per-panel maximize (new feature) | Minor | No |
| B.9 | Y-axis 85px vs 90px | Minor | No |

### Track C: Threshold Editor — 8 findings (1 critical, 3 major, 4 minor)

| # | Finding | Severity | Fix Needed? |
|---|---------|----------|-------------|
| C.1 | Input label terminology differs | Minor | No |
| C.2 | Direction detection badge missing | Major | Yes |
| C.3 | Dirty/unsaved indicator missing | Major | Yes |
| C.4 | Oscillator recomputation works (equivalent) | Minor | No |
| C.5 | Missing renormalize after save | **Critical** | Yes |
| C.6 | Reset-to-defaults button missing | Major | Yes |
| C.7 | Save feedback differs | Minor | No |
| C.8 | Layout differs (sidebar vs below) | Minor | No |

### Track D: Component Matrix — 9 findings (1 critical, 2 major, 4 minor, 2 pass)

| # | Finding | Severity | Fix Needed? |
|---|---------|----------|-------------|
| D.1 | All 17 indicators present and matched | Pass | No |
| D.2 | Category assignment matches prior | Pass | No |
| D.3 | Score double-scaling (`* 2`) | **Critical** | Yes |
| D.4 | Terminology inverted (unified is correct) | Minor | No |
| D.5 | Layout: table vs sections | Minor | No |
| D.6 | Mobile layout present (improvement) | Minor | No |
| D.7 | Metric navigation works | Pass | No |
| D.8 | Direction threshold difference (0.5 vs 1.0) | Minor | No |
| D.9 | Sparkline data/color differs | Major | Optional |

### Track E: Sparklines — 5 findings (1 critical, 2 major, 2 minor)

| # | Finding | Severity | Fix Needed? |
|---|---------|----------|-------------|
| E.1 | Double-scaling `normalized_score * 2` | **Critical** | Yes |
| E.2 | Color coding: discrete vs gradient | Major | Optional |
| E.3 | SVG vs Recharts rendering | Minor | No |
| E.4 | Hover tooltip (new feature) | Minor | No |
| E.5 | Data source: 1 call vs 17 calls | Major | No (improvement) |

### Track F: PNG Export — 7 findings (0 critical, 1 major, 6 minor)

| # | Finding | Severity | Fix Needed? |
|---|---------|----------|-------------|
| F.1 | Canvas compositing parity | Pass | No |
| F.2 | Missing panel gap (16px) | Major | Yes |
| F.3 | DPR scaling differs (equivalent) | Minor | No |
| F.4 | Font size 11px vs 12px | Minor | No |
| F.5 | Filename convention change | Minor | No |
| F.6 | Error handling (unified better) | Minor | No |
| F.7 | Background color differs | Minor | No |

### Track G: API Routes — 10 findings (0 critical, 4 major, 5 minor, 1 pass)

| # | Finding | Severity | Fix Needed? |
|---|---------|----------|-------------|
| G.1 | Response shape differs (nested vs flat) | Major | No (supported) |
| G.2 | Date intersection (both JS Map) | Minor | No |
| G.3 | No bulk config defaults endpoint | Major | Yes |
| G.4 | No renormalize after config save | Major | Yes |
| G.5 | All 17 DEFAULT_THRESHOLDS match | Pass | No |
| G.6 | Causal filtering (unified better) | Minor | No |
| G.7 | mapToOscillator null vs 0.0 returns | Major | Yes |
| G.8 | No pipeline/renormalize endpoint | Major | Yes |
| G.9 | Case normalization consistent | Minor | No |
| G.10 | Backend mapToOscillator dead code | Minor | Optional |

### Track H: State Management — 7 findings (0 critical, 2 major, 2 minor, 3 pass)

| # | Finding | Severity | Fix Needed? |
|---|---------|----------|-------------|
| H.1 | Metric selection flow works | Pass | No |
| H.2 | No loading state for composite charts | Major | Yes |
| H.3 | No error state handling | Major | Yes |
| H.4 | Mobile BottomSheet works (improvement) | Pass | No |
| H.5 | Maximize fullscreen (richer) | Minor | No |
| H.6 | Crosshair data display (improvement) | Pass | No |
| H.7 | Parallel fetching architecture (improvement) | Minor | No |

---

## Critical Hotfix Plan

The following 3 critical gaps will be fixed immediately:

### Fix 1: Remove Score Double-Scaling (`* 2`)

**File:** `web/src/components/studios/ValuationStudio.tsx`  
**Changes:** Lines ~396 and ~401 — remove `* 2` from sparkline data and score display

### Fix 2: Fix Crosshair Y-Position Lookup

**File:** `web/src/components/studios/ValuationStudio.tsx`, `MetricDetailChart.tsx`  
**Changes:** Replace `setCrosshairPosition(0, ...)` with actual data value lookup

### Fix 3: Add Renormalization to Threshold Save Flow

**File:** `web/src/components/studios/MetricDetailChart.tsx`  
**Changes:** Add renormalize fetch call after saveMetricConfig succeeds

---

## Per-Track Detail Reports

Detailed findings per track are available in the subagent outputs:

- `tracks/track-a-composite-chart.md`
- `tracks/track-b-metric-detail.md`
- `tracks/track-c-threshold-editor.md`
- `tracks/track-d-component-matrix.md`
- `tracks/track-e-sparkline.md`
- `tracks/track-f-png-export.md`
- `tracks/track-g-api-routes.md`
- `tracks/track-h-state-management.md`
