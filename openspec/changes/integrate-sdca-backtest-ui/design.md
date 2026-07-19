## Context

The `ValuationStudio.tsx` component is the primary frontend dashboard for the Valuation System (System 1 of 4). It currently renders three chart subplots (BTC Price, Valuation Composite, and Equity Curve) and a CAUSAL EXECUTION LOG table.

The underlying math for the Strategic DCA (SDCA) exists in `sdcaEngine.ts` (which computes signals, multipliers, and phases based on strict t-1 causal filters) and `studioBacktest.ts` (which provides `useSdcaBacktest` to compute the actual cumulative equity curve `cumStrat` and `trades` log).

However, `ValuationStudio.tsx` currently hardcodes a naive threshold:
```typescript
const pos = score >= 1.5 ? 0 : 1;
const backtestResult = useStudioBacktest(backtestData, startDate, endDate, feeBps);
```
This causes the Equity Curve (Pane 3), Chart Markers (Buy/Sell arrows), and CAUSAL EXECUTION LOG to display incorrect naive data rather than the true SDCA backtest.

## Goals / Non-Goals

**Goals:**
- Replace the usage of `useStudioBacktest` with `useSdcaBacktest` within `ValuationStudio.tsx`.
- Map the chart markers (Buy/Sell) to the `markers` output of `useSdcaBacktest`.
- Map the CAUSAL EXECUTION LOG table to the `trades` output of `useSdcaBacktest`.
- Render the correct `cumStrat` equity curve in Pane 3.
- Maintain the strict 85px Y-Axis width lock and Vertical Crosshair Synchronization required by the charting rules.

**Non-Goals:**
- Changing the underlying quantitative algorithms in `sdcaEngine.ts` or `studioBacktest.ts`.
- Changing API routes or backend database schemas.
- Modifying LTTD, MTTD, or Ichimoku studios.

## Decisions

1. **Use existing `useSdcaBacktest`:**
   - *Rationale:* The backend/logic code is already correct. `useSdcaBacktest` provides `cumStrat`, `cumMarket`, `trades`, `metrics`, and `markers`. By directly consuming this, we achieve 1:1 parity with the intended math.
   - *Alternative Considered:* Rewriting backtest logic inline in `ValuationStudio.tsx`. Rejected because it duplicates logic and introduces maintenance burden.

2. **Map `dailyData` to `SdcaDailyRecord`:**
   - *Rationale:* `useSdcaBacktest` requires `SdcaDailyRecord[]` which expects `date`, `close`, and `valuation_composite`. We will map the incoming `dailyData` (which is loosely typed `any` from `useTerminal()`) directly to this strongly typed array.

3. **Metrics Panel Updates:**
   - *Rationale:* `useSdcaBacktest` returns `SdcaBacktestMetrics` which includes SDCA-specific fields (like `totalBtcAccumulated`, `avgCostBasis`). We will need to update the metrics summary cards in `ValuationStudio.tsx` to display these SDCA metrics.

## Risks / Trade-offs

- **Risk:** Type mismatch between `useStudioBacktest`'s metrics and `useSdcaBacktest`'s metrics breaking the UI cards.
  - *Mitigation:* Ensure we carefully refactor the JSX metric cards to read from `SdcaBacktestMetrics` safely.
- **Risk:** Chart series reference breaking (e.g., if we try to plot `cumSimpleDca` but the chart only has 2 lines initialized).
  - *Mitigation:* We will initialize an additional line series for `cumSimpleDca` in the equity chart (Pane 3) if necessary, or just omit it if the UI only calls for `cumStrat` vs `cumMarket`. Currently, the UI expects `cumStrat` and `cumMarket`. We will just plot those two.
