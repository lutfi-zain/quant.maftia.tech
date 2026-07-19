## Why

Critical data integrity bug discovered during calculation audit: `unified_daily_analytics.btc_price` (sourced from `bitview.space` API via the valuation engine) diverges from `master_ohlcv.close` (the canonical exchange feed) by up to $8,300 (6.3%) on 3,744 records. This dual price source causes frontend backtests to show 3,493% total return while backend API backtests show 3,086% — a 400%+ discrepancy from compounding price differences over 3,120 trading days. Additionally, the frontend recomputes positions (e.g., `MttdConsole.tsx` recalculates from raw oscillator values) instead of using authoritative database-stored positions that include circuit breaker overrides.

## What Changes

- **BREAKING**: Unify price source so `unified_daily_analytics.btc_price` always equals `master_ohlcv.close` (canonical)
- Fix `run_report_pipeline.py` to use `master_ohlcv.close` instead of `bitview.space` btc_price for the unified table
- Add `POST /api/v1/sdca/backtest` endpoint for server-side SDCA backtest computation (auditability)
- Add `POST /api/v1/sdca/signal` endpoint for server-side SDCA signal computation
- Add `POST /api/v1/portfolio/backtest` endpoint for portfolio simulation with server-side state
- Add `GET /api/v1/audit/price-comparison` endpoint for ongoing data integrity monitoring
- Fix `MttdConsole.tsx` to use `mttd_position` from database instead of recomputing in frontend
- Fix `ValuationStudio.tsx` position logic to use stored `ichimoku_position` when available
- Update verification scripts to compare frontend output against backend API (not self-verifying)
- Frontend `useStudioBacktest()` switches to `master_ohlcv.close` as price source via API

## Capabilities

### New Capabilities

- `audit-data-integrity`: Price source reconciliation, dual-source detection, and ongoing monitoring endpoints
- `sdca-backend-computation`: Server-side SDCA signal engine, backtest, and portfolio endpoints for auditability
- `frontend-position-truth`: Eliminate frontend position recomputation; all studios use database-stored positions

### Modified Capabilities

- `master-ohlcv-canonical-storage`: Add requirement that `unified_daily_analytics.btc_price` MUST equal `master_ohlcv.close`
- `local-calculation-engines`: Extend to include SDCA engine in backend computation layer

## Impact

- **Data**: `unified_daily_analytics.btc_price` column values will change (historical backfill needed)
- **Backend API**: 4 new endpoints added to Hono gateway (`:8910`)
- **Frontend**: `MttdConsole.tsx`, `ValuationStudio.tsx`, `LttdLab.tsx` position logic changes
- **Frontend lib**: `studioBacktest.ts` price source migration
- **Pipeline**: `run_report_pipeline.py` btc_price sourcing fix
- **Verification**: All `verify_*_studio_metrics_1to1.py` scripts rewritten

## Non-Goals

- Modifying the 4 core quantitative engines (Valuation, LTTD, MTTD, Ichimoku) calculation logic
- Changing the `bitview.space` data ingestion for valuation indicators (only the btc_price fallback is affected)
- Reintroducing the deprecated `quant-technical-indicator-bank`
- Changing WebSocket real-time broadcast architecture
