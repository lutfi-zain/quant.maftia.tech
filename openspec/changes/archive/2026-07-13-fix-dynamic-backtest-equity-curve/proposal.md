## Why

The dynamic backtest equity curve charts across all deep-dive sandboxes are currently experiencing date-alignment discrepancies. The Cumulative Market curve compounds returns from the very beginning of the historical dataset (e.g., 2015) rather than starting from the user's selected backtest start date, while the Cumulative Strategy curve has range padding issues, drops back to 1.0 (cash) outside the window, and fails to display flat cash returns (1.0) before the start date. This proposal corrects the mathematical alignment so that both curves are correctly locked, re-indexed, and flat outside the active backtest window.

## What Changes

- Modified `useStudioBacktest` client-side backtesting engine to compute `cumStrat` and `cumMarket` over the entire historical range of the dataset, rather than returning sliced date arrays.
- Implemented flat Cash Return (1.0) padding for all dates prior to the backtest `startDate` for both Cumulative Strategy and Cumulative Market curves.
- Implemented flat Cash Return (1.0 for before start date) and forward-filled terminal equity preservation (flat at final end date value) for all dates after the backtest `endDate` for both curves.
- Removed custom range-padding and forward-filling logic from `LttdLab.tsx` to rely on the unified `useStudioBacktest` engine.
- Ensured metrics and trade logs continue to be calculated strictly within the `[startDate, endDate]` active window.
- Verified that all four deep-dive studios (Valuation Studio, LTTD Lab, MTTD Console, and Ichimoku Terminal) use the updated unified backtesting curves.

## Non-goals

- Out of scope is modifying the core backend python engines, Gaussian HMM regimes, PCA or VIF calculations.
- Out of scope is modifying the database schemas, or any deprecated components such as `quant-technical-indicator-bank`.
- We will not change any backend APIs or WebSocket broadcasts.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `studio-trading-terminals`: Both Cumulative Market and Cumulative Strategy curves must be flat at 1.0 before the backtest start date, compound starting from 1.0 on the start date, and remain flat at their final respective values after the end date.

## Impact

- **Affected Systems**: All 4 Unified Systems (Valuation, LTTD, MTTD, Ichimoku) are impacted as they all utilize the frontend client-side backtest engine.
- **Affected Files**: `web/src/lib/studioBacktest.ts`, `web/src/components/studios/LttdLab.tsx`, and potentially other studio components to ensure they bind the updated curves properly.
- **Causal Bounds**: Strict t-1 causal execution boundary is fully preserved. Zero lookahead bias is guaranteed as no future data leaks are introduced.
