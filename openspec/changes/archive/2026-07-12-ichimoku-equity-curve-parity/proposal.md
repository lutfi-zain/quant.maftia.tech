## Why

The Ichimoku equity curve displayed in the unified frontend (`IchimokuTerminal.tsx` Pane 4) does not match the prior standalone system's equity curve. Three independent sources of drift exist: (1) the pipeline overrides Ichimoku position signals with LTTD/Valuation macro filters before storing to DB, (2) the TypeScript backtest engine uses a different transaction cost model (5 bps vs 10 bps per half-turn), and (3) the TypeScript engine is a reimplementation that introduces subtle numeric divergence from the Python pandas vectorized baseline. No verification gate enforces equity curve parity. This makes the unified platform's Ichimoku performance metrics untrustworthy for trading decisions.

## What Changes

1. **Store pure Ichimoku equity data alongside the unified curve** — add `Cum_Strat` and `Cum_Market` arrays from the prior system's `run_backtest()` directly to the database, eliminating the need for FE recomputation for the reference curve.
2. **Fix the TypeScript backtest engine** to match the Python engine's fee formula exactly (`Active_Pos.diff().abs() * feeRate` instead of `feeRate/2` per change), defaulting to 10 bps.
3. **Add an ICHIMOKU_REFERENCE capability** that stores the pure (un-overridden) Ichimoku position signal and equity curve alongside the macro-overridden values.
4. **Add equity curve parity checks** to `verify_pipeline_api_parity.py` — cumulative return, Sharpe ratio, max drawdown, trade count — comparing prior system output against pipeline output.

## Capabilities

### New Capabilities

- `ichimoku-reference-equity`: Pure (non-overridden) Ichimoku position signal, cumulative strategy equity curve, and buy-and-hold market curve stored as date-keyed arrays in the database, served via API, and rendered in the FE without client-side recomputation.

### Modified Capabilities

- `ichimoku-chart-rebuild` (from `audit-ichimoku-metrics-parity`): Add equity curve subplot data source — chart Pane 4 must read `cum_strat` and `cum_market` from the `ichimoku_imo` API sub-object instead of recomputing via `useStudioBacktest`.
- `pipeline-metrics-parity-verification` (from `audit-ichimoku-metrics-parity`): Extend parity checks to include equity curve metrics (cumulative return, Sharpe, MDD, trade count) cross-validated against the prior system's `backtest.py` output.

## Impact

| Layer | File(s) | Change |
|-------|---------|--------|
| **Python Pipeline** | `run_report_pipeline.py` | Extract pure `Pos` (before overrides) and run `backtest.run_backtest()` to get `Cum_Strat`/`Cum_Market`. Store as `ichimoku_reference_pos`, `ichimoku_cum_strat`, `ichimoku_cum_market` in `unified_daily_analytics`. |
| **Python Pipeline** | `run_report_pipeline.py` | Add ICHIMOKU_REFERENCE component signal entries for pure position and cumulative returns. |
| **Database Schema** | `run_report_pipeline.py` | Add `ichi_ref_pos REAL`, `ichi_cum_strat REAL`, `ichi_cum_market REAL` columns to `unified_daily_analytics` CREATE TABLE. |
| **API Route** | `src/api/routes/daily.ts` | SELECT the 3 new reference columns; include `ref_pos`, `cum_strat`, `cum_market` in the `ichimoku_imo` response sub-object. |
| **FE Types** | `web/src/api/types.ts` | Add `ichimoku_ref_pos?`, `ichimoku_cum_strat?`, `ichimoku_cum_market?` optional fields to `DailyAnalyticsPoint`. |
| **FE Client** | `web/src/api/client.ts` | Map `ichimoku_imo.cum_strat` → `ichimoku_cum_strat` etc. |
| **FE Terminal** | `web/src/components/studios/IchimokuTerminal.tsx` | Pane 4: read equity curve from `dailyData` API fields; remove dependency on `useStudioBacktest` for the reference curve. Keep `useStudioBacktest` for interactive backtest config (date range, fee slider). |
| **FE Backtest** | `web/src/lib/studioBacktest.ts` | Fix fee formula to match Python: `diff().abs() * feeRate` per change event (not `feeRate/2`). Default to 10 bps. |
| **Verification** | `verify_pipeline_api_parity.py` | Add equity curve checks: compare cumulative return, Sharpe, MDD, trade count between prior system backtest and pipeline output. |

**No new dependencies.** All changes are within the unified platform's existing 4-system ecosystem.

## Non-goals

- No changes to `quant-lttd-ichimoku` prior system source code (`features.py`, `strategy.py`, `backtest.py`, `server.py`).
- No changes to Valuation, LTTD, or MTTD systems.
- No changes to the cross-system interlocking overrides (LTTD Sideways, Valuation Bubble) — the overridden position remains for the "unified" consensus view; the change adds a separate pure-reference view.
- No deprecation of the interactive backtest controls (date range, fee slider) — these remain for "what-if" analysis, they just no longer mask the reference curve.
