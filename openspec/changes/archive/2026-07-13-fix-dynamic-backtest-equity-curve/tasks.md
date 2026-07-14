## 1. Engine Core Implementation

- [x] 1.1 Update `web/src/lib/studioBacktest.ts` to iterate over all sorted dates without filtering the loop.
- [x] 1.2 Implement flat cash padding (value = 1.0) prior to `startDate` for both curves.
- [x] 1.3 Implement compounding returns logic strictly inside the `[startDate, endDate]` range.
- [x] 1.4 Implement preservation of terminal equity values flat after `endDate` for both curves.
- [x] 1.5 Ensure KPIs (Win Rate, Profit Factor, Total Trades, Sharpe Ratio, Max Drawdown) and trades collection are calculated only within `[startDate, endDate]`.

## 2. Frontend Component Updates

- [x] 2.1 Refactor `web/src/components/studios/LttdLab.tsx` to remove the custom alignment/forward-fill loops and directly bind to `backtestResult.cumStrat` and `backtestResult.cumMarket`.
- [x] 2.2 Verify that `ValuationStudio.tsx`, `MttdConsole.tsx`, and `IchimokuTerminal.tsx` correctly bind and display the updated full-range equity curves.

## 3. Verification & Testing

- [x] 3.1 Run `python3 verify_mttd_studio_metrics_1to1.py` and other test files to confirm that TypeScript backtest metrics parity is preserved.
- [x] 3.2 Execute automated pipeline verification using `python3 /home/ubuntu/projects/run_report_pipeline.py` and confirm all checks pass.
