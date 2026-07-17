## Context

The `IchimokuTerminal` (System 4 frontend studio) renders three panes: BTC/Ichimoku price chart, denoising-gates oscillator, and cumulative equity growth curve. The equity growth pane has two reference series: `refStratSeries` (green) and `refMarketSeries` (grey), fed from pre-computed Python backtest columns (`ichi_cum_strat`, `ichi_cum_market`) stored in `UnifiedDailyAnalytics`. These values are decimal cumulative returns, e.g. `0.693` means `+69.3%` cumulative growth above starting capital.

The pipeline in `run_report_pipeline.py` computes `Cum_Strat` via `(1 + df['Strat_Net_Ret'].fillna(0)).cumprod() - 1` inside `backtest.run_backtest()` — producing a **`-1` baseline** decimal. So a value of `0.693` at the end means `+69.3%` total return. The chart rendering code (lines 736–751 in `IchimokuTerminal.tsx`) applies `p.ichimoku_cum_strat * 100` before `.toFixed(2)` — converting `0.693 → 69.30%` — which is **mathematically correct**.

However, the banner metric "STATIONARY BOUNDED TANH" at line 987 has an **accuracy issue**: the label describes an intermediate computation step (the tanh normalization of raw Ichimoku components), not the final IMO oscillator output which is the SuperSmoother-filtered composite `SuperSmooth((S_TK + S_Cloud + S_Future + S_Chikou) / 4, l=7)`. The displayed value is `latestImo` — the `IchimokuDenoisedOscillator` final output — which is **post-tanh AND post-SuperSmoother**.

Additionally, there is a subtler risk in the `useStudioBacktest` reference mode path (lines 174–198 in `studioBacktest.ts`): it uses `row.ichimoku_strat_net_ret` to recompute equity independently **and** the chart simultaneously displays `ichi_cum_strat` directly. This dual-path can lead to divergence between the chart curve and the displayed metrics if `ichi_strat_net_ret` compounds differently than `ichi_cum_strat` (e.g., due to circuit breaker overrides applied at pipeline sync time that affect `ich_pos_val` but not `ichi_strat_net_ret`). The verification script `verify_ichimoku_studio_metrics_1to1.py` checks metric parity but does not test chart series point-by-point alignment.

## Goals / Non-Goals

**Goals:**
- Verify and document the exact decimal baseline format of `ichi_cum_strat` / `ichi_cum_market` in the pipeline and confirm the `×100` display conversion is correct end-to-end.
- Correct the "STATIONARY BOUNDED TANH" banner label to accurately describe the `IchimokuDenoisedOscillator (IMO)` — a SuperSmoother-filtered bounded composite oscillator `[-1.0, +1.0]`.
- Confirm the dual-path equity display (reference chart series vs. `useStudioBacktest` metrics) uses consistent data without silent divergence.
- Re-run `verify_ichimoku_studio_metrics_1to1.py` after all fixes to confirm 100% parity.

**Non-Goals:**
- No Python engine changes (`engines/ichimoku/src/`).
- No changes to other studios (Valuation, LTTD, MTTD).
- No API Gateway schema or routing changes.
- No changes to the interactive (what-if) backtest mode computation logic.
- No changes to `quant-technical-indicator-bank` (deprecated, must remain absent).

## Decisions

### Decision 1: How to label the IMO banner metric

**Choice**: Change label from `STATIONARY BOUNDED TANH` → `IMO DENOISED OSCILLATOR` with a sub-label clarifying `tanh → SuperSmoother[-1,+1]`.

**Rationale**: "Stationary Bounded Tanh" is technically accurate only for the intermediate S-component values (`S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`) before they are averaged and SuperSmoothed into the final IMO. The displayed value is the post-smoothing composite output. Using "IMO DENOISED OSCILLATOR" matches the canonical `IchimokuDenoisedOscillator` ubiquitous language from AGENTS.md and avoids misleading precision claims about which mathematical stage is being shown.

**Alternatives considered**: Keep label as-is — rejected because it creates a falsely specific description that confuses system architecture.

### Decision 2: How to verify equity curve correctness

