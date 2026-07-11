## Why

A complete 8-track parity audit of the unified Valuation Studio against the prior system revealed **3 Critical** and **15 Major** gaps. The 3 critical gaps cause data correctness failures (score double-scaling, Y=0 crosshair, missing renormalization), while the 15 major gaps represent meaningful feature regressions (missing reference lines, missing threshold editor UX, missing loading/error states, and incomplete API endpoints). These must be fixed before the Valuation Studio can be considered production-ready or promoted as a replacement for the prior system.

## What Changes

- **Fix C-GAP-1: Crosshair Y=0 bug** — Replace `setCrosshairPosition(0, …)` with actual data-value lookup in both `ValuationStudio.tsx` (composite) and `MetricDetailChart.tsx` (detail). Crosshair horizontal line must track the real price/oscillator value at each panel.
- **Fix C-GAP-2: Score double-scaling** — Remove `* 2` multiplier from sparkline data mapping and score display in `ValuationStudio.tsx`. `normalized_score` is already in `[-2.0, +2.0]`; multiplying by 2 produces `[-4.0, +4.0]` which is incorrect.
- **Fix C-GAP-3: Missing renormalization after threshold save** — Add a `POST /api/v1/quant/metric/:metric_name/renormalize` endpoint in the Hono API, call it from `MetricDetailChart.tsx` after `saveMetricConfig` succeeds so threshold changes propagate immediately into stored `normalized_score` values.
- **Fix M-GAP: Composite chart reference lines** — Add missing `+2.0`, `0`, `-2.0` price lines to the valuation composite area series panel in `ValuationStudio.tsx`. Prior system showed 5 lines; unified shows only 2 (+1.50, -1.00).
- **Fix M-GAP: Detail chart oscillator reference lines** — Add missing `+1.0` and `-1.0` lines to the oscillator panel in `MetricDetailChart.tsx` (was 3 lines, need 5).
- **Fix M-GAP: Direction detection badge** — Restore the `DIR: NORMAL / DIR: INVERTED` badge in the threshold editor panel of `MetricDetailChart.tsx`.
- **Fix M-GAP: Dirty/unsaved indicator** — Add `* UNSAVED CHANGES` indicator (with pulse animation) to the threshold editor when thresholds are modified but not yet saved.
- **Fix M-GAP: Reset-to-defaults button** — Add a reset button to the threshold editor that calls the backend default thresholds and restores them.
- **Fix M-GAP: PNG export panel gap** — Add missing 16px vertical gap between subplot canvases in `exportChartsToPng.ts` canvas compositing loop.
- **Fix M-GAP: `mapToOscillator` null returns** — Ensure `web/src/lib/oscillator.ts` returns `0.0` (not `null`) for out-of-range values so downstream consumers never see `null` scores.
- **Fix M-GAP: Loading state for composite charts** — Add a loading spinner/overlay in `ValuationStudio.tsx` while initial data fetch is in flight.
- **Fix M-GAP: Error state with retry** — Add an error panel with retry button in `ValuationStudio.tsx` when the initial API call fails.
- **Add M-GAP: Bulk config defaults API endpoint** — Add `GET /api/v1/quant/metrics/defaults` endpoint returning all 17 indicator default threshold configs.

## Capabilities

### New Capabilities
- `valuation-studio-crosshair-fix`: Correct Y-position crosshair synchronization across all composite and detail chart panels using real data-value lookup
- `valuation-studio-score-fix`: Remove double-scaling to restore accurate `[-2.0, +2.0]` score display and sparkline rendering
- `valuation-studio-renormalize-flow`: Renormalize stored normalized scores immediately after threshold config save via new backend endpoint
- `valuation-studio-reference-lines`: Complete reference line sets on composite (5 lines) and detail oscillator (5 lines) panels
- `valuation-studio-threshold-editor-ux`: Restore direction badge, dirty indicator, and reset-to-defaults to threshold editor
- `valuation-studio-loading-error-states`: Add loading spinner and error+retry UI to composite view initial data load

### Modified Capabilities
- `metric-detail-chart`: Threshold save flow now calls renormalize endpoint; oscillator reference lines extended to 5; direction badge and dirty state restored
- `metric-sparklines`: Score multiplier removed; sparkline values now correctly bounded to `[-2.0, +2.0]`
- `chart-png-export`: 16px panel gap added to canvas compositing
- `unified-api-gateway-routes`: New renormalize endpoint and bulk defaults endpoint added

## Impact

- **Systems affected:** `quant-btc-valuation-system` (Valuation System #1 only — LTTD, MTTD, Ichimoku unaffected)
- **Frontend files:** `web/src/components/studios/ValuationStudio.tsx`, `web/src/components/studios/MetricDetailChart.tsx`, `web/src/lib/oscillator.ts`, `web/src/utils/exportChartsToPng.ts`
- **Backend files:** `src/api/routes/metrics.ts` (Hono API gateway on port `:8765`)
- **Database:** No schema changes; only runtime renormalization of existing `unified_component_signals.normalized_score` values
- **Causal filter:** All data transformations remain causal — renormalization reads stored `master_ohlcv` and `timeseries_metrics` data at already-closed time steps; no lookahead bias introduced

## Non-goals

- LTTD, MTTD, and Ichimoku studio parity fixes are out of scope for this change
- Minor cosmetic differences (color opacity, font size, filename naming) are deliberately not fixed
- `quant-technical-indicator-bank` is deprecated and must remain untouched
- No changes to Python pipeline, HMM, PCA, or data ingestion layers
