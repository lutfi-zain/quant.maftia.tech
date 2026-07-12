# Track G — API Routes & Data Parity Audit

**Auditor**: Subagent Track G  
**Date**: 2026-07-11  
**Files examined**: 7 source files across unified and prior systems

---

## 1. Metric Timeseries Endpoint — Data Shape Comparison

### Finding G1 — MAJOR: Response shape differs structurally

| Aspect | Unified (`GET /api/v1/quant/metric/:name`) | Prior (`GET /api/metrics/:name`) |
|--------|-----------|-------|
| Response shape | `{ status, metric_name, causal_filter, count, data: { raw_values[], normalized_values[], btc_ohlc[] } }` | `MetricDataPoint[]` (flat array: `{ date, raw_value, normalized_value, btc_price \| null }`) |
| BTC data | Full OHLC candlestick `{ date, open, high, low, close }[]` | Single `btc_price: number \| null` |
| Normalized values | Separate array aligned by date | Included per-point |
| Causal filter | Server-side metadata in response | Not in response |

**Impact**: The unified system provides richer data (full OHLC for candlestick charts instead of just close price). The flat array in the prior system was simpler but lacked the granularity needed for candlestick rendering. The unified `MetricDetailChart.tsx` correctly uses the new nested shape. **No migration issue** — the frontend was built for this shape.

**Severity**: Major (structural difference, but intentional and supported by frontend)

---

## 2. Date Intersection — SQL INNER JOIN vs JavaScript Set Intersection

### Finding G2 — MINOR: Both use JavaScript Map intersection, functionally equivalent

The spec incorrectly assumed the unified system used SQL INNER JOIN. Both systems use JavaScript in-memory date intersection:

- **Prior** (`MetricDetail.tsx`): Client-side `btcDates = new Set(filteredBtcData.map(d => d.date.substring(0, 10)))` then `.has()` filter
- **Unified** (`src/api/routes/metrics.ts`): Server-side `rawMap = new Map(raw_values_raw.map(r => [r.date, r.value]))` then `Array.from(rawMap.keys()).filter(date => btcMap.has(date))`

Both produce identical date-aligned output. The unified system does this server-side, reducing redundant data transfer and ensuring chart-ready data arrives already aligned.

**Severity**: Minor (incorrect assumption in spec; implementation is correct and better)

---

## 3. Config GET Endpoint

### Finding G3 — MAJOR: No bulk config endpoint

| Aspect | Unified | Prior |
|--------|---------|-------|
| Single config | `GET /api/v1/quant/metric/:name/config` → `{ status, metric_name, thresholds: {...} }` | `GET /api/metrics/config/:name` (inferred) |
| Bulk configs | **Not available** | `GET /api/metrics/configs` → `MetricConfig[]` array of all thresholds |
| Defaults endpoint | **Not available** | `GET /api/metrics/config/defaults` → `MetricConfig[]` with seed values |
| Fallback behavior | Falls back to hardcoded `DEFAULT_THRESHOLDS` object | Falls back to database seed values |

**Impact**: The unified system has no bulk config endpoint or defaults endpoint. The prior `ThresholdEditor.tsx` used `fetchMetricConfigDefaults()` for the "reset to defaults" feature — this is broken in the unified system. The defaults are hardcoded in the backend `DEFAULT_THRESHOLDS` object rather than being queryable via API.

**Severity**: Major (missing defaults endpoint breaks reset functionality)

---

## 4. Config POST Endpoint

### Finding G4 — MAJOR: Missing `renormalizeMetric` call after save

| Aspect | Unified | Prior |
|--------|---------|-------|
| Endpoint | `POST /api/v1/quant/metric/:name/config` | `POST /api/metrics/config` |
| SQL | `INSERT OR REPLACE INTO metric_config ... VALUES (?, ?, ?, ?, ?, ?)` | `INSERT OR IGNORE` (seed) + direct UPDATE |
| WAL mode | ✅ `PRAGMA journal_mode=WAL` on db open | ✅ WAL (via `db_connector.py`) |
| Parameterized | ✅ All parameters via `?` placeholders | ✅ |
| Renormalize after save | ❌ **Not called** | ✅ `renormalizeMetric(metricName)` called after config save |
| Response | `{ status: "saved", metric_name, thresholds }` | `{ success: boolean }` |

**Critical**: The prior system's save flow was:

