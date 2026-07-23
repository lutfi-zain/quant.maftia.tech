## Context

The Valuation Studio module provides interactive SDCA strategy backtesting over historical Bitcoin valuation data. Currently, three calculation and rendering discrepancies exist in the backtest UI:
1. Trade log entries do not calculate Net PnL (USD amount and %) for all trades, causing the table column to render `-` or `$0.00` / `+0.00%`.
2. Backtest performance metrics (win rate, profit factor, buy & hold returns, market volatility, max drawdown, and average cost basis) are either unpopulated or calculated inconsistently between the backend SDCA engine and the frontend card renderers.
3. The Equity Curve subplot experiences bar index misalignment with the main BTC price chart when date arrays skip missing entries.

## Goals / Non-Goals

**Goals:**
- Calculate exact Net PnL ($ USD amount and % return) for every trade entry in `src/lib/sdcaBacktest.ts` (including both realized PnL on SELL exits and position performance on BUY trades).
- Render Net PnL cleanly in the Causal Execution Log table with proper color coding (`var(--signal-bull)` for positive PnL, `var(--signal-bear)` for negative PnL).
- Ensure all backtest metrics (win rate, profit factor, total trades, strategy & market Sharpe ratios, CAGR, annualized volatility, max drawdown, total return, and average cost basis) are calculated consistently and populated in `BACKTEST CONFIG`.
- Ensure 1-to-1 daily date alignment between the Price Chart and the Equity Curve subplot in `ValuationStudio.tsx`.

**Non-Goals:**
- Modifying the underlying mathematical formulas of the 4 unified quantitative systems (Valuation, LTTD, MTTD, Ichimoku).
- Re-introducing deprecated components (`quant-technical-indicator-bank`).

## Decisions

### 1. Dual Net PnL Calculation (Realized & Position PnL)
- For `SELL` / `ALL_OUT` trades: Calculate realized PnL in USD as `Proceeds - NetCostBasis` and % as `(Proceeds - NetCostBasis) / NetCostBasis * 100`.
- For `BUY` / `ALL_IN` / `START_DCA_IN` trades: Calculate position PnL relative to current BTC price at execution or position average cost.
- Pass `net_pnl_usd` and `profit_pct` in each `TradeLogEntry`.

### 2. Complete Backtest Metrics Payload
- In `computeSdcaBacktest`, track completed sell cycles to compute true `winRate` as `(winning_trades / total_completed_trades) * 100` and `profitFactor` as `gross_profit / gross_loss`.
- Compute market benchmark metrics (market Sharpe, market CAGR, market volatility, market max drawdown, market total return) over the exact sliced date range.
- Return all fields in the `metrics` object from `POST /api/v1/sdca/backtest` and map them directly in `ValuationStudio.tsx`.

### 3. Date-Locked Time Series Alignment
- Generate `equity_curve` for every valid date present in `master_ohlcv` / `unified_daily_analytics` without skipping dates.
- Use `date` string (`YYYY-MM-DD`) as the primary key for all Lightweight Charts series data (`cumStrat`, `cumMarket`), enforcing identical time axis ticks across subplots.

## Risks / Trade-offs

- [Risk] Missing historical BTC price on earlier dates → [Mitigation] Default to initial cash `$10,000` and `1.0` multiplier for dates before exchange price feeds start.
- [Risk] Division by zero when no sell trades occur → [Mitigation] Fallback `winRate: 0`, `profitFactor: grossProfit > 0 ? 999.0 : 0`.
