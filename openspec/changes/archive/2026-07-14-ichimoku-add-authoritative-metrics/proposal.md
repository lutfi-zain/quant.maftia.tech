## Why

The Ichimoku Terminal currently computes all backtest metrics (Sharpe, Win Rate, Max Drawdown, etc.) client-side by replaying positions through market returns. This recomputation is structurally independent of the Python pipeline that generated the authoritative backtest — it can diverge due to fee modeling differences, NaN edge cases, and shifted position timing. The existing `ichimoku-studio-metrics-audit` spec mandates 1:1 parity but provides no mechanism to achieve or verify it.

By storing the Python backend's daily net strategy returns (`Strat_Net_Ret`) and causal active position (`Active_Pos`) in the database, we give the terminal a canonical source of truth for all derived metrics. The frontend can compute windowed metrics identical to `calculate_metrics()` from the prior system, making parity automatic instead of accidental.

## What Changes

- **2 new DB columns** in `unified_daily_analytics`: `ichi_active_pos`, `ichi_strat_net_ret`
- **Pipeline extraction**: `run_report_pipeline.py` stores the Python backend's `Active_Pos` and `Strat_Net_Ret` columns from `run_backtest()` output
- **API exposure**: `GET /api/v1/quant/daily` returns `active_pos` and `strat_net_ret` under `ichimoku_imo`
- **FE types + mapping**: `DailyAnalyticsPoint` gets `ichimoku_active_pos?` and `ichimoku_strat_net_ret?`
- **Hook enhancement**: `useStudioBacktest` gains a `referenceMode` that uses `ichi_strat_net_ret` directly for metric computation instead of recomputing from positions
- **Terminal UI**: Reference metrics displayed alongside or as default, interactive what-if retained as toggle

## Capabilities

### New Capabilities

- `ichimoku-authoritative-metrics`: Store Python pipeline's daily net strategy returns and active position in the unified database, expose them through the API, and use them in the frontend to compute windowed backtest metrics that are bit-exact with the prior system's `calculate_metrics()`.

### Modified Capabilities

- `ichimoku-reference-equity`: Extends the existing reference equity storage from cumulative curves (`cum_strat`, `cum_market`) to include the daily building blocks (`active_pos`, `strat_net_ret`) needed for derived metric computation.
- `ichimoku-studio-metrics-audit`: Transforms the parity requirement from "client-side computation must match Python output" to "client-side computation uses Python output directly when available, falling back to recomputation when it isn't."
- `ichimoku-chart-rebuild`: The equity curve subplot gains authoritative reference metrics display alongside the existing interactive what-if overlay.

## Impact

- **Database**: `unified_daily_analytics` — 2 new REAL columns (non-breaking, existing queries unaffected)
- **Pipeline**: `run_report_pipeline.py` — extract 2 additional columns from `df_ich` after `run_backtest()`
- **API Gateway**: `src/api/routes/daily.ts` — expose `active_pos`, `strat_net_ret` in response
- **Frontend**:
  - `web/src/api/types.ts` — 2 new optional fields
  - `web/src/api/client.ts` — map new API fields
  - `web/src/context/TerminalContext.tsx` — map new fields
  - `web/src/lib/studioBacktest.ts` — add `referenceMode` path
  - `IchimokuTerminal.tsx` — display reference metrics
- **No new dependencies** — all data already computed by the pipeline, just not stored
- **No breaking changes** — new columns are nullable, client-side fallback handles missing data

## Non-goals

- Parameter tuning sidebar (interactive strategy parameter exploration is out of scope — the prior system's research sandbox interaction model is not being replicated)
- Multi-asset backtesting (BTC-only scope maintained)
- Modifications to the legacy `quant-technical-indicator-bank` (deprecated system, left untouched)
- Store-level metric aggregation (metrics are always windowed, computed from daily series)
