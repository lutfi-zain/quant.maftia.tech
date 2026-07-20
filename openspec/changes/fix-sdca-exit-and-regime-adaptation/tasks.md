## 1. Valuation Pipeline & Data Augmentation

- [x] 1.1 Modify `fetch_valuation_composite_data()` in `run_report_pipeline.py` to calculate and append `MA200` and `Price/MA200 ratio` to the data structures.
- [x] 1.2 Modify `run_report_pipeline.py` to track the running All-Time High (`ATH`) and compute `ath_drawdown_percent` dynamically during the data sync phase.
- [x] 1.3 Add schema migration in `run_report_pipeline.py` to add `price_ma200_ratio` and `ath_drawdown` columns to the `unified_daily_analytics` table.

## 2. SDCA Lifecycle Engine Implementation

- [x] 2.1 Refactor `engines/valuation/quant/sdca/engine.py` to implement the 6-state logic (`HOLD`, `BUY_DCA`, `BUY_ALL`, `SELL_DCA`, `SELL_ALL`, `NEUTRAL`).
- [x] 2.2 Implement the `BUY_ALL` trigger logic: detecting when `btc_price` crosses above `MA200` while `valuation_composite > 0.5`.
- [x] 2.3 Implement the `SELL_DCA` trigger logic: detecting when `valuation_composite <= -1.0` and `Price/MA200 ratio < 2.0`, enforcing a strict weekly execution cadence with graduated percentages (e.g., 8% at -1.0, 15% at -1.5).
- [x] 2.4 Implement the `SELL_ALL` triple-gate confirmation logic: `composite <= -1.5`, `ratio < 2.0`, and `drawdown >= 20%`. Include the safety net trigger (price drops below MA200 while composite <= -0.5).

## 3. Backtest Simulation & Validation

- [x] 3.1 Rewrite `scripts/calculate_sdca_backtest.py` to correctly track continuous position sizing (BTC holdings vs USD cash) and execute the new weekly fractional DCA entries/exits instead of boolean daily flips.
- [x] 3.2 Add a new script `scripts/validate_sdca_walkforward.py` to run Walk-Forward analysis on the 6-State SDCA Engine (Training: 2014-2021, Testing: 2021-2026) to prove out-of-sample robustness without curve-fitting.

## 4. Frontend Terminal Updates

- [x] 4.1 Update `web/src/api/types.ts` to include the new `price_ma200_ratio` and `ath_drawdown` fields in the `DailyAnalyticsPoint` interface.
- [x] 4.2 Update `ValuationStudio.tsx` SDCA Panel to display the exact current SDCA State (`BUY_DCA`, `SELL_ALL`, dll.) along with the visual `Price/MA200` ratio compression indicator.

## 5. Deployment & Audit

- [x] 5.1 Execute `python3 /home/ubuntu/projects/run_report_pipeline.py` and verify standard execution passes without database locks.
- [x] 5.2 Execute Playwright E2E tests for the frontend dashboard to ensure the new SDCA visual panel renders correctly.
- [x] 5.3 Commit the code applying Conventional Commits format.
