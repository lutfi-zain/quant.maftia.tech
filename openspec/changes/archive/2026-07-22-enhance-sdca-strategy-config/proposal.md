## Why

The current Strategic Dollar Cost Averaging (SDCA) engine uses static single-point triggers and pre-defined presets. Quantitative backtests across 4,500+ daily Bitcoin records demonstrate that a 4-phase Hysteresis State Machine with configurable parameters (`dca_in_start` ≥ +1.80, `all_in` ≤ +1.50, `dca_out_start` ≤ -1.50, `all_out` ≥ 0.00) achieves superior risk-adjusted returns (+41,282% vs +6,700% Buy & Hold, Sharpe 1.20, Max Drawdown 64.36% vs 83.40%). Users require the ability to customize these thresholds interactively from the Valuation Studio UI and trigger real-time backend recalculations.

## What Changes

- Enhance the SDCA Engine (`src/lib/sdcaEngine.ts` and `src/lib/sdcaBacktest.ts`) with a 4-state Hysteresis State Machine (`OUT_ALL` → `DCA_IN` → `ALL_IN` → `DCA_OUT` → `OUT_ALL`).
- Extend `SdcaThresholds` interface to support configurable hysteresis thresholds: `dca_in_start`, `all_in_val`, `dca_out_start`, and `all_out_val`.
- Update `POST /api/v1/sdca/backtest` in the API gateway (`src/api/routes/sdca.ts`) to accept custom hysteresis parameters and recalculate equity curves, trade logs, and metrics dynamically.
- Add interactive parameter controls (number inputs / sliders) to `SdcaPanel.tsx` in `ValuationStudio.tsx` with a "Save & Recalculate" action.
- Update `useStudioBacktest` or SDCA backtest hooks to trigger live re-fetching and chart re-rendering upon parameter save.

## Capabilities

### New Capabilities
- `sdca-configurable-strategy`: Interactive frontend configuration for SDCA hysteresis strategy thresholds and live backend recalculation.

### Modified Capabilities
- `sdca-backend-computation`: Extend server-side TypeScript SDCA engine and `POST /api/v1/sdca/backtest` endpoint to support hysteresis state machine threshold parameters while enforcing strict $t-1$ causal filtering.

## Non-Goals

- Modifying the 4 core quantitative calculation engines (Valuation, LTTD, MTTD, Ichimoku) database schema or pipeline data ingestion.
- Changing `master_ohlcv.close` canonical price sourcing or SQLite WAL connection modes.
- Reintroducing deprecated components such as `quant-technical-indicator-bank`.

## Impact

- **Backend API**: `POST /api/v1/sdca/backtest` JSON request schema extended with `thresholds` object (`dca_in_start`, `all_in_val`, `dca_out_start`, `all_out_val`).
- **Shared Engine**: `src/lib/sdcaEngine.ts` and `src/lib/sdcaBacktest.ts` state transition logic enhanced with hysteresis rules.
- **Frontend SPA**: `web/src/components/studios/SdcaPanel.tsx` and `web/src/components/studios/ValuationStudio.tsx` UI parameter controls and API integration.
