## 1. Critical Fix — Crosshair Y-Position Lookup

- [ ] 1.1 In `ValuationStudio.tsx`, build a `btcDataMap: Map<string, number>` (close price) and `valDataMap: Map<string, number>` (composite score) inside the chart initialization `useEffect`, populated from the fetched data arrays
- [ ] 1.2 In `ValuationStudio.tsx`, replace `setCrosshairPosition(0, param.time, series)` with lookups from the appropriate data map so actual Y values are passed for BTC and valuation panels
- [ ] 1.3 In `MetricDetailChart.tsx`, build `btcDataMap`, `rawDataMap`, and `oscDataMap` inside the chart initialization `useEffect`
- [ ] 1.4 In `MetricDetailChart.tsx`, replace all `setCrosshairPosition(0, ...)` calls with data map lookups so all 3 detail panels sync correct Y values
- [ ] 1.5 Verify: hover over each panel and confirm the horizontal crosshair line tracks actual prices/scores (not stuck at Y=0)

## 2. Critical Fix — Score Double-Scaling Removal

- [ ] 2.1 In `ValuationStudio.tsx`, locate the sparkline data mapping and remove `* 2` from `normalized_score` mapping (line ~396)
- [ ] 2.2 In `ValuationStudio.tsx`, locate the metric score display computation and remove `* 2` from the score variable (line ~401)
- [ ] 2.3 Verify: metric score badges now show values in `[-2.0, +2.0]` matching the raw DB values
- [ ] 2.4 Verify: sparkline polyline points do not exceed `±2.0` for any of the 17 indicators
- [ ] 2.5 Run `cd web && npx tsc --noEmit` to confirm no TypeScript errors introduced

## 3. Critical Fix — Renormalize After Threshold Save

- [ ] 3.1 Create `quant-btc-valuation-system/scripts/renormalize_metric.py` — a CLI script accepting `<metric_name>` argument that reads updated thresholds from `maftia_quant.db` (WAL), recomputes `normalized_score` for all rows in `unified_component_signals` for that metric using piecewise linear interpolation, and commits in a WAL transaction
- [ ] 3.2 Verify the renormalize script is causal (no lookahead): scores computed only from data at or before each row's timestamp
- [ ] 3.3 Test the script manually: `python3 quant-btc-valuation-system/scripts/renormalize_metric.py mvrv_zscore`
- [ ] 3.4 Add `POST /api/v1/quant/metric/:metric_name/renormalize` route to `src/api/routes/metrics.ts` — spawns the renormalize script via `Bun.spawn`, waits up to 30s, returns `{ success, metric, rows_updated }` on success or HTTP 504 on timeout
- [ ] 3.5 In `MetricDetailChart.tsx`, after `saveMetricConfig` resolves successfully, call `quantClient.renormalizeMetric(metricName)` before calling `onRefresh()`
- [ ] 3.6 Add `renormalizeMetric` method to the API client (`quantClient`)
- [ ] 3.7 Handle renormalize errors in UI: show toast on failure but still call `onRefresh()`
- [ ] 3.8 End-to-end test: edit a threshold, save, verify `normalized_score` values in the chart update within the same session

## 4. Major Fix — Reference Lines

- [ ] 4.1 In `ValuationStudio.tsx` composite chart init, add `createPriceLine` calls for `+2.0` (red dashed), `0` (gray solid), `-2.0` (red dashed) on the valuation area series panel (existing `+1.5` and `-1.0` lines kept as-is)
- [ ] 4.2 In `MetricDetailChart.tsx` detail chart init, add `createPriceLine` calls for `+1.0` and `-1.0` on the oscillator panel (existing `+2.0`, `0`, `-2.0` lines kept as-is)
- [ ] 4.3 Verify: composite chart shows 5 reference lines at `+2.0`, `+1.5`, `0`, `-1.0`, `-2.0`
- [ ] 4.4 Verify: detail oscillator panel shows 5 reference lines at `+2.0`, `+1.0`, `0`, `-1.0`, `-2.0`

## 5. Major Fix — Threshold Editor UX Restoration

