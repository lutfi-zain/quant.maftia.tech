## 1. Engine Schema & Query Updates

- [x] 1.1 Update `DailyRecord` in `engines/valuation/quant/sdca/engine.py`, `src/lib/sdcaEngine.ts`, and `web/src/lib/sdcaEngine.ts` to include `lttd_regime`, `lttd_prob_bull`, and `mttd_er`
- [x] 1.2 Update SQL queries in `scripts/calculate_sdca_backtest.py` and `src/api/routes/sdca.ts` to select `lttd_regime`, `lttd_prob_bull`, and `mttd_er` from `unified_daily_analytics`

## 2. BUY_ALL Confluence Implementation
- [x] 2.1 Replace MA200 crossover logic in `engines/valuation/quant/sdca/engine.py` with LTTD Bull probability ($P_{\text{Bull}} \ge 0.60$) and Kaufman ER ($ER \ge 0.20$) condition
- [x] 2.2 Replicate identical confluence trigger in TypeScript engine (`src/lib/sdcaEngine.ts` and `web/src/lib/sdcaEngine.ts`)

## 3. Verification & Testing

- [x] 3.1 Run `bun test src` in `web/` to verify SDCA engine unit tests with new parameters
- [x] 3.2 Run `python3 scripts/test_sdca_performance.py` or backtest verification script
