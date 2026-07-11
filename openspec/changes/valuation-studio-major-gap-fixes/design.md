## Context

The Valuation Studio (`ValuationStudio.tsx` + `MetricDetailChart.tsx`) is the primary UI for the `quant-btc-valuation-system` — a 17-indicator piecewise linear interpolated `ValuationComposite` scored `[-2.0, +2.0]`. A complete 8-track parity audit (tracks A–H) against the prior `CompositeChart.tsx` + `MetricDetail.tsx` codebase revealed 3 critical and 15 major regressions. This design document covers HOW to fix all 18 gaps with minimal risk and maximum precision.

All chart components use **Lightweight Charts v5.2** with a strict 85px Y-axis lock and crosshair sync. The API gateway is Hono v4 + Bun on port `:8765`, bound to `0.0.0.0`. Database is SQLite WAL mode (`maftia_quant.db`).

## Goals / Non-Goals

**Goals:**
- Eliminate the 3 critical data-correctness bugs (crosshair Y=0, score `*2`, missing renormalize)
- Restore 15 major feature gaps (reference lines, threshold editor UX, loading/error states, API endpoints)
- Keep all fixes isolated to the Valuation system only — no cross-system side effects
- Maintain 85px Y-axis lock and vertical crosshair sync across all panels
- Maintain SQLite WAL + parameterized SQL for any new backend work

**Non-Goals:**
- LTTD, MTTD, Ichimoku studio parity fixes
- Minor cosmetic differences (color opacity, font size, filename naming)
- Anything touching `quant-technical-indicator-bank` (deprecated)
- Python pipeline, HMM, PCA, or data ingestion layers

## Decisions

### Decision 1: Crosshair Y-Position — Data-Map Lookup

**Chosen:** Build a per-panel `dataMap: Map<string, number>` (keyed by ISO date string) for each series at chart initialization time. On `subscribeCrosshairMove`, look up `dataMap.get(param.time as string)` to resolve the actual Y value before calling `setCrosshairPosition`.

**Alternatives considered:**
- `chart.timeScale().coordinateToLogical()` — operates in pixel space, not data space; unreliable when panes have different scales
- Store raw data in a ref array and `.find()` — O(n) per event; the Map approach is O(1)

**Rationale:** The prior system used a `getCrosshairData(time)` helper backed by a closure over the source array. A `Map<string, number>` is idiomatic TypeScript and exact equivalent in O(1) complexity.

---

### Decision 2: Score Double-Scaling — Direct Removal

**Chosen:** Remove `* 2` multiplier at exactly 2 call sites in `ValuationStudio.tsx`:
1. Sparkline data: `value: toNum(s.normalized_score)` (no multiplier)
2. Score display: `const score = latestSignal ? toNum(latestSignal.normalized_score) : 0`

**Rationale:** `unified_component_signals.normalized_score` is stored by the Python valuation engine already in `[-2.0, +2.0]` (confirmed by DB query: min=-2.0, max=2.0). No remapping is needed.

---

### Decision 3: Renormalization — New API Endpoint + Inline Python Exec

