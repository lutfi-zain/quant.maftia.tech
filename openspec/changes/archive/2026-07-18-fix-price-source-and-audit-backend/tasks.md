## 1. Pipeline Price Source Fix (Critical Data Integrity)

- [x] 1.1 Modify `run_report_pipeline.py` to always use `master_ohlcv.close` for `btc_price` instead of `val_btc_all.get(dt)` — remove the bitview.space fallback for this field
- [x] 1.2 Create backfill script `scripts/backfill_btc_price.py` that updates all existing `unified_daily_analytics.btc_price` to match `master_ohlcv.close`
- [x] 1.3 Run backfill script and verify zero divergences remain via `SELECT COUNT(*) FROM unified_daily_analytics u LEFT JOIN master_ohlcv m ON u.date = m.date WHERE ABS(u.btc_price - m.close) > 0.01`
- [x] 1.4 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` and confirm pipeline completes without errors

## 2. Frontend Position Truth (MttdConsole & ValuationStudio Fixes)

- [x] 2.1 Fix `MttdConsole.tsx` to use `mttd_position` from `dailyData.mttd_imo.position` instead of computing `imo > 0.15 && er >= 0.20 && entropy <= 2.30 ? 1 : 0`
- [x] 2.2 Fix `ValuationStudio.tsx` to use `ichimoku_position` from database when available, with console.warn fallback to `0.0` when NULL
- [x] 2.3 Verify `LttdLab.tsx` already uses `lttd_exposure` from database (confirm no fallback recomputation exists)
- [x] 2.4 Run frontend build `cd web && bun run build` and confirm zero TypeScript errors

## 3. Backend SDCA Engine (Server-Side Computation)

- [x] 3.1 Extract SDCA engine logic from `web/src/lib/sdcaEngine.ts` into shared `src/lib/sdcaEngine.ts` module
- [x] 3.2 Create `src/lib/sdcaBacktest.ts` with `computeSdcaBacktest()` function that复现 `useSdcaBacktest()` logic using `master_ohlcv.close`
- [x] 3.3 Add `POST /api/v1/sdca/signal` endpoint to Hono gateway that calls `computeSdcaSignal()` from shared module
- [x] 3.4 Add `POST /api/v1/sdca/backtest` endpoint to Hono gateway that calls `computeSdcaBacktest()` from shared module
- [x] 3.5 Update `web/src/lib/sdcaEngine.ts` to re-export from shared `src/lib/sdcaEngine.ts` (maintain backward compatibility)

## 4. Audit Monitoring Endpoint

- [x] 4.1 Add `GET /api/v1/audit/price-comparison` endpoint that queries divergent `btc_price` vs `master_ohlcv.close` records
- [x] 4.2 Add query parameter `threshold` (default: 1.0) to filter divergences by absolute difference
- [x] 4.3 Test endpoint returns correct format: `{"status": "clean"|"divergent", "divergences": N, "data": [...]}`

## 5. Verification Script Overhaul

- [x] 5.1 Rewrite `verify_lttd_studio_metrics_1to1.py` to call `GET /api/v1/lttd/backtest` and compare against frontend output
- [x] 5.2 Rewrite `verify_valuation_studio_metrics_1to1.py` to compare against backend API (not self-verifying)
- [x] 5.3 Create `verify_sdca_metrics_1to1.py` that compares frontend SDCA output against `POST /api/v1/sdca/backtest`
- [x] 5.4 Run all verification scripts and confirm they pass with backend API comparison

## 6. Final Integration Verification

- [x] 6.1 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` end-to-end
- [x] 6.2 Verify `GET /api/v1/audit/price-comparison` returns `{"status": "clean", "divergences": 0}`
- [x] 6.3 Verify `GET /api/v1/lttd/backtest` metrics match frontend `useStudioBacktest()` output within 0.01% tolerance
- [x] 6.4 Verify `POST /api/v1/sdca/backtest` returns valid equity curves and metrics
- [x] 6.5 Run `cd web && bun run build` and confirm frontend builds successfully
