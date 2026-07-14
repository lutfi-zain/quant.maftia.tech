## 1. Database Schema & Pipeline (Python)

- [x] 1.1 Add `ichi_active_pos REAL` and `ichi_strat_net_ret REAL` to the `CREATE TABLE IF NOT EXISTS unified_daily_analytics` statement in `run_report_pipeline.py`
- [x] 1.2 Add ALTER TABLE migration logic for both new columns in the existing migration block (same pattern as `ichi_s_tk`, `ichi_s_cloud`, etc.)
- [x] 1.3 Extract `Active_Pos` and `Strat_Net_Ret` from `df_ich` after `run_backtest(df_ich, transaction_cost=0.001)` in the Ichimoku computation block
- [x] 1.4 Store extracted values as `ichi_active_pos` and `ichi_strat_net_ret` in the `INSERT OR REPLACE INTO unified_daily_analytics` parameterized query
- [x] 1.5 Run pipeline to verify: `python3 run_report_pipeline.py` completes successfully with new columns populated

## 2. API Gateway (Hono/Bun)

- [x] 2.1 Add `ichi_active_pos` and `ichi_strat_net_ret` to the SQL SELECT query in `src/api/routes/daily.ts`
- [x] 2.2 Add `active_pos` and `strat_net_ret` to the `ichimoku_imo` response sub-object in the row mapping
- [x] 2.3 Verify API returns the new fields: `curl http://localhost:8910/api/v1/quant/daily?limit=1`

## 3. Frontend Types & Data Pipeline

- [x] 3.1 Add `ichimoku_active_pos?: number` and `ichimoku_strat_net_ret?: number` to the `DailyAnalyticsPoint` interface in `web/src/api/types.ts`
- [x] 3.2 Map new fields from the API response in `web/src/api/client.ts`: `ichimoku_active_pos: item.ichimoku_imo?.active_pos ?? undefined`
- [x] 3.3 Map new fields through `web/src/context/TerminalContext.tsx` data transformation
- [x] 3.4 Verify TypeScript compilation: `cd web && bun run tsc --noEmit`

## 4. Frontend Backtest Hook Enhancement

- [x] 4.1 Add `ichimoku_active_pos?` and `ichimoku_strat_net_ret?` to `StudioDailyRecord` type in `web/src/lib/studioBacktest.ts`
- [x] 4.2 Add `referenceMode` option parameter to `useStudioBacktest` hook signature
- [x] 4.3 Implement reference path: compound equity from `ichi_strat_net_ret` directly when available
- [x] 4.4 Implement reference trade detection: use `ichi_active_pos` transitions (0→1 = entry, 1→0 = exit)
- [x] 4.5 Implement graceful fallback to existing recomputation when reference fields are NULL
- [x] 4.6 Pass `ichimoku_active_pos` and `ichimoku_strat_net_ret` to the hook from `IchimokuTerminal.tsx`
- [x] 4.7 Verify TypeScript compilation

## 5. Terminal UI: Reference Metrics Display

- [x] 5.1 Update `IchimokuTerminal.tsx` to compute reference metrics from the enhanced `useStudioBacktest` hook
- [x] 5.2 Wire the reference metrics into the metrics grid as the default display set
- [x] 5.3 Ensure interactive toggle flips metrics grid between reference and interactive values
- [x] 5.4 Add visual indicator showing which metric set is currently displayed (reference vs interactive)
- [x] 5.5 Verify end-to-end: load terminal, confirm metrics match prior system's expected values

## 6. Verification

- [x] 6.1 Run `python3 run_report_pipeline.py` and confirm data pipeline completes without errors
- [x] 6.2 Run frontend build: `cd web && bun run build` produces no TypeScript errors
- [x] 6.3 Verify API returns `active_pos` and `strat_net_ret` fields with correct values
- [x] 6.4 Run full test suite: `python3 run_report_pipeline.py`
