## Why

The SDCA (Strategic Dollar Cost Averaging) thresholds are currently hardcoded in the frontend (`SdcaPanel.tsx` presets) and Python engine (`engine.py` DEFAULT_SDCA_THRESHOLDS). Users cannot customize or experiment with threshold values from the UI without editing code. This limits backtest exploration and prevents users from adapting the strategy to different risk profiles or market regimes.

## What Changes

1. **Add a threshold editor UI** in the SDCA Panel that allows users to adjust all 4 hysteresis thresholds (DCA In Start, All In Val, DCA Out Start, All Out Val) with sliders
2. **Add a new API endpoint** `POST /api/v1/sdca/recalculate` that accepts custom thresholds and recomputes the SDCA signal & backtest for the entire history
3. **Wire the FE threshold editor** to call the BE recalculate endpoint when thresholds change, then update the signal display, backtest metrics, and trade log
4. **Persist the user's custom thresholds** in `localStorage` so they survive page refresh

## Capabilities

### New Capabilities

- `sdca-threshold-editor`: Frontend threshold slider UI in the SDCA Panel with real-time validation and reset-to-preset functionality
- `sdca-recalculate-api`: Backend API endpoint that accepts custom thresholds, runs the full SDCA engine (signal computation + backtest), and returns updated results

### Modified Capabilities

- `sdca-studio-panel`: Add threshold editor sliders, preset selector, and recalculate trigger to the existing SdcaPanel component
- `sdca-strategy-engine`: The engine already supports custom thresholds via `mergeThresholds()` — no spec change needed, only implementation wiring

## Impact

- **Frontend**: `web/src/components/studios/SdcaPanel.tsx` — add threshold sliders, recalculate button, loading state
- **Backend API**: `src/api/routes/sdca.ts` — add `POST /api/v1/sdca/recalculate` endpoint
- **Backend Lib**: `src/lib/sdcaEngine.ts` / `src/lib/sdcaBacktest.ts` — already support custom thresholds, no changes expected
- **No impact** on valuation, LTTD, MTTD, or Ichimoku systems

## Non-goals

- Changing the default threshold values (the optimized defaults stay as-is)
- Adding new SDCA rules or actions (the FSM state machine is unchanged)
- Server-side persistence of custom thresholds (use `localStorage` only)
- Modifying the Python SDCA engine (`engines/valuation/quant/sdca/`)