- [ ] 5.1 In `MetricDetailChart.tsx`, add `isInverted` computed boolean from current threshold state (`t_plus_2 < t_minus_2`) and render `DIR: NORMAL` / `DIR: INVERTED` badge in the threshold editor header
- [ ] 5.2 Add `isDirty: boolean` state tracking whether current thresholds differ from the last-saved snapshot (stored in a `savedThresholdsRef`)
- [ ] 5.3 Render `● UNSAVED CHANGES` indicator with CSS `@keyframes pulse` animation when `isDirty === true`; hide it after successful save
- [ ] 5.4 Add `GET /api/v1/quant/metrics/defaults` route to `src/api/routes/metrics.ts` — returns all 17 indicators' `DEFAULT_THRESHOLDS` config as JSON
- [ ] 5.5 Add `fetchMetricDefaults(metricName)` method to `quantClient`
- [ ] 5.6 Add `Reset to Defaults` button to threshold editor; on click, call `fetchMetricDefaults` and set thresholds state to returned defaults (sets `isDirty = true`)
- [ ] 5.7 Verify direction badge updates in real-time as threshold values change
- [ ] 5.8 Verify dirty indicator appears on first keystroke and disappears after save

## 6. Major Fix — Loading and Error States

- [ ] 6.1 Add `isLoading: boolean` state to `ValuationStudio.tsx`, initialized to `true`; set to `false` after data fetch resolves (success or error)
- [ ] 6.2 Add `error: string | null` state to `ValuationStudio.tsx`; set to error message on fetch failure
- [ ] 6.3 Render a centered spinner overlay when `isLoading === true` (conditionally, without removing chart DOM per AGENTS.md DOM persistence rule)
- [ ] 6.4 Render an error panel with message and `Retry` button when `error !== null`
- [ ] 6.5 Wire `Retry` button to re-trigger the fetch (increment a `retryCount` state or call fetch directly)
- [ ] 6.6 Verify: disable chart interactivity during loading (pointer-events: none on chart wrapper when isLoading)

## 7. Major Fix — `mapToOscillator` Null → 0.0

- [ ] 7.1 In `web/src/lib/oscillator.ts`, change the out-of-range return value from `null` to `0.0`
- [ ] 7.2 Audit all callers of `mapToOscillator` in the codebase for null-checks that now become dead code or need updating
- [ ] 7.3 Update TypeScript return type if it was typed as `number | null` → change to `number`
- [ ] 7.4 Run `cd web && npx tsc --noEmit` to confirm no TypeScript errors

## 8. Major Fix — PNG Export Panel Gap

- [ ] 8.1 In `web/src/utils/exportChartsToPng.ts`, define `const PANEL_GAP = 16` constant
- [ ] 8.2 Update canvas total height calculation to `sum(panelHeights) + (numPanels - 1) * PANEL_GAP`
- [ ] 8.3 Update the compositing loop to accumulate `currentY += panelHeight + PANEL_GAP` (not just `+= panelHeight`)
- [ ] 8.4 Test PNG export from composite view — verify visual gap between BTC and valuation panels in exported file
- [ ] 8.5 Test PNG export from metric detail view — verify gaps between all 3 panels

## 9. Validation & Finalization

- [ ] 9.1 Run `cd web && npx tsc --noEmit` — confirm zero TypeScript errors across all changed files
- [ ] 9.2 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` — confirm all 4 system pipelines pass without regression
- [ ] 9.3 Manual smoke test: open Valuation Studio composite view, hover charts (crosshair tracks correctly), verify 5 reference lines visible
- [ ] 9.4 Manual smoke test: click a metric → verify detail view shows 5 oscillator lines, direction badge, dirty indicator on edit, reset button
- [ ] 9.5 Manual smoke test: edit threshold → Save → verify renormalize call triggers → chart data refreshes with updated scores
- [ ] 9.6 Manual smoke test: trigger loading state (slow network/offline) → spinner visible → error panel visible → Retry works
- [ ] 9.7 Commit all changes with Conventional Commits format: `fix: remove normalized_score double-scaling`, `fix: crosshair Y-position lookup from data map`, `fix: add renormalize endpoint and post-save trigger`, `feat: restore reference lines, threshold editor UX, loading/error states`
- [ ] 9.8 Push to main branch and verify no force-push used
