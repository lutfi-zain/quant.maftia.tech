## Context

The system has four unified quantitative deep-dive studios: Valuation Studio, LTTD Lab, MTTD Console, and Ichimoku Terminal. Each of these studios computes client-side dynamic backtest results (equity curves, trade logs, and metrics) using the pure TypeScript `useStudioBacktest` engine located in `web/src/lib/studioBacktest.ts`.

Currently, the backtest results return only dates within the `[startDate, endDate]` range. In most studios, this results in the equity curve lines being empty or missing outside of the sliced date range, while the candlestick price series covers the entire database history (e.g. starting in 2015). In `LttdLab.tsx`, a custom alignment and forward-fill loop was introduced that attempts to correct this, but it introduces visual bugs: it compounds the Cumulative Market return from the beginning of the data (2015) rather than indexing at 1.0 on `startDate`, and it drops the Cumulative Strategy curve back to 1.0 after `endDate`.

## Goals / Non-Goals

**Goals:**
- Unify the equity curve alignment across all 4 studios by moving padding/alignment logic into the core client-side backtesting engine (`useStudioBacktest`).
- Ensure both Cumulative Strategy and Cumulative Market curves cover the entire historical range of the dataset.
- Pad both curves to stay flat at `1.0` (cash return) for all dates prior to the backtest `startDate`.
- Preserve the final compounded equity value flat (without drops or resets to 1.0) for all dates after the backtest `endDate`.
- Keep performance metrics and trade tracking strictly bounded within the `[startDate, endDate]` window.

**Non-Goals:**
- Modifying backend python signal generation or Gaussian HMM logic.
- Modifying any SQLite schemas or database WAL configuration.
- Changing APIs or WebSocket formats.

## Decisions

### D1: Loop over entire sorted array inside `useStudioBacktest`
Rather than filtering the dataset at the beginning of `useStudioBacktest`, we will loop over the entire sorted dataset.
- **Before `startDate`**: Push flat cash values of `1.0` to `cumStrat` and `cumMarket`.
- **Between `startDate` and `endDate`**: Compute returns causally using $t-1$ position alignment, compound the equity curves, and track trades/metrics.
- **After `endDate`**: Push flat values equal to the final accumulated equity value at `endDate` to both curves.
- **Rationale**: This centralizes range-padding and alignment logic in the pure backtest engine, making it instantly available to all 4 studios, removing the need for custom alignment loops inside the components.

### D2: Simplify LttdLab chart binding
Remove the custom loop mapping `stratMap` and computing market return from 2015. Bind `backtestResult.cumStrat` and `backtestResult.cumMarket` directly to the chart series, matching the implementation of the other 3 studios.
- **Rationale**: Prevents code duplication and avoids the logic errors (market starting from 2015 and strategy dropping to 1.0 after end date) in LttdLab.

## Risks / Trade-offs

- **Risk**: Performance degradation due to looping over the entire 5800+ row dataset instead of the filtered subset.
- **Mitigation**: Pure TypeScript iterations on a 6000-element array run in less than 1-2 milliseconds on modern JS engines, so the impact is negligible and does not cause frame-rate drops.
