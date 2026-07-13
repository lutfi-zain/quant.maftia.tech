## Context

We have successfully audited `IchimokuTerminal.tsx` (`quant-lttd-ichimoku`) and synchronized its frontend simulation (`studioBacktest.ts`), trade execution logs (`trades`), equity curves (`cumStrat` & `cumMarket`), crosshair alignment, and $85\text{px}$ locked Y-axis with the canonical Python engines ($100\%$ pass rate across $22/22$ performance card checks and $12,410+$ daily points). To maintain professional-grade consistency and institutional trust across all 4 defense layers, the remaining three studios (`ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx`) must undergo the exact same rigorous audit and alignment process.

## Goals / Non-Goals

**Goals:**
- Enforce exact $1:1$ causal friction (`ActivePos[t] = Pos[t-1]`) and transition transaction cost calculation inside simulation hooks (`useStudioBacktest` or studio-specific simulation logic) across `ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx`.
- Standardize exact trade execution logs (`trades` array) across all studios with exact integer trade counts, win rates, and return percentages matching backend backtest outputs.
- Ensure all studios display exact strategy vs benchmark equity curves (`cumStrat` vs `cumMarket`) without window re-basing drift.
- Enforce `rightPriceScale: { minimumWidth: 85 }` and bidirectional real-time Vertical Crosshair Synchronization across all vertically stacked subplots in `ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx`.
- Create and execute domain verification scripts (`verify_valuation_studio_metrics_1to1.py`, `verify_lttd_studio_metrics_1to1.py`, `verify_mttd_studio_metrics_1to1.py`) asserting $100\%$ identity with zero rounding drift ($|a - b| < 10^{-6}$).

**Non-Goals:**
- Out of scope: Modifying the deprecated `quant-technical-indicator-bank` (`05. Indicator Bank`).
- Out of scope: Changing canonical indicators inside `MasterOHLCV` or underlying statistical algorithms unless required to fix zero-division errors.

## Decisions

### Decision 1: Shared vs Domain-Specific Simulation Logic
- **Approach**: Extend `studioBacktest.ts` to support domain-specific signal extraction or ensure each studio passes standardized `DailyAnalyticsPoint[]` structures into `useStudioBacktest`.
- **Rationale**: Centralizing the compounding ($E_N^{(365.25 / N)} - 1$), volatility ($\sigma_{\text{daily}} \times \sqrt{365.25}$), peak-to-trough Max Drawdown, and trade transition state machine (`0 -> 1`, `1 -> 0`) in `studioBacktest.ts` guarantees that any bug fix or precision enhancement automatically propagates to Valuation, LTTD, MTTD, and Ichimoku simultaneously.

### Decision 2: Crosshair Synchronization & $85\text{px}$ Y-Axis Locking
- **Approach**: Apply `syncYAxisWidth(containerRef, [rightPriceScale, ...])` and bidirectional crosshair subscription hooks (`subscribeCrosshairMove` -> `setCrosshairPosition`) across all multi-pane subplots inside `ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx`.
- **Rationale**: Prevents horizontal tick misalignment caused by differing label widths on desktop viewports (`≥768px`).

## Risks / Trade-offs

- **[Risk: Signal structure differences across Valuation, LTTD, and MTTD]** → **Mitigation**: Standardize position extraction inside each studio before passing into `useStudioBacktest` (`valuation_composite >= 1.5` bubble override / `<= -1.0` discount entry, `lttd_regime == BULL` vs `SIDEWAYS` override, and `mttd_imo` multi-principle consensus).
- **[Risk: Floating-point precision discrepancies between JS/TS `number` and Python `float64`]** → **Mitigation**: Use double precision (`64-bit float`) math and test with a verification harness threshold of $|a - b| < 10^{-6}$.

## Migration Plan

1. Audit and refactor frontend simulation usage inside `ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx` to align exactly with `studioBacktest.ts` formulas.
2. Verify crosshair and $85\text{px}$ Y-axis locks across all subplots in those three studios.
3. Create automated Python verification scripts for each studio and execute them alongside `run_report_pipeline.py`.
4. Build the frontend (`cd web && npm run build`) and confirm zero TypeScript/Vite errors.
