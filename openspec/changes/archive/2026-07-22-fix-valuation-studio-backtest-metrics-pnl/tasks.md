## 1. Backend SDCA Engine PnL & Metrics Computation

- [x] 1.1 Update `computeSdcaBacktest` in `src/lib/sdcaBacktest.ts` to calculate realized and position Net PnL ($ USD amount and % return) for every trade log entry.
- [x] 1.2 Update metric tracking in `src/lib/sdcaBacktest.ts` to compute accurate Win Rate (percentage of winning sell trades), Profit Factor, Strategy & Benchmark Sharpe Ratios, CAGR, Volatility, Max Drawdown, and Average Cost Basis.
- [x] 1.3 Ensure `equity_curve` contains complete, continuous daily dates matching `dailyData` chronologically without gaps.

## 2. Frontend Valuation Studio Rendering & Synchronization

- [x] 2.1 Update `ValuationStudio.tsx` to map `trade_log` entries with proper `$ USD` and `% PnL` values in the `Causal Execution Log` table with bull/bear color styling.
- [x] 2.2 Update `ValuationStudio.tsx` to populate all metric cards in the `BACKTEST CONFIG` bar (Win Rate, Profit Factor, Total Trades, Sharpe vs Market, CAGR vs Hold, Volatility, Max Drawdown, Total Return, Avg Cost Basis) cleanly without `NaN` or 0 fallbacks.
- [x] 2.3 Align `cumStrat` and `cumMarket` equity series in `ValuationStudio.tsx` to guarantee 1-to-1 time-bar synchronization with the main BTC price candlestick chart.

## 3. Verification & Validation

- [x] 3.1 Execute unit tests (`cd web && bun test src/lib/__tests__/sdcaEngine.test.ts`).
- [x] 3.2 Execute Playwright E2E test suite (`cd web && npx playwright test`).
- [x] 3.3 Execute system pipeline report (`python3 run_report_pipeline.py`).
