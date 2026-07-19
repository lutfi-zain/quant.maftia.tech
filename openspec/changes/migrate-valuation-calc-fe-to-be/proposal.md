## Why

Currently, calculations for the Valuation Studio are being performed on the Frontend (React). Moving these calculations to the Backend (Python) centralizes the quantitative logic, ensuring computational consistency, improved frontend performance, and stronger adherence to the single source of truth (`maftia_quant.db`). This guarantees strict zero lookahead bias and causal filtering in a more controlled Python environment.

## What Changes

- **Calculation Migration**: Shift all core valuation calculations from TypeScript (`src/lib/sdcaEngine.ts` used by React and API) to the Python backend.
- **API Update**: Update the Hono v4 API Gateway to serve pre-calculated valuation metrics from SQLite instead of computing them dynamically.
- **Frontend & API Refactor**: Remove TS calculation logic from Valuation Studio FE components and API routes, configuring the FE to act purely as rendering views for the data via Lightweight Charts v5.2.

## Capabilities

### New Capabilities

- `valuation-be-calculation`: Python backend logic and API endpoints to handle all Valuation Studio calculations (interpolations, indicators) directly against the `maftia_quant.db` utilizing SQLite WAL.

### Modified Capabilities

- `studio-trading-terminals`: Updating the Valuation Studio frontend to consume pre-calculated valuation data instead of computing metrics locally.

## Impact

- **Affected Code**: `quant-btc-valuation-system` Python codebase, API Gateway (`api.quant.maftia.tech`), and the Valuation Studio frontend React components.
- **Systems Impacted**: Valuation System (1 of the 4 unified quantitative systems).
- **Dependencies**: The frontend will offload processing power, relying fully on the updated backend API payload.

## Non-goals

- Modifying the core algorithms, scoring, or the 17-indicator piecewise linear interpolation logic itself (only migrating its execution context).
- Migrating calculations for other systems (LTTD, MTTD, Ichimoku) in this specific change.
- Re-introducing or touching deprecated components like `quant-technical-indicator-bank`.