**Choice**: Instrument a quick `console.log` trace in dev to compare `filteredDailyData.slice(-1)[0].ichimoku_cum_strat` raw value vs. the chart-displayed value, and run `verify_ichimoku_studio_metrics_1to1.py`. If raw value is `0.693` and chart shows `69.30%`, the pipeline and rendering are correct.

**Rationale**: The pipeline code at line 408 of `run_report_pipeline.py` reads `float(r["Cum_Strat"])` directly from `backtest.run_backtest()` output. `backtest.py:L27` confirms `Cum_Strat = (1 + Strat_Net_Ret).cumprod() - 1` — a decimal baseline. The `×100` in the chart renderer is therefore correct. **No code change needed** if verification confirms this.

**Alternatives considered**: Switch to storing percentage values in DB — rejected because it would break the `verify_ichimoku_studio_metrics_1to1.py` parity checks that depend on decimal arithmetic.

### Decision 3: Dual-path equity divergence risk

**Choice**: Add a visual indicator (tooltip or data-source badge) on the equity chart header to make it explicit that the reference curves are sourced from Python backend pre-computed values (`ichi_cum_strat`) while the metrics panel uses `useStudioBacktest` reference mode (daily `ichi_strat_net_ret` recomputed equity). Document the difference. Do **not** merge the two paths.

**Rationale**: The two paths exist intentionally — the pre-computed chart series provides pixel-perfect historical curves from the Python engine's full causal run (including circuit breaker overrides applied during pipeline sync), while `useStudioBacktest` reference mode allows interactive date-range re-basing and metric recalculation. Merging them would lose interactive re-basing capability.

**Alternatives considered**: Remove reference chart series and derive from `useStudioBacktest` cumulative output — rejected because `useStudioBacktest` does not apply LTTD/Valuation circuit breaker overrides (it only has `position` column already pre-gated in the DB).

## Risks / Trade-offs

- **[Risk] `ichi_cum_strat` stored as multiplier (e.g. `1.693`) not decimal** → If `run_backtest()` was accidentally called with a bug that stored `Cum_Strat + 1` (the multiplier form), chart would show `169.3%` instead of `69.3%`. **Mitigation**: Run a quick SQL probe `SELECT ichi_cum_strat FROM unified_daily_analytics ORDER BY date DESC LIMIT 5` and check the scale of values. If any value > 5.0, it's a multiplier not a decimal.

- **[Risk] Banner metric score is permanently `0`** → The `toNum()` helper in `IchimokuTerminal.tsx` handles the case where `val` is an object by checking `val.oscillator ?? val.score`. However, `ichimoku_imo` in `dailyData` is already a flat number after `client.ts` mapping. If `latestPoint?.ichimoku_imo` evaluates to `undefined` (empty daily data), `toNum()` returns `0`. **Mitigation**: Verify data is populated by checking that `latestPoint` is non-null before rendering. No code change needed if data is present.

- **[Risk] Verification script tests metrics but not chart series** → `verify_ichimoku_studio_metrics_1to1.py` validates aggregate metrics but not that each chart data point matches the Python engine's `Cum_Strat` column. **Mitigation**: Add a spot-check assertion on the first and last `Cum_Strat` values in the verification script.

## Migration Plan

1. Run SQL diagnostic on `maftia_quant.db` to confirm `ichi_cum_strat` scale (decimal vs. multiplier).
2. Apply banner label fix in `IchimokuTerminal.tsx`.
3. (Conditional) If equity curve is confirmed correct → add data-source badge on chart header only.
4. (Conditional) If equity curve is wrong → trace the pipeline and fix at the correct layer.
5. Re-run `python3 verify_ichimoku_studio_metrics_1to1.py` to confirm 100% parity.
6. Rebuild frontend: `cd web && bun run build`.
7. Git commit following Conventional Commits: `fix(ichimoku): correct IMO banner label and verify equity curve decimal baseline`.

## Open Questions

- Are there other studios (ValuationStudio, LttdLab, MttdConsole) using the same `×100` conversion pattern on pre-computed `cum_strat` columns? If so, this audit pattern should be applied to all 4 studios for consistency.