**Chosen:** Add `POST /api/v1/quant/metric/:metric_name/renormalize` to the Hono API. This endpoint spawns `python3 /path/to/renormalize_metric.py <metric_name>` as a subprocess (using Bun's `Bun.spawn`). The Python script reads updated thresholds from `maftia_quant.db`, recalculates `normalized_score` for all historical rows, and updates `unified_component_signals` in a WAL transaction.

**Alternatives considered:**
- Full pipeline re-run (`run_report_pipeline.py`) — too slow (runs all 4 systems); threshold change only affects 1 metric
- In-process TypeScript renormalization — requires duplicating the piecewise linear interpolation logic from Python; high risk of divergence

**Rationale:** Python owns the mathematical correctness of `normalized_score`. A targeted per-metric Python subprocess is the safest approach. The API call returns after the subprocess completes (synchronous, timeout 30s).

---

### Decision 4: Reference Lines — createPriceLine at Chart Init

**Chosen:** Extend both `ValuationStudio.tsx` composite panel and `MetricDetailChart.tsx` oscillator panel to call `createPriceLine()` for all required levels at chart initialization:
- Composite valuation area: `+2.0` (red), `+1.50` (orange, existing), `0` (gray), `-1.0` (blue, existing), `-2.0` (red)
- Detail oscillator: `+2.0`, `+1.0`, `0`, `-1.0`, `-2.0`

**Rationale:** Static price lines are idiomatic in Lightweight Charts v5.2 and have zero performance impact. The prior system used this approach.

---

### Decision 5: Threshold Editor UX — Local State Extensions

**Chosen:**
- **Dirty indicator:** Add `isDirty: boolean` state derived by comparing `thresholds` against the last-saved config snapshot. Show `● UNSAVED CHANGES` text badge with CSS `@keyframes pulse` animation when `isDirty`.
- **Direction badge:** Compute `isInverted = thresholds.t_plus_2 < thresholds.t_minus_2` from current threshold state. Display `DIR: NORMAL` / `DIR: INVERTED` badge in threshold header.
- **Reset button:** Add `handleReset` function that calls `GET /api/v1/quant/metrics/defaults` to fetch defaults for the active metric, then `setThresholds(defaults)`.

---

### Decision 6: PNG Export Gap — Canvas Y-Offset Accumulation

**Chosen:** In `exportChartsToPng.ts`, change the canvas compositing loop to add a `GAP = 16` constant between each subplot's `drawImage` call by accumulating `currentY += panelHeight + GAP` instead of `currentY += panelHeight`.

---

### Decision 7: `mapToOscillator` Null Fallback

**Chosen:** In `web/src/lib/oscillator.ts`, change the out-of-range return from `null` to `0.0`. This is the mathematically correct neutral value for the `[-2.0, +2.0]` oscillator domain and matches the prior system behavior.

---

### Decision 8: Loading and Error States — React Suspense-Style Pattern

**Chosen:** Add `isLoading: boolean` and `error: string | null` state to `ValuationStudio.tsx`. Show a centered spinner overlay while `isLoading`, and a card with the error message + "Retry" button that re-triggers the fetch when `error !== null`. Use the existing design system's CSS variables for consistency.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Renormalize subprocess timeout (slow machines) | Set 30s timeout; return `504` on timeout with informative message |
| Bun subprocess path resolution for Python script | Use absolute path `/home/ubuntu/projects/quant-btc-valuation-system/src/renormalize_metric.py`; verify path at API startup |
| `dataMap` stale after data refresh | Rebuild `dataMap` inside the same `useEffect` that sets chart data, so both update atomically |
| TypeScript strict null on `mapToOscillator` callers | After changing return to `0.0`, verify all call sites don't gate on `!== null` in ways that now hide the value |

## Migration Plan

1. Fix frontend bugs (crosshair, score scaling, reference lines, editor UX, loading/error) — no data migration needed
2. Add `/renormalize` and `/defaults` backend endpoints — additive, no breaking API changes
3. Deploy to `api.quant.maftia.tech:8765` via `bun run dev` / `bun run build`
4. Trigger one manual renormalize per metric after deploy to correct historical `normalized_score` values
5. Validate via `python3 /home/ubuntu/projects/run_report_pipeline.py` — all 4 systems must pass

**Rollback:** Git revert the frontend commits; backend endpoints are additive so can be left in place without harm.

## Open Questions

- Should `renormalize_metric.py` exist as a standalone script or be a callable function in the valuation system's existing module tree? (Recommend: new standalone script at `quant-btc-valuation-system/scripts/renormalize_metric.py` to avoid import side effects)
- Should the bulk defaults endpoint (`GET /api/v1/quant/metrics/defaults`) return all 17 metrics' defaults in one response, or accept a query param filter? (Recommend: all 17 in one call for simplicity)
