## 1. Eliminate IIP Step Discontinuity in the Master Pipeline

- [x] 1.1 In `run_report_pipeline.py::fetch_valuation_composite_data()`, locate the IIP penalty application logic `raw_val = raw_val * multiplier - iip_penalty_val`.
- [x] 1.2 Modify the logic to scale the penalty proportionally: `raw_val = raw_val * multiplier - (iip_penalty_val * abs(raw_val))` to ensure a smooth, zero-cliff transition at `0.0`.

## 2. Update Python SDCA Exit Logic with Trend Confirmation

- [x] 2.1 In `engines/valuation/quant/sdca/engine.py::compute_sdca_signals()`, calculate a causal 30-day simple moving average (`sma30`) of prices. At index `i`, this must use only prices from day `0` to `i-1` for causal purity.
- [x] 2.2 In `engines/valuation/quant/sdca/engine.py::compute_sdca_signals()`, update `sell_all_trigger` to include trend confirmation: `sell_all_trigger = (comp_t1 <= t["sell_all"] and ratio_t1 < 2.0 and drawdown_t1 >= 20.0 and price_t1 < sma30_t1)` where `sma30_t1` is the 30-day price SMA up to day `t-1`.
- [x] 2.3 Similarly update the `SELL_DCA` condition to prevent selling during strong upward momentum: `comp_t1 <= t["sell_dca"] and ratio_t1 < 2.0 and price_t1 < sma30_t1`.

## 3. Update TypeScript SDCA Exit Logic for Parity

- [x] 3.1 In `web/src/lib/sdcaEngine.ts::determineAction()`, add a `trendConfirmed` parameter to the function.
- [x] 3.2 In `web/src/lib/sdcaEngine.ts::determineAction()`, restrict `SELL_ALL` and `REDUCE_POSITION` triggers using this `trendConfirmed` flag (must be `true` to sell/reduce).
- [x] 3.3 In `web/src/lib/sdcaEngine.ts::computeSdcaSignal()`, calculate the 30-day causal price average (`sma30`) up to `dayIndex - 1` and compute `trendConfirmed = dayIndex > 0 ? closes[dayIndex - 1] < sma30 : true`.
- [x] 3.4 In `web/src/lib/sdcaEngine.ts::computeSdcaSignal()`, pass `trendConfirmed` to the `determineAction` call.
- [x] 3.5 Replicate the same TS logic updates inside the backend equivalent `src/lib/sdcaEngine.ts` to keep the API server in perfect parity.

## 4. Pipeline Execution and Backtest Verification

- [x] 4.1 Run the master report pipeline `python3 run_report_pipeline.py` to re-sync corrected composite values and FSM signals.
- [x] 4.2 Run backend tests: `cd engines/valuation && python3 -m pytest quant/tests/ -v` to check for FSM regressions.
- [x] 4.3 Build the frontend to verify TS compilations: `cd web && bun run build`.
- [x] 4.4 Verify that the 2023-12-06 `SELL_ALL` false signal is eliminated, and the strategy stays in the market during the 2024-2025 cycle up-trend.

## 5. Commit Changes

- [x] 5.1 Commit the FSM exits and IIP proportional scaling fixes: `git commit -m "quant: fix SDCA premature sells by adding price trend gate and proportional IIP scaling"`.
