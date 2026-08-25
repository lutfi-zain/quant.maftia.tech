## 1. Default Threshold Updates

- [x] 1.1 Update `DEFAULT_SDCA_THRESHOLDS` in `engines/valuation/quant/sdca/engine.py`, `src/lib/sdcaEngine.ts`, and `web/src/lib/sdcaEngine.ts` to `dca_in_start: 1.70`, `all_in_val: 1.25`, `dca_out_start: -1.70`, `all_out_val: 0.40`
- [x] 1.2 Update execution sizing defaults (`dca_cash_pct: 0.07`, `sell_frac: 0.19`) in `engines/valuation/quant/sdca/backtest.py` and `src/lib/sdcaBacktest.ts`

## 2. Frontend UI Presets Update

- [x] 2.1 Update `SDCA_PRESETS` in `web/src/components/studios/SdcaPanel.tsx` with Bayesian-verified threshold sets

## 3. Verification & Pipeline Sync

- [x] 3.1 Run `cd web && bun test src` and `cd web && bun run build`
- [x] 3.2 Run parity check (`python3 verify_sdca_metrics_1to1.py`) and full pipeline (`python3 run_report_pipeline.py`)
