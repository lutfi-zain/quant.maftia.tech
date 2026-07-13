## Why

The `IchimokuTerminal` frontend component and the unified data pipeline (System 04: `quant-lttd-ichimoku`) have drifted from the prior standalone system's hyper-tuned metric computation. The gap exists at every layer — **pipeline → database → API → frontend client → frontend terminal** — creating a broken data chain where synthetic and wrong-period values replace the prior system's authoritative metrics.

### Gap Inventory (Layer-by-Layer)

| # | Layer | Current State | Desired State | Impact |
|---|-------|---------------|---------------|--------|
| **G1** | **Pipeline (Python)** | `ich_data_all` only stores `imo`, `regime`, `pos`. No S_TK, S_Cloud, S_Future, S_Chikou, tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b extracted from `df_ich` DataFrame | Full extraction of all 9 additional Ichimoku columns from prior system's `generate_ichimoku_features()` output | S-component columns in DB remain NULL; Ichimoku lines never enter the unified system |
| **G2** | **Pipeline (Python)** | No `unified_component_signals` sync section for ICHIMOKU source. MTTD sync writes S_TK etc. under `source='MTTD'` but Ichimoku system's own S-components are never stored | Add `system_source='ICHIMOKU'` entries for S_TK, S_Cloud, S_Future, S_Chikou, IMO from `df_ich` | FE component breakdown table cannot show real ICHIMOKU signal scores |
| **G3** | **Database (SQLite)** | `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou` columns exist but are **ALL NULL**. No columns for Ichimoku price-level lines (tenkan, kijun, senkou_a, senkou_b) | All S-component columns populated; new `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou` columns created and populated | API and FE get NULLs for S-components; have to compute lines client-side with wrong periods |
| **G4** | **API `/api/v1/quant/daily`** | SELECT query only returns `ichimoku_imo`, `ichimoku_regime`, `ichimoku_position`. Response only returns `ichimoku_imo: { oscillator, regime, position }` — no S-components, no Ichimoku lines | SELECT includes all 9 Ichimoku columns; response includes `ichimoku_imo: { oscillator, regime, position, s_tk, s_cloud, s_future, s_chikou, tenkan, kijun, senkou_a, senkou_b, chikou }` | FE never receives S-components or Ichimoku lines from the API |
| **G5** | **API `/api/v1/quant/components`** | Endpoint supports `?system=ICHIMOKU` filtering but pipeline never populates ICHIMOKU-sourced records (`unified_component_signals` has no `system_source='ICHIMOKU'` rows from pipeline sync) | Pipeline syncs ICHIMOKU component signals → endpoint returns real data when queried | `quantClient.getComponents('quant-lttd-ichimoku')` returns empty → FE falls back to synthetic data |
| **G6** | **FE `client.ts` `getDailyAnalytics()`** | Mapping only reads `item.ichimoku_imo?.oscillator` (IMO number). Does NOT map `s_tk`, `s_cloud`, `s_future`, `s_chikou`, `tenkan`, `kijun`, `senkou_a`, `senkou_b`, `chikou` from `item.ichimoku_imo` nested object | Full mapping of all 9 nested fields to `DailyAnalyticsPoint` flat fields | Even if API returned the data, the client drops it — FE cannot access it |
| **G7** | **FE `types.ts` `DailyAnalyticsPoint`** | Has `ichimoku_s_tk?`, `ichimoku_s_cloud?`, `ichimoku_s_future?`, `ichimoku_s_chikou?` (optional) but **missing** `ichimoku_tenkan?`, `ichimoku_kijun?`, `ichimoku_senkou_a?`, `ichimoku_senkou_b?`, `ichimoku_chikou?` fields | Add missing Ichimoku line fields to the type | TypeScript prevents accessing Ichimoku line data from the API even if mapped |
| **G8** | **FE Terminal (IchimokuTerminal.tsx)** | `computeIchimokuLines()` uses periods (9, 26, 52) — standard but wrong for this system | Remove `computeIchimokuLines()`; read Ichimoku line data from `dailyData` API fields | Chart shows wrong Ichimoku lines (different periods = different signals) |
| **G9** | **FE Terminal (IchimokuTerminal.tsx)** | S-component chart fallback to synthetic values: `p.ichimoku_imo * 0.8`, `Math.sin(i * 0.08) * 0.6`, `Math.cos(i * 0.08) * 0.5`, `p.ichimoku_imo * 0.9 + Math.sin(i * 0.2) * 0.1` | Use actual `p.ichimoku_s_tk`, `p.ichimoku_s_cloud`, `p.ichimoku_s_future`, `p.ichimoku_s_chikou` from API with NULL gaps for warmup | S-component chart shows fake data that has no quantitative meaning |
| **G10** | **FE Terminal (IchimokuTerminal.tsx)** | `ICHIMOKU_COMPONENTS_METADATA` descriptions/formulas don't match prior system's `features.py` | Update to match prior system's actual DSP transformations | Breakdown table shows misleading formulas |
| **G11** | **API response format** | API returns `ichimoku_imo` as nested object `{ oscillator, regime, position }`, FE client reads `item.ichimoku_imo?.oscillator` for `ichimoku_imo` (flat number). S-components and lines need to follow same nesting pattern or be flat fields | Consistent nesting: all Ichimoku fields under `ichimoku_imo` sub-object | Resolved by FE client mapping — but the contract must be clear to avoid parsing bugs |