1. Save thresholds to `metric_config` table
2. Call `renormalizeMetric(metricName)` which recalculates normalized scores in `timeseries_metrics` using new thresholds
3. Refresh dashboard data

The unified system only does step 1. This means after saving new thresholds, the `timeseries_metrics` table's `normalized_value` column is NOT recalculated. The `MetricTimeseriesResponse` endpoint serves `normalized_values` from `unified_component_signals` (which is pipeline-derived), NOT from the subsystem `timeseries_metrics`. However, the raw metric values from `timeseries_metrics` will have incorrect normalized values if the thresholds change.

**Actually, re-examining the data flow**: The unified `getMetricTimeseries` endpoint fetches:

- `raw_values` from subsystem `timeseries_metrics` (always raw, not recalculated)
- `normalized_values` from `unified_component_signals` (pipeline-derived, won't reflect new thresholds until pipeline runs again)
- `btc_ohlc` from `master_ohlcv`

So the save config + renormalize flow is less critical in the unified system because normalized values come from the pipeline's `unified_component_signals`, not from the subsystem DB. But the `MetricDetailChart.tsx` computes oscillator client-side using `mapToOscillator(raw_value, thresholds)` — so the oscillator DOES update immediately in the frontend. The renormalize step only matters if someone queries the subsystem DB directly.

**Severity**: Major (flow differs; renormalize endpoint doesn't exist in unified API)

---

## 5. DEFAULT_THRESHOLDS Cross-Reference (All 17 Indicators)

### Finding G5 — PASS: All 17 threshold values match between systems

Verified all 17 indicators in `DEFAULT_THRESHOLDS` (unified backend `src/api/routes/metrics.ts`) against `seed_metric_config.py` SEED_DATA (prior system):

| # | Metric | t_minus_2 | t_minus_1 | t_zero | t_plus_1 | t_plus_2 | Match |
|---|--------|-----------|-----------|--------|----------|----------|-------|
| 1 | aviv_ratio | 2.0 | 1.0 | null | -1.0 | -2.0 | ✅ |
| 2 | aviv_nupl | 0.5 | 0.3 | null | -0.3 | -0.6 | ✅ |
| 3 | cvdd_ratio | null | null | null | 1.6 | 1.3 | ✅ |
| 4 | mvrv_z | 6.65 | 4.6 | null | 0.17 | 0.15 | ✅ |
| 5 | lth_sth_sopr_ratio | 6.9 | 3.2 | null | 0.99 | 0.73 | ✅ |
| 6 | terminal_price_ratio | 0.17 | 0.25 | null | 0.75 | 1.0 | ✅ |
| 7 | unrealized_sell_risk | 2.2 | 1.8 | null | null | null | ✅ |
| 8 | sharpe_ratio_52w | 53.0 | 42.0 | null | -10.0 | -20.0 | ✅ |
| 9 | pi_cycle_top | 0.95 | 0.7 | null | 0.45 | 0.35 | ✅ |
| 10 | vpli | 80.0 | 70.0 | null | 50.0 | 45.0 | ✅ |
| 11 | risk_metrics | 0.85 | 0.75 | null | 0.33 | 0.13 | ✅ |
| 12 | dvrsi | 73.0 | 65.0 | null | 50.0 | 42.0 | ✅ |
| 13 | williams_r | null | null | null | -70.0 | -80.0 | ✅ |
| 14 | two_year_ma | 4.2 | 3.0 | null | 1.0 | 0.7 | ✅ |
| 15 | ahr999 | 5.47 | 2.9 | null | 0.7 | 0.45 | ✅ |
| 16 | fear_greed_og | 70.0 | 60.0 | null | 50.0 | 30.0 | ✅ |
| 17 | fear_greed_cmc | 80.0 | 60.0 | null | 40.0 | 20.0 | ✅ |

**Note**: Prior seed also includes aliases (`aviv_ratio_z`, `sharpe_52w`, `pi_cycle_top_ratio`, `two_year_ma_ratio`) that the unified `DEFAULT_THRESHOLDS` doesn't include. These are legacy aliases and not needed by the unified system where metrics are accessed by canonical name.

**Severity**: None (pass)

---

## 6. Causal Filter Verification

### Finding G6 — MINOR: Unified has defense-in-depth; prior had none server-side

| Aspect | Unified | Prior |
|--------|---------|-------|
| Server-side | ✅ `causal_filter: { applied: true, max_allowed_date, effective_end_date }` in response | ❌ No server-side causal filter |
| Client-side | ✅ `verifyCausalData()` filters future dates, deduplicates, sorts | ✅ Client-side date filter only (in `fetchMetricData` callers) |
| End date enforcement | ✅ `effectiveEndDate = Math.min(query.end_date, today)` | ❌ No end date parameter |

The unified system has three layers of causal filtering:

1. Server enforces end date ≤ today
2. Response includes causal filter metadata
3. Client `verifyCausalData()` double-checks no future dates

**Severity**: Minor (unified is more robust; prior was acceptable)

---

## 7. mapToOscillator — Backend vs Frontend vs Prior Inline

### Finding G7 — MAJOR: Return value differs for out-of-range values

Three implementations compared:

1. `src/lib/oscillator.ts` (unified backend) — lines 1-160
2. `web/src/lib/oscillator.ts` (unified frontend) — lines 1-143
3. `AvivRatioChart.tsx` inline (prior frontend)

**Backend vs Frontend (unified):** ✅ **Identical logic** — only formatting differences:

- Backend uses `isNaN()` (global), frontend uses `Number.isNaN()` (strict)
- Backend uses `else if` chains, frontend uses early returns with `if` blocks
- **All mathematical operations and return values are identical**

**Unified vs Prior:**

Critical difference in boundary case handling:

| Scenario | Prior inline | Unified | Impact |
|----------|-------------|---------|--------|
| `is_bottom_only && !inverted && rawValue >= t_plus_1` | Returns `0.0` | Returns `null` | Prior showed neutral on chart; unified shows gap |
| `is_bottom_only && inverted && rawValue <= t_plus_1` | Returns `0.0` | Returns `null` | Same |
| `is_top_only && !inverted && rawValue <= t_minus_1` | Returns `0.0` | Returns `null` | Same |
| `is_top_only && inverted && rawValue >= t_minus_1` | Returns `0.0` | Returns `null` | Same |
| Prior had no null check for `rawValue` input | Always treated as `number` | Returns `null` if null/NaN | Prior used `Number(rawValue)` elsewhere |

**Impact on MetricDetailChart**: The client-side oscillator computation now produces `null` gaps when raw values exceed the outermost thresholds, whereas the prior system would show `0.0` (neutral). This creates visible line gaps in the oscillator chart that didn't exist before.

**Severity**: Major (visible chart difference; data points disappear instead of showing neutral)

### Finding G7b — MINOR: `mapToOscillator` in backend is unused

The `src/lib/oscillator.ts` file exists but is not imported by any route or service module. The oscillator computation happens client-side in `web/src/lib/oscillator.ts`. The backend copy appears to be dead code.

**Severity**: Minor (dead code)

---

## Additional Findings

### Finding G8 — MAJOR: No pipeline/renormalize endpoint in unified API

The prior system had:

- `POST /api/pipeline/run` — trigger data pipeline
- `POST /api/metrics/renormalize/:name` — renormalize single metric
- `GET /api/metrics/config/defaults` — fetch seed defaults

The unified system has none of these. The `MetricDetailChart.tsx` saves threshold config but has no way to trigger a pipeline re-run or renormalization.

**Severity**: Major

### Finding G9 — MINOR: Metric name case handling

Unified backend lowercases metric names (`c.req.param('metric_name').toLowerCase()`). The prior system did not lowercase. If the frontend sends mixed-case metric names, the backend will match. No issue found.

**Severity**: Minor

---

## Summary

| ID | Severity | Finding | Fix needed? |
|----|----------|---------|-------------|
| G1 | Major | Response shape differs (nested vs flat) | No, intentional & supported |
| G2 | Minor | Date intersection approach (both JS Map) | No, functionally equivalent |
| G3 | **Major** | No bulk config / defaults endpoint | Yes, add defaults endpoint |
| G4 | **Major** | No renormalize after config save | Yes, add renormalize endpoint or call |
| G5 | Pass | All 17 thresholds match ✅ | No |
| G6 | Minor | Unified has better causal filtering | No |
| G7 | **Major** | mapToOscillator returns null vs 0.0 for out-of-range | Yes, fix oscillator values |
| G7b | Minor | Backend mapToOscillator is dead code | Optional cleanup |
| G8 | **Major** | No pipeline/renormalize endpoint | Yes, add endpoint |
| G9 | Minor | Case normalization consistent | No |

### Critical: 0

### Major: 4 (G3, G4, G7, G8)

### Minor: 4 (G2, G6, G7b, G9)

### Pass: 1 (G5)