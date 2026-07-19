## Why

The current SDCA (Strategic Dollar Cost Averaging) backtest logic, including the multiplier conditions and equity curve generation, is hardcoded in the frontend TypeScript codebase (`useSdcaBacktest` in `studioBacktest.ts` and `sdcaMultiplier` in `sdcaEngine.ts`). This tightly couples quantitative strategy logic to the presentation layer, making it difficult to run parameter optimizations (like grid search) and preventing other systems from consuming the same backtest data. Migrating this to the Python backend ensures a single source of truth for quantitative logic and enables much easier performance optimizations.

## What Changes

- Implement SDCA backtest engine in Python (Backend) to calculate daily portfolios, equity curves, trade executions, and performance metrics (Sharpe, MaxDD, CAGR).
- Expose a new API endpoint via the Hono API Gateway (`:8910`) to serve the pre-calculated SDCA backtest results.
- Refactor Valuation Studio Frontend to consume the backtest data from the API endpoint instead of computing it locally.
- Deprecate and remove the client-side SDCA backtest engine.
- **BREAKING**: Frontend components in Valuation Studio must be updated to expect a backend-provided data payload rather than computing the trades natively.

## Capabilities

### New Capabilities
- `sdca-backend-engine`: A Python-based backtest engine that computes the SDCA strategy (multipliers, trades, equity curves) using unified data.
- `sdca-api-endpoint`: A Hono API route that serves the computed SDCA backtest results and metrics to the frontend.

### Modified Capabilities
- `valuation-studio-ui`: Frontend Valuation Studio modified to consume backend SDCA metrics and trades instead of computing them locally.

## Impact

- **Impacted Systems**: Quant BTC Valuation System (System 1) and its associated API routes and Frontend Sandboxes.
- **Affected Code**: `web/src/lib/studioBacktest.ts`, `web/src/lib/sdcaEngine.ts`, `web/src/components/studios/ValuationStudio.tsx`, and backend API `src/api/` & python scripts.
- **API Gateway**: New endpoint route needed in Hono (`/api/v1/backtest/sdca` or similar).

## Constraints & Security Guardrails
- **Zero Lookahead Bias**: The Python engine must rigorously enforce $t-1$ causal filtering for the valuation composite score before making day $t$ buy/sell decisions.
- **Non-Goals**: We are not modifying the LTTD, MTTD, or Ichimoku studios in this change. We are also not changing the core calculation of the `ValuationComposite` score itself, only the backtest execution layer. No deprecated `quant-technical-indicator-bank` code will be referenced or touched.
