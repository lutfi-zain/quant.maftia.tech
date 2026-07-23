## 1. Shared SDCA Hysteresis Engine

- [x] 1.1 Extend `SdcaThresholds` interface in `src/lib/sdcaEngine.ts` to include `dca_in_start`, `all_in_val`, `dca_out_start`, and `all_out_val` with default values (+1.80, +1.50, -1.50, 0.00).
- [x] 1.2 Update `validateThresholds()` and `mergeThresholds()` in `src/lib/sdcaEngine.ts` to validate hysteresis parameter boundaries and logical ordering (`all_in_val <= dca_in_start` and `all_out_val >= dca_out_start`).
- [x] 1.3 Update `computeSdcaSignals()` in `src/lib/sdcaEngine.ts` to execute the 4-phase Hysteresis State Machine (`OUT_ALL` → `DCA_IN` → `ALL_IN` → `DCA_OUT` → `OUT_ALL`) using $t-1$ causal filtering.
- [x] 1.4 Update `computeSdcaBacktest()` in `src/lib/sdcaBacktest.ts` to use resolved hysteresis thresholds when calculating equity curves, trade logs, and performance metrics.

## 2. API Gateway Endpoint Enhancement

- [x] 2.1 Update `POST /api/v1/sdca/backtest` in `src/api/routes/sdca.ts` to parse `thresholds` object containing hysteresis parameters from the request payload.
- [x] 2.2 Verify that `POST /api/v1/sdca/backtest` returns resolved `thresholds`, updated equity curves, trade logs, and metrics in the response payload.

## 3. Frontend UI Controls & API Integration

- [x] 3.1 Create interactive parameter input controls (number inputs & sliders) for `dca_in_start`, `all_in_val`, `dca_out_start`, and `all_out_val` inside an expandable Strategy Configuration drawer in `web/src/components/studios/SdcaPanel.tsx`.
- [x] 3.2 Add validation indicators and a "Save & Recalculate Strategy" button in `SdcaPanel.tsx` that triggers backend API recalculation without page reload.
- [x] 3.3 Connect `ValuationStudio.tsx` and `SdcaPanel.tsx` state so that `POST /api/v1/sdca/backtest` results immediately update `SdcaChart`, metric badges, and transaction ledger.

## 4. Verification & Testing

- [x] 4.1 Update `src/lib/__tests__/sdcaEngine.test.ts` and `src/lib/__tests__/sdcaBacktest.test.ts` to test hysteresis state transitions and custom threshold overrides.
- [x] 4.2 Run frontend build `cd web && bun run build` and backend typecheck to ensure zero TypeScript errors.
- [x] 4.3 Execute end-to-end pipeline verification via `python3 /home/ubuntu/projects/run_report_pipeline.py`.
