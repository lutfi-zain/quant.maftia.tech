## Context

Currently, the Valuation Studio frontend and API Gateway perform complex calculations (e.g., Valuation Composite scoring, piecewise linear interpolation, and SDCA strategy ledger generation) directly within the TypeScript environment (`src/lib/sdcaEngine.ts`). This creates divergence from the Python source-of-truth quantitative engine, risks lookahead bias, and leads to duplicated logic between Python and TypeScript.

The goal is to shift all calculation burden to the `quant-btc-valuation-system` Python backend and persist the canonical results in `unified_daily_analytics` (or a dedicated table) via SQLite WAL. The Hono v4 API Gateway will then serve these pre-calculated metrics directly to the React frontend.

## Goals / Non-Goals

**Goals:**

- Migrate all SDCA and Valuation Composite calculations from TypeScript to Python.
- Persist results in the canonical SQLite (`WAL` mode) database.
- Update the Hono v4 API Gateway (`api.quant.maftia.tech` on port `:8910`) to serve the pre-computed ledgers and metrics instead of computing them dynamically.
- Refactor Valuation Studio FE to act strictly as a dumb view using `Lightweight Charts v5.2`.
- Enforce strict Y-axis width (`85px`) and vertical crosshair sync on the charting components.

**Non-Goals:**

- Altering the mathematical formulas or strategy logic itself (this is a migration, not a strategy redesign).
- Spinning up new independent backend services outside of the unified API gateway.
- Changes to LTTD, MTTD, or Ichimoku calculations.

## Decisions

- **Python as Single Source of Truth**: All data transformations (scoring, SDCA ledgers, interpolations) will be written in Python.
  - *Rationale*: Python provides a superior quantitative environment (Pandas/NumPy) and ensures strictly causal filtering (zero lookahead bias) by tying calculations directly to the `master_ohlcv` ingestion.
- **Unified API Gateway Delivery**: The Hono v4 API will be extended with new endpoints (e.g., `/api/valuation/metrics` and `/api/valuation/sdca-ledger`) to deliver the finalized arrays directly to the frontend.
  - *Rationale*: Maintains the single API Gateway architecture requirement and avoids browser-side heavy lifting.
- **Chart Synchronization Enforcement**: The frontend will rely on `syncYAxisWidth.ts` to explicitly lock the right scale to `85px` across all Valuation Studio subplots, guaranteeing vertical alignment.
  - *Rationale*: Prevents horizontal time-tick drift when price and oscillator character widths differ, per the architectural rule.

## Risks / Trade-offs

- **[Risk] Increased DB/API payload size** → *Mitigation*: Ensure JSON responses from the Hono API are compressed/gzipped and only transfer necessary continuous ledger rows instead of full nested objects.
- **[Risk] Sync timing issues between DB and FE** → *Mitigation*: Ensure `run_report_pipeline.py` executes atomic SQLite WAL commits before the API fetches the data.