**Bottom line:** Every metric shown in the Ichimoku Terminal is either wrong (wrong periods), synthetic (not real data), or missing. This creates a fundamental data integrity gap for the entire Ichimoku system in the unified platform.

## What Changes

### Pipeline Layer (Python)

1. Extend `ich_data_all` dict in `run_report_pipeline.py` to extract S_TK, S_Cloud, S_Future, S_Chikou, tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b from `df_ich` after `generate_ichimoku_features()` runs.
2. Sync extracted values to `unified_daily_analytics` columns: `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou`, `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou`.
3. Add `unified_component_signals` sync section for ICHIMOKU source: S_TK, S_Cloud, S_Future, S_Chikou, IMO with `system_source='ICHIMOKU'`.

### Database Layer (SQLite)

4. Ensure `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou` columns exist (already present but NULL).
2. **Add new columns**: `ichi_tenkan REAL`, `ichi_kijun REAL`, `ichi_senkou_a REAL`, `ichi_senkou_b REAL`, `ichi_chikou REAL` to `unified_daily_analytics`.

### API Gateway Layer (TypeScript)

6. Extend the `/api/v1/quant/daily` SELECT query to include all 9 Ichimoku columns from `unified_daily_analytics`.
2. Extend the daily response `ichimoku_imo` object to include: `{ oscillator, regime, position, s_tk, s_cloud, s_future, s_chikou, tenkan, kijun, senkou_a, senkou_b, chikou }`.

### FE Client Layer (TypeScript)

8. Fix `getDailyAnalytics()` mapping to read all 9 nested Ichimoku fields from `item.ichimoku_imo` and map to flat `DailyAnalyticsPoint` fields.
2. Fix `DailyAnalyticsPoint` type to add missing `ichimoku_tenkan?`, `ichimoku_kijun?`, `ichimoku_senkou_a?`, `ichimoku_senkou_b?`, `ichimoku_chikou?` fields.

### FE Terminal Layer (React/TypeScript)

10. Remove `computeIchimokuLines()` — no more client-side Ichimoku line computation.
2. Read Ichimoku lines (tenkan, kijun, senkou_a, senkou_b, chikou) from API-provided `dailyData` fields.
3. Remove all synthetic S-component fallback code; use API-provided values only.
4. Update `ICHIMOKU_COMPONENTS_METADATA` to match prior system's actual formulas.
5. Wire breakdown table to display real component signal scores from API.

### Verification

15. Run full pipeline; confirm DB columns populated.
2. Confirm API returns new fields.
3. Visually verify FE Terminal matches prior system output.

## Capabilities

### New Capabilities

