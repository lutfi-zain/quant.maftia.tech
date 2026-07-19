## Why

Currently, the `ValuationStudio.tsx` UI visualizes an execution log, chart buy/sell markers, and an equity curve that relies on a naive binary threshold backtest (`score >= 1.5 ? 0 : 1`), executed via the generic `useStudioBacktest` function. However, the studio also runs and displays the actual `SdcaEngine` logic (Strategic DCA allocation multipliers mapping the composite score to dynamic positions) in the UI overlay. This creates a severe mismatch: the charts and trade attribution logs do not reflect the actual SDCA strategy (which uses strict `t-1` causal filtering and multi-factor rules). We need to wire `ValuationStudio.tsx` to use the existing `useSdcaBacktest` engine so that the visual backtest accurately reflects the complex SDCA rules rather than a rudimentary rule.

## What Changes

- Update `ValuationStudio.tsx` to consume `useSdcaBacktest` instead of `useStudioBacktest` for its core backtest execution.
- Map the data correctly to `SdcaDailyRecord` format required by `useSdcaBacktest`.
- Render the `cumStrat` equity curve produced by `useSdcaBacktest` in the Pane 3 chart.
- Ensure the Chart Markers (Buy/Sell arrows) accurately display the SDCA Multiplier actions (e.g., `START_AGGRESSIVE_DCA`, `SELL_ALL`, `REDUCE_POSITION`) from `useSdcaBacktest`.
- Update the "CAUSAL EXECUTION LOG Completed Trade Attribution Table" to correctly render the SDCA backtest logs, including DCA multipliers and scaled values, rather than binary positions.
- Remove the binary threshold logic (`score >= 1.5 ? 0 : 1`) currently embedded in the component.

## Capabilities

### New Capabilities
- `sdca-ui-integration`: Integrating the `useSdcaBacktest` logic tightly into the frontend ValuationStudio components, ensuring dynamic DCA allocations (rather than binary positions) are visualised.

### Modified Capabilities
- `valuation-studio-parity-with-prior-system`: The Valuation Studio's charting capability is changing its requirement from displaying a simple `valuation_composite` threshold backtest to displaying a full Strategic Dollar Cost Averaging (SDCA) backtest with variable position sizing.

## Impact

- Impacted Quantitative System: **Valuation System** (specifically the frontend visualization of it via `ValuationStudio.tsx`).
- No changes to backend API, database schema, or actual engine logic in `sdcaEngine.ts` or `studioBacktest.ts`.
- The frontend `ValuationStudio` will provide correct insights matching the true mathematical strategy.

## Non-goals

- Modifying the underlying algorithms in `sdcaEngine.ts` or the mathematical execution inside `useSdcaBacktest`.
- Refactoring backend orchestration pipelines.
- Modifying LTTD, MTTD, or Ichimoku quant systems.
- Introducing any new backtest metrics that aren't already provided by `useSdcaBacktest`.
- Touching deprecated components like `quant-technical-indicator-bank`.
