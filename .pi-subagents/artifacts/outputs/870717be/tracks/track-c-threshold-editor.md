# Track C — Threshold Editor Audit

**Comparison**: `MetricDetailChart.tsx` (unified) vs `ThresholdEditor.tsx` (prior)

**Files**:
- Unified: `/home/ubuntu/projects/quant.maftia.tech/web/src/components/studios/MetricDetailChart.tsx` (threshold editor section = lines 443-618)
- Prior: `/home/ubuntu/projects/quant-btc-valuation-system/frontend/src/components/ThresholdEditor.tsx` (entire file, 201 lines)

---

## Findings

### 1. Five Threshold Inputs — Visual & Behavioral

| Aspect | Unified (MetricDetailChart.tsx) | Prior (ThresholdEditor.tsx) | Verdict |
|--------|--------|--------|---------|
| t_plus_2 label | "Bottom (t_plus_2)" | "+2 (UNDERVALUED / BUY)" | **DIFFERENT** — Prior uses score-direction terminology, unified uses internal config key |
| t_plus_2 color | Green (#22C55E) | Green bold (var(--accent-emerald)) | Minor — same hue family |
| t_plus_1 label | "Opportunity (t_plus_1)" | "+1 (MILD BUY)" | **DIFFERENT** — Prior uses "MILD BUY" vs unified's "Opportunity" |
| t_plus_1 color | Light Green (#4ADE80) | Green (var(--accent-emerald)) | Minor — slightly different shade |
| t_zero label | "Neutral (t_zero)" | "0 (NEUTRAL)" | Equivalent semantically |
| t_zero color | Gray (#64748B) | Gray (var(--text-tertiary)) | Equivalent |
| t_minus_1 label | "Warning (t_minus_1)" | "-1 (MILD SELL)" | **DIFFERENT** — Prior uses "MILD SELL" vs unified's "Warning" |
| t_minus_1 color | Light Red (#F87171) | Rose (var(--accent-rose)) | Minor hue difference |
| t_minus_2 label | "Peak (t_minus_2)" | "-2 (OVERVALUED / SELL)" | **DIFFERENT** — Prior uses "OVERVALUED / SELL" vs unified's "Peak" |
| t_minus_2 color | Red (#EF4444) | Rose bold (var(--accent-rose)) | Minor hue difference |
| Input width | `width: 100%` (fills container) | `width: 110px` (fixed) | Minor — both functional |
| Step | `step="any"` | `step="any"` | Match |
| Placeholder | None | None | Match |

**Severity**: Minor — Labels use different terminology (score-action vs config-key) but the inputs are functionally identical.

---

### 2. Direction Detection Badge — MISSING

| Unified | Prior |
|---------|-------|
| **No direction badge shown** | Shows `DIR: NORMAL` or `DIR: INVERTED` badge with color-coded background (blue for normal, red for inverted) and border |

**Severity**: **Major** — The direction detection logic exists in both codebases (unified has it in `mapToOscillator` in `oscillator.ts`), but the unified threshold editor does not surface it in the UI. Prior system gave users explicit visibility into whether the metric is inverted or normal which is critical for understanding threshold semantics.

---

### 3. Dirty/Unsaved Indicator — MISSING

| Unified | Prior |
|---------|-------|
| **No dirty/unsaved indicator** | Shows `* UNSAVED CHANGES` with pulse animation when inputs differ from saved config, plus disables save button until dirty |

**Severity**: **Major** — Users can't tell if their threshold changes have been saved or not. Prior system had clear visual feedback. The unified save button is always enabled even without changes.

---

### 4. Real-Time Oscillator Recomposition

| Aspect | Unified | Prior |
|--------|---------|-------|
| Trigger | `handleThresholdChange` on every `onChange` | `useEffect` on `[thresholds, loading]` |
| Update mechanism | Directly calls `oscSeries.setData(...)` with recomputed values | Directly calls `oscSeriesRef.current.setData(...)` with recomputed values |
| Price lines update | `updateRawPriceLines(series, updated)` — removes then recreates all lines | Static lines created at mount only (not dynamic) |
| Latency | Immediate (synchronous) | Immediate (via effect) |

**Difference**: Prior system created threshold lines once at mount (static). Unified dynamically updates them on each keystroke. The oscillator recomputation is functionally equivalent in both.

**Severity**: Minor — Unified is actually better (dynamic price lines). No gap to fix.

---

### 5. Save-to-Backend Flow — RENORMALIZATION MISSING

| Step | Unified | Prior |
|------|---------|-------|
| 1 | `saveMetricConfig(thresholds)` | `saveMetricConfig(parsedConfig)` |
| 2 | — | **`renormalizeMetric(metricName)`** |
| 3 | — | `onRefresh()` (dashboard data refresh) |
| Result | Config saved, but stored normalized values NOT updated | Config saved AND stored normalized values re-calculated |

**Severity**: **Critical** — Without calling `renormalizeMetric`, changing thresholds in the unified system will update the oscillator display and price lines in real-time, but the persisted normalized scores in `unified_component_signals` will NOT reflect the new thresholds. This means saved config changes have no effect on actual valuation data until the next full pipeline run. The prior system immediately propagated changes.

**Evidence**:
- Prior `handleSave()` (ThresholdEditor.tsx:114-133): `await saveMetricConfig(parsedConfig); await renormalizeMetric(metricName); onRefresh();`
- Unified `handleSaveConfig()` (MetricDetailChart.tsx:389-399): `quantClient.saveMetricConfig(metricName, thresholds).then(...)` — no renormalize call.

---

### 6. Reset-to-Defaults Button — MISSING

| Unified | Prior |
|---------|-------|
| **No reset button** | Has `handleReset` that fetches default configs from `/api/metrics/config/defaults` and populates all 5 inputs |

**Severity**: **Major** — Users have no way to revert to the system-provided default thresholds without manually remembering or looking up the values. The backend already has `DEFAULT_THRESHOLDS` in `src/api/routes/metrics.ts`. The prior system had a dedicated reset flow.

---

### 7. Save Feedback

| Aspect | Unified | Prior |
|--------|---------|-------|
| Type | Inline toast, auto-dismiss after 3-4s | Colored banner, persistent until next action |
| Success color | Green background with border | Green text with green border box |
| Error color | Red background with border | Red text with red border box |
| Error message format | Limited to error.message || err | Prior shows err?.message || 'Failed to save configuration' |

**Difference**: Both show success/error feedback with color-coded styling. Unified auto-dismisses after timeout; prior stays until dismissed by new action. This is a UX preference.

**Severity**: Minor — Both provide equivalent feedback.

---

### 8. Threshold Editor Layout

| Unified | Prior |
|---------|-------|
| Desktop: Inline sidebar (280px grid column), inside `glass-card` with "Piecewise Threshold Editor" heading | Below the chart panels, after `border-top: 1px solid var(--border-strong)` separator, with "VALUATION.THRESHOLD.MATRICES" heading |
| Mobile: Hidden by default, opened via BottomSheet when user clicks "THRESHOLDS" button | Same layout on all screen sizes (no mobile adaptation) |
| Inputs stacked vertically in a column | Inputs in flex-wrap row (inline) |

**Difference**: Unified uses a responsive layout strategy (sidebar on desktop, sheet on mobile) compared to the prior system's always-below-charts layout.

**Severity**: Minor — Architectural redesign, functionally equivalent.

---

## Summary Table

| # | Finding | Severity | Unified | Prior |
|---|---------|----------|---------|-------|
| 1 | Threshold input labels use different terminology | Minor | Config-key labels (Peak, Warning, Opportunity, Bottom) | Action-labels (+2 BUY, -1 SELL) |
| 2 | Direction detection badge | **Major** | Not shown | DIR: NORMAL/INVERTED with styling |
| 3 | Dirty/unsaved indicator | **Major** | Not shown | `* UNSAVED CHANGES` pulse animation |
| 4 | Real-time oscillator recomputation | Minor | Immediate on keystroke | Immediate via effect (equivalent) |
| 5 | Save-to-backend missing renormalization | **Critical** | `saveMetricConfig` only | `saveMetricConfig` + `renormalizeMetric` + `onRefresh` |
| 6 | Reset-to-defaults button | **Major** | Not present | `handleReset` fetching defaults |
| 7 | Save feedback styling | Minor | Auto-dismiss toast | Persistent banner |
| 8 | Responsive layout | Minor | Sidebar + BottomSheet | Always below charts |

---

## Critical Gaps Requiring Hotfix

### Gap C-5: Missing `renormalizeMetric` in save flow

**Location**: `MetricDetailChart.tsx` @ `handleSaveConfig` (around line 389)

**Impact**: User changes threshold values in the editor, sees oscillator update in real-time, clicks "SAVE CONFIG" — the new thresholds are persisted, but the stored normalized scores in `unified_component_signals` are NOT recalculated. The valuation composite score, circuit breaker filter, and all downstream systems using the stored normalized values continue using OLD threshold boundaries. Effectively, the threshold editor is only cosmetic — it shows what the oscillator WOULD look like but doesn't integrate with the actual valuation pipeline.

**Fix**: Add a call to a renormalization endpoint after saving. The backend already has the metrics database and the `mapToOscillator` logic exists in `src/lib/oscillator.ts`. There's no existing `/api/v1/quant/metric/:metric_name/renormalize` route though — that would need to be added, or the save endpoint itself could trigger renormalization server-side.
