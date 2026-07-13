## 1. Pipeline: Ichimoku Feature Extraction & DB Sync

- [x] 1.1 Extend `ich_data_all` dictionary in `run_report_pipeline.py` to extract `S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`, `tenkan_sen`, `kijun_sen`, `senkou_span_a`, `senkou_span_b` from the `df_ich` DataFrame after `generate_signals()` runs
- [x] 1.2 Update `CREATE TABLE IF NOT EXISTS unified_daily_analytics` in pipeline to ensure `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou`, `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou` columns exist (REAL type)
- [x] 1.3 Update the `INSERT OR REPLACE INTO unified_daily_analytics (...)` statement to include all 9 new Ichimoku columns with values from `ich_data_all` dictionary, using parameterized queries and WAL connections
- [x] 1.4 Add Ichimoku S-component signal sync to `unified_component_signals` section: for each date, insert S_TK, S_Cloud, S_Future, S_Chikou, IMO rows with `system_source = 'ICHIMOKU'` and computed `signal_direction`

## 2. API Gateway: Extend Daily Route Response

- [x] 2.1 Update `src/api/routes/daily.ts` SELECT query to include `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou`, `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`, `ichi_chikou` from `unified_daily_analytics`
- [x] 2.2 Update the response mapping in `daily.ts` to extend the `ichimoku_imo` object with all 9 new fields: `s_tk`, `s_cloud`, `s_future`, `s_chikou`, `tenkan`, `kijun`, `senkou_a`, `senkou_b`, `chikou` — preserving the existing `oscillator`, `regime`, `position` fields
- [x] 2.3 Verify NULL handling: when the DB returns NULL for any Ichimoku field, the JSON response MUST include the key with value `null` (not omit the key)

## 3. FE Types: Add Missing Ichimoku Line Fields

- [x] 3.1 Add `ichimoku_tenkan?`, `ichimoku_kijun?`, `ichimoku_senkou_a?`, `ichimoku_senkou_b?`, `ichimoku_chikou?` optional number fields to the `DailyAnalyticsPoint` interface in `web/src/api/types.ts`
- [x] 3.2 Verify the existing `ichimoku_s_tk?`, `ichimoku_s_cloud?`, `ichimoku_s_future?`, `ichimoku_s_chikou?` fields are present and unmodified

## 4. FE Client: Map All 12 Ichimoku Fields from API

- [x] 4.1 Update `web/src/api/client.ts` `getDailyAnalytics()` mapping to read `ichimoku_imo.s_tk`, `ichimoku_imo.s_cloud`, `ichimoku_imo.s_future`, `ichimoku_imo.s_chikou` from the nested API response and map to flat `ichimoku_s_tk`, `ichimoku_s_cloud`, `ichimoku_s_future`, `ichimoku_s_chikou` on `DailyAnalyticsPoint`
- [x] 4.2 Add mapping for `ichimoku_imo.tenkan` → `ichimoku_tenkan`, `ichimoku_imo.kijun` → `ichimoku_kijun`, `ichimoku_imo.senkou_a` → `ichimoku_senkou_a`, `ichimoku_imo.senkou_b` → `ichimoku_senkou_b`, `ichimoku_imo.chikou` → `ichimoku_chikou`
- [x] 4.3 Ensure graceful NULL handling: when API returns `null`, the mapped field SHALL be `undefined` (omitted) so FE code can safety-check with `!= null`

## 5. FE Terminal: Rebuild Ichimoku Charts with API Data

- [x] 5.1 Remove `computeIchimokuLines()` function and all client-side Ichimoku line computation from `IchimokuTerminal.tsx`
- [x] 5.2 Update BTC pane chart initialization to read Ichimoku lines (tenkan, kijun, senkou_a, senkou_b, chikou) from `ichimoku_tenkan`, `ichimoku_kijun`, `ichimoku_senkou_a`, `ichimoku_senkou_b`, `ichimoku_chikou` fields in `dailyData` instead of from `ichimokuLines` computed data
- [x] 5.3 Remove synthetic fallback code in S-Component pane data population: replace `p.ichimoku_imo * 0.8`, `Math.sin(i * 0.08) * 0.6`, `Math.cos(i * 0.08) * 0.5`, `p.ichimoku_imo * 0.9 + Math.sin(i * 0.2) * 0.1` with actual API values from `p.ichimoku_s_tk`, `p.ichimoku_s_cloud`, `p.ichimoku_s_future`, `p.ichimoku_s_chikou`
- [x] 5.4 Update `ICHIMOKU_COMPONENTS_METADATA` constants to match prior system's actual formulas, categories, and descriptions
- [x] 5.5 Clean up `displayComponents` mapping: remove dependency on `ichimokuLines` values and use real component signal scores from the API's `components` data

## 6. Verification & Pipeline Validation

- [x] 6.1 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` to populate all Ichimoku fields in the database and verify no errors
- [x] 6.2 Query `unified_daily_analytics` to confirm `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou`, `ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b` are now populated with real values (not NULL)
- [x] 6.3 Query `unified_component_signals` to confirm ICHIMOKU source entries exist for S_TK, S_Cloud, S_Future, S_Chikou, IMO
- [x] 6.4 Start the API Gateway (`bun run dev`) and verify `/api/v1/quant/daily` returns the new 12-field `ichimoku_imo` object with all S-component and Ichimoku line fields
- [x] 6.5 Query `/api/v1/quant/components?system=quant-lttd-ichimoku` and confirm it returns 5+ ICHIMOKU-sourced signal records per date
- [x] 6.6 Start the frontend and visually verify IchimokuTerminal displays correct Ichimoku lines and S-component values matching the prior system's expectations — no synthetic data, no wrong-period lines
- [x] 6.7 Update `verify_pipeline_api_parity.py` with Ichimoku-specific S-component and Ichimoku line numeric precision checks, including a cross-validation that runs `generate_ichimoku_features()` directly and compares against `unified_daily_analytics`
