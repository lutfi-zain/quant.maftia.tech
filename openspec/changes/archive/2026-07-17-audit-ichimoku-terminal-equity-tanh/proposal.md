## Why

The `IchimokuTerminal.tsx` frontend contains two compounding calculation bugs: (1) the **reference equity growth curve** (`ichimoku_cum_strat` / `ichimoku_cum_market`) stores raw cumulative multiplier values (e.g. `1.693`) but the chart rendering layer double-multiplies by ×100, producing nonsensical axis values like `169.3%` instead of the correct `+69.3%`; and (2) the **"STATIONARY BOUNDED TANH" banner metric** displays the live `IchimokuDenoisedOscillator` score sourced from `ichimoku_imo?.oscillator`, but the fallback chain resolves the entire `ichimoku_imo` response object (a nested record containing `oscillator`, `regime`, `s_tk`, etc.) as a numeric `0` when the field is an object — silently zeroing the readout whenever the API delivers the canonical nested JSON structure. Both bugs undermine the terminal's core promise of 1:1 Python–frontend arithmetic parity.

## What Changes

- **Fix equity curve rendering** — `ichi_cum_strat` / `ichi_cum_market` in `UnifiedDailyAnalytics` already store decimal cumulative returns (e.g. `0.693 = +69.3%`). The chart currently renders `p.ichimoku_cum_strat * 100` correctly — but the **`studioBacktest.ts` reference mode path** uses `ichimoku_strat_net_ret` (daily net return, already correct) and accumulates its own `stratEquity`, then also reads from the pre-computed `ichimoku_cum_strat` series for the reference chart series. These two paths must not be mixed. The root issue is that `refStratSeries` and `refMarketSeries` in the chart are fed from the `ichimoku_cum_strat` / `ichimoku_cum_market` columns **directly** (lines 736–751 of `IchimokuTerminal.tsx`), while `useStudioBacktest` in reference mode **independently recomputes** equity using `ichimoku_strat_net_ret`. The reference chart series and `useStudioBacktest` display metrics must use the **same data source** — the pre-computed Python backtest columns — with a single consistent `×100` conversion on a **decimal** base value. Verify the pipeline stores `Cum_Strat - 1` (not `Cum_Strat`) for zero-baseline arithmetic.
- **Fix STATIONARY BOUNDED TANH display** — `toNum()` in `IchimokuTerminal.tsx` correctly handles object-shaped values via `val.oscillator ?? val.score ?? ...`, but the `latestImo` derivation path (line 922) calls `toNum(latestPoint?.ichimoku_imo)` where `ichimoku_imo` after client-side mapping in `client.ts` (line 113–115) is already a **flat number** (extracted from `item.ichimoku_imo?.oscillator`). This means the banner metric is correctly reading a number. However, the `STATIONARY BOUNDED TANH` label on the banner metric **description text** mis-describes the output — the displayed value is the final **IMO oscillator** output of the SuperSmoother-filtered composite, not the raw tanh intermediate. This is a labelling inaccuracy that must be corrected.
- **Audit and add `non-goals` enforcement** — ensure `quant-technical-indicator-bank` references remain absent.

## Capabilities

### New Capabilities
- `ichimoku-equity-curve-audit`: Audit and fix the equity growth curve reference series rendering — verify `ichi_cum_strat` decimal baseline, correct `×100` display formula, and enforce 1:1 parity with `verify_ichimoku_studio_metrics_1to1.py`.
- `ichimoku-tanh-banner-fix`: Audit and correct the STATIONARY BOUNDED TANH banner label and value source to accurately describe the `IchimokuDenoisedOscillator (IMO)` composite oscillator output.

### Modified Capabilities
- (none — no existing `openspec/specs/` capability specs require requirement-level changes)

## Impact

- **System**: `quant-lttd-ichimoku` (System 4 only). No changes to Valuation, LTTD, or MTTD systems.
- **Frontend**: `web/src/components/studios/IchimokuTerminal.tsx` — chart series data mapping (lines 736–751), banner metric label (line 987), `toNum()` fallback chain (lines 206–209).
- **Library**: `web/src/lib/studioBacktest.ts` — reference mode equity path (lines 185–198) — verify it does not re-accumulate what is already accumulated in `ichi_cum_strat`.
- **API Client**: `web/src/api/client.ts` — `ichimoku_cum_strat` / `ichimoku_cum_market` field mapping (lines 130–131) — confirm decimal pass-through, no premature `×100`.
- **Pipeline**: `run_report_pipeline.py` — verify `Cum_Strat` value stored is `(1 + r).cumprod() - 1` (decimal), not a multiplier like `1.693`. Ref: lines 408–409.
- **Verification**: `verify_ichimoku_studio_metrics_1to1.py` — re-run after fixes to confirm 100% parity.

## Non-Goals

- No changes to the Python engine (`engines/ichimoku/src/ichimoku_quant/`).
- No changes to MTTD, LTTD, or Valuation studio components.
- No changes to the API Gateway routing or database schema.
- No re-introduction or reference to the deprecated `quant-technical-indicator-bank` system.
- No changes to the `useStudioBacktest` computed (interactive what-if) mode logic.
