## Why

The SDCA runtime was flipped during the prior optimization work, causing the engine and some UI surfaces to interpret `valuation_composite` in the wrong direction. The existing SDCA specifications already describe the original convention, so we need to restore the implementation and re-align downstream displays to the documented contract.

## What Changes

- Restore the original SDCA sign convention across the signal engine: **negative composite = overvalued / DCA-out**, **positive composite = undervalued / DCA-in**.
- Revert the SDCA multiplier, phase detection, entry/exit rules, and regime confidence logic to the original threshold semantics.
- Align the server-side backtest and API responses with the restored convention so `/api/v1/sdca/signal` and `/api/v1/sdca/backtest` produce consistent buy/sell behavior.
- Update the SDCA studio panel, valuation-studio banners, and related chart labels so the displayed thresholds and indicators match the restored convention.
- Sync the shared frontend/backtest helpers so the UI and backend remain byte-for-byte consistent where they share logic.
- Preserve strict t-1 causal filtering and all current portfolio/accounting behavior.

## Capabilities

### New Capabilities

- `sdca-convention-consistency`: Keep SDCA signal interpretation, backtest execution, and UI labels aligned to one canonical sign convention across engine, API, and studio surfaces.

### Modified Capabilities

<!-- None. The existing SDCA and valuation specs already describe the restored convention; this change realigns implementation to those contracts. -->

## Non-goals

- Do not change the `valuation_composite` calculation itself.
- Do not alter LTTD, MTTD, or Ichimoku signal-generation logic.
- Do not reintroduce or reference the deprecated `quant-technical-indicator-bank`.
- Do not change causal filtering; all SDCA logic must remain strictly t-1 causal.
- Do not redesign unrelated dashboard or chart components outside the SDCA / valuation surfaces.

## Impact

- Affects the SDCA strategy engine, backend backtest API, shared frontend/backtest helpers, and the SDCA/valuation studio UIs.
- No database schema changes are expected.
- No new external dependencies are required.
- The Valuation, LTTD, MTTD, and Ichimoku core calculations remain unchanged; only SDCA-facing interpretation and presentation are updated.