*(None — this is a corrective parity audit, not a new feature)*

### Modified Capabilities

- `ichimoku-chart-rebuild`: Change Ichimoku line periods from (9, 26, 52) to hyper-tuned (20, 60, 120) matching the prior system's `quant-lttd-ichimoku` parameters. Require S-component values from API instead of synthetic fallback. Add API-received component signals as the data source for the S-Component pane.
- `unified-analytics-persistence`: Include `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou` in the sync pipeline specification. These columns already exist in the actual DB schema but are never populated — the spec must reflect the pipeline requirement to fill them.
- `data-ingestion-and-wal-pipeline`: Require extraction of Ichimoku S-component feature data from the `quant-lttd-ichimoku` system's output DataFrame during pipeline sync.
- `pipeline-metrics-parity-verification`: Add Ichimoku-specific parity checks (IMO, S_TK, S_Cloud, S_Future, S_Chikou) between pipeline output and prior system output.

## Impact

| Layer | File(s) | Change | Gaps Addressed |
|-------|---------|--------|----------------|
| **Python Pipeline** | `run_report_pipeline.py` | Extract S_TK/S_Cloud/S_Future/S_Chikou/tenkan/kijun/senkou_a/senkou_b from Ichimoku system output; sync to `unified_daily_analytics` and `unified_component_signals` w/ source='ICHIMOKU' | G1, G2, G3 |
| **Database Schema** | `run_report_pipeline.py` (CREATE TABLE) | Add `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou` columns to `unified_daily_analytics` CREATE TABLE | G3 |
| **API Route** | `src/api/routes/daily.ts` | SELECT all 9 Ichimoku columns; add `s_tk`, `s_cloud`, `s_future`, `s_chikou`, `tenkan`, `kijun`, `senkou_a`, `senkou_b`, `chikou` to response `ichimoku_imo` object | G4, G11 |
| **FE Client** | `web/src/api/client.ts` | Map all 9 Ichimoku nested fields from API response to flat `DailyAnalyticsPoint` fields | G6 |
| **FE Types** | `web/src/api/types.ts` | Add `ichimoku_tenkan?`, `ichimoku_kijun?`, `ichimoku_senkou_a?`, `ichimoku_senkou_b?`, `ichimoku_chikou?` to `DailyAnalyticsPoint` | G7 |
| **FE Terminal** | `web/src/components/studios/IchimokuTerminal.tsx` | Remove `computeIchimokuLines()`; use API-provided lines; replace synthetic S-components with real values; fix metadata; use real component signal scores | G8, G9, G10 |
| **Specs** | `ichimoku-chart-rebuild/spec.md` | Delta spec: API contract, removed client-side compute, removed synthetic fallback | G4, G6, G7, G8, G9, G10, G11 |
| **Specs** | `unified-analytics-persistence/spec.md` | Delta spec: new columns, ICHIMOKU source sync | G2, G3 |
| **Specs** | `data-ingestion-and-wal-pipeline/spec.md` | Delta spec: full Ichimoku feature extraction | G1 |
| **Specs** | `pipeline-metrics-parity-verification/spec.md` | Delta spec: S-component and line parity checks | G1, G3, G4 |
| **Verification** | `verify_pipeline_api_parity.py` | Add Ichimoku metric validation | All gaps verified |

**No new dependencies.** All changes are within the existing 4-system ecosystem. No impact on Valuation, LTTD, or MTTD systems.

**Zero lookahead bias confirmed.** All Ichimoku computations in the prior system use strictly causal formulas. The pipeline sync is date-keyed with t-1 causal filter enforcement.

## Non-goals

- No changes to the `quant-lttd-ichimoku` prior system source code (features.py, strategy.py, server.py) — the source of truth for metric calculation remains untouched.
- No changes to MTTD or its S-component signals — MTTD's Ichimoku features are its own computation; the pipeline must carry the Ichimoku system's values separately with source='ICHIMOKU'.
- No changes to Valuation or LTTD systems.
- No deprecation of legacy components (quant-technical-indicator-bank is not touched).
