## Why

In the **Valuation Studio** backtest interface, users encounter three reporting and alignment issues during SDCA strategy evaluation:
1. **Missing PnL in Causal Execution Log**: The transaction ledger table displays `-` or `$0.00` / `+0.00%` for trade entries instead of calculating and showing the actual net USD dollar PnL and return percentage for each transaction.
2. **Missing Metrics in Backtest Config / Summary**: Key backtest performance metrics (win rate, profit factor, buy & hold comparative returns, market volatility, max drawdown, and average cost basis) display zero or incomplete values due to parameter mapping and trade classification gaps in the backend calculation engine.
3. **Bar / Time Index Mismatch in Equity Curve**: The equity curve subplot contains date gaps when data is missing or filtered, leading to horizontal time-bar misalignment between the main BTC price candlestick chart and the strategy equity curve.

Solving these issues ensures full transparency, mathematical accuracy, and visual synchronization across the Valuation Studio backtest studio.

## What Changes

- **Fix Net PnL Calculation in Causal Execution Log**: Update `computeSdcaBacktest` and `ValuationStudio.tsx` to calculate net PnL in USD and percentage for all executed trade log entries (both SELL exits and position tracking for BUY entries).
- **Fix Backtest Metrics Calculation & Rendering**: Ensure win rate, profit factor, Sharpe ratios (strategy vs market), CAGR, annualized volatility, max drawdown (strategy vs market), total return, and average cost basis are accurately computed in `src/lib/sdcaBacktest.ts` and mapped cleanly to the UI.
- **Synchronize Equity Curve Time Series**: Guarantee that `equity_curve` data points align 1-to-1 with daily dates in `dailyData` chronologically, eliminating missing bar gaps between the price chart and equity subplots.

## Capabilities

### New Capabilities
- `valuation-studio-backtest-reporting`: Accurate transaction PnL tracking, complete backtest performance metrics reporting, and strict 1-to-1 time-bar alignment for equity curves in Valuation Studio.

### Modified Capabilities
- None.

## Impact

- **Impacted Systems**: Valuation System (`quant-btc-valuation-system`), Backend SDCA Engine (`src/lib/sdcaBacktest.ts`), API Gateway (`src/api/routes/sdca.ts`), and Valuation Studio SPA Frontend (`ValuationStudio.tsx`).
- **Causal Guarantee**: Preserves strict $t-1$ causal filtering across all SDCA backtest metrics and signal generations. Zero lookahead bias.
- **Non-Goals**: No changes to the 4 core quantitative engines' signal formulas (LTTD HMM, MTTD IMO, or Ichimoku SuperSmoother IIR). Deprecated components (`quant-technical-indicator-bank`) remain completely untouched.
