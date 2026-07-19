## Context

Currently, the Strategic Dollar Cost Averaging (SDCA) backtest strategy logic resides entirely in the frontend React application (`useSdcaBacktest` and `sdcaMultiplierLocal`). When the Valuation Studio loads, it fetches historical daily data and performs the entire simulation (daily DCA injection, portfolio valuation, fee deduction, multiplier conditions) client-side. This architecture limits our ability to run large-scale grid search optimizations programmatically and violates the principle of keeping quantitative business logic centralized in the backend.

## Goals / Non-Goals

**Goals:**
- Centralize SDCA quantitative strategy logic (multipliers, thresholds, equity calculation) into Python.
- Pre-compute or dynamically compute the SDCA backtest results and metrics (CAGR, Sharpe, MaxDD, equity curve arrays).
- Serve the results via the Hono API Gateway (`:8910`).
- Remove the heavy calculation loop from the React frontend to improve Valuation Studio performance.
- Maintain the strict 85px Y-axis lock and vertical crosshair synchronization on the frontend charts.

**Non-Goals:**
- We are NOT modifying the underlying Master Valuation Composite Score calculation.
- We are NOT migrating or touching LTTD, MTTD, or Ichimoku backtests in this specific change.

## Decisions

**1. Backtest Execution Engine (Python)**
- *Decision*: We will extract the exact logic from `sdcaEngine.ts` and `studioBacktest.ts` into a new Python module (e.g., `engines/sdca_backtest_engine.py` or within the `run_report_pipeline.py`).
- *Rationale*: Python is our primary language for quantitative research. Moving it here allows for seamless integration with existing data sources (`unified_daily_analytics`) and makes grid-search optimizations natively possible.
- *Sign Convention Fix*: The Python engine will explicitly use the true backend convention where Positive = Undervalued (Buy) and Negative = Overvalued (Sell).

**2. Data Delivery Mechanism (API Gateway)**
- *Decision*: The Python pipeline will run the backtest and serialize the final result (Equity Curve, Trade Log, Metrics) into a JSON artifact or SQLite table. The Hono API (`:8910`) will expose a new route (e.g., `GET /api/v1/backtest/sdca`) that reads and serves this data.
- *Rationale*: Follows the exact same pattern as `btc_daily.json`. Keeps the API layer extremely fast and decoupled from Python execution time.

**3. Frontend Refactoring**
- *Decision*: `useSdcaBacktest` will be rewritten to simply make a `fetch()` call to the Hono API and return the pre-calculated payload. The frontend will only handle the presentation (Lightweight Charts v5.2) and mapping the data to the series.

## Risks / Trade-offs

- **Risk: Payload Size** → The daily equity curve and trade logs over 10 years can result in a large JSON payload (several megabytes).
  *Mitigation*: Ensure Hono serves the JSON with GZIP/Brotli compression enabled. If needed, downsample the equity curve for charting (though daily is usually fine for < 4000 data points).
- **Risk: UI Sync Issues** → If the backend and frontend timezone or date formatting differs, the chart markers might misalign.
  *Mitigation*: Strictly use `YYYY-MM-DD` strings for all date references between Python, API, and Lightweight Charts.
