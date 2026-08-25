## 1. Engine & Schema Updates

- [x] 1.1 Update `DailyRecord` in `engines/valuation/quant/sdca/engine.py`, `src/lib/sdcaEngine.ts`, and `web/src/lib/sdcaEngine.ts` to include full 4-system consensus fields (`lttd_prob_sideways`, `lttd_target_exposure`, `mttd_imo`, `mttd_position`, `mttd_entropy`, `ichimoku_imo`, `ichimoku_position`)
- [x] 1.2 Update SQL queries in `scripts/calculate_sdca_backtest.py` and `src/api/routes/sdca.ts` to select full 4-system columns from `unified_daily_analytics`

## 2. Dynamic FSM Implementation
- [x] 2.1 Implement `check_unanimous_breakout()` and reversible 3-phase FSM in Python `engines/valuation/quant/sdca/engine.py`
- [x] 2.2 Replicate identical `checkUnanimousBreakout()` and reversible FSM in TypeScript `src/lib/sdcaEngine.ts` and `web/src/lib/sdcaEngine.ts`

## 3. Verification & Parity Testing

- [x] 3.1 Run frontend unit tests (`cd web && bun test src`) and production build (`cd web && bun run build`)
- [x] 3.2 Run parity test (`python3 verify_sdca_metrics_1to1.py`) and pipeline verification (`python3 run_report_pipeline.py`)
