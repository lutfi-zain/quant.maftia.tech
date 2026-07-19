## 1. Backend Quant Migration

- [x] 1.1 Migrate SDCA strategy ledger calculations to `quant-btc-valuation-system` Python codebase.
- [x] 1.2 Migrate piecewise linear interpolation and Valuation Composite math to Python.
- [x] 1.3 Update `maftia_quant.db` schema to store continuous SDCA ledger rows and final valuation scores.
- [x] 1.4 Update `run_report_pipeline.py` to orchestrate the execution of the new Python calculations and assert pipeline verification.

## 2. API Gateway Updates

- [x] 2.1 Refactor `/api/v1/sdca/signal` and `/api/v1/sdca/backtest` in the Hono v4 API Gateway to read from pre-calculated SQLite tables instead of computing dynamically.
- [x] 2.2 Add or update `/api/valuation/metrics` route in the Hono v4 API Gateway using parameterized SQLite WAL read connections.
- [x] 2.3 Ensure API payload handles compression and optimized JSON response size.
- [x] 2.4 Delete or deprecate TypeScript calculation logic in `src/lib/sdcaEngine.ts` and `src/lib/sdcaBacktest.ts` where it overlaps with Python.

## 3. Frontend Refactor (Valuation Studio)

- [x] 3.1 Strip client-side fallback calculation logic out of `ValuationStudio.tsx` and related state stores.
- [x] 3.2 Update `ValuationStudio.tsx` to ensure it only renders payload from `/api/v1/sdca/signal` and `/api/v1/sdca/backtest`.
- [x] 3.3 Ensure the UI table maps precisely to the backend continuous transaction ledger format (action: BUY/SELL, price, amount).
- [x] 3.4 Enforce `85px` Y-axis lock and vertical sync via `syncYAxisWidth.ts` on all charts in `ValuationStudio.tsx`.

## 4. Verification & Testing

- [ ] 4.1 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` to verify pipeline orchestration runs without errors.
- [x] 4.2 Validate `ValuationStudio.tsx` renders correctly using backend data without any runtime errors.
- [ ] 4.3 Commit all changes using Conventional Commits (`quant:`, `refactor:`, `feat:`).
