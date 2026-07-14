## Context

The Ichimoku system in `quant-lttd-ichimoku` produces a complete backtest through its pipeline:

```
data.py → features.py → strategy.py → backtest.py → calculate_metrics()
```

`run_backtest()` computes these per-row columns:

- `Active_Pos` — position with causal t-1 shift applied
- `Market_Ret` — daily market return `(close[t] - close[t-1]) / close[t-1]`
- `Strat_Raw_Ret` — `Active_Pos × Market_Ret`
- `TC` — transaction cost on position transitions
- `Strat_Net_Ret` — `Strat_Raw_Ret - TC` (the authoritative daily P&L)
- `Cum_Market`, `Cum_Strat` — cumulative products

Currently, the pipeline stores `Cum_Strat` and `Cum_Market` in `unified_daily_analytics` as `ichi_cum_strat` and `ichi_cum_market`. It also stores `Pos` (the raw pre-shift signal) as `ichimoku_position` and `ichi_ref_pos`.

Missing from storage: `Active_Pos` (the shifted execution signal) and `Strat_Net_Ret` (the daily net return). Without these, the frontend must recompute daily returns from scratch using its own fee model — introducing potential divergence from the authoritative Python computation.

The key insight: `Strat_Net_Ret` is the single vector from which ALL aggregate metrics in `calculate_metrics()` are computed. Store it once in the pipeline, and any consumer (frontend, analytics, backfill verification) can derive exact metric values for any date window.

## Goals / Non-Goals

**Goals:**

- Store `Active_Pos` and `Strat_Net_Ret` from the Python pipeline in `unified_daily_analytics` as `ichi_active_pos` and `ichi_strat_net_ret`
- Expose both fields through the unified API under `ichimoku_imo.active_pos` and `ichimoku_imo.strat_net_ret`
- Map both fields through the frontend data pipeline (`client.ts`, `TerminalContext`, types)
- Add a `referenceMode` to `useStudioBacktest` that uses `ichi_strat_net_ret` for metric computation, making metrics bit-exact with `calculate_metrics()`
- Update `IchimokuTerminal.tsx` to display reference metrics as the primary metric set, with interactive what-if as a toggle

**Non-Goals:**

- Modifying `calculate_metrics()` or `run_backtest()` in the prior system
- Adding interactive strategy parameter tuning to the terminal
- Storing pre-computed aggregate metrics (they are window-dependent, derived from daily series)
- Schema migration for existing data (new columns are nullable, backfill optional)

## Decisions

### Decision 1: Store daily returns, not aggregate metrics

**Chosen:** `ichi_strat_net_ret` (per-row REAL) + `ichi_active_pos` (per-row REAL)

**Alternatives considered:**

- **Pre-computed aggregate metrics per window**: Would require a separate table with date-range keys. Impossible to pre-compute for every possible user-selected window.
- **JSON blob of full metric dictionary**: Similar problem — aggregate metrics change with window. Also loses queryability.
- **Only `Strat_Net_Ret`, derive `Active_Pos`**: `Active_Pos` is cheap to store and removing shift ambiguity is worth the single REAL column.

**Rationale:** Daily returns are the minimal atomic data from which all windowed metrics can be computed with exact fidelity to `calculate_metrics()`. This approach is maximally flexible — the same data serves the default full-range view, any user-selected window, and any future metric derivation.

### Decision 2: `Active_Pos` stored as-is from pipeline, not shifted again by frontend

**Chosen:** `ichi_active_pos` = `df_ich['Active_Pos']` = `df['Pos'].shift(1).fillna(0)` from `run_backtest()`

**Rationale:** The frontend currently shifts `ichimoku_position` by 1 day (`activePos = prevRow.position`) to achieve causality. By storing the already-shifted `Active_Pos`, the frontend can use it directly without another shift. This eliminates the primary source of position-timing bugs that caused metric divergence.

### Decision 3: `useStudioBacktest` `referenceMode` as an option, not a replacement

**Chosen:** The hook accepts an optional `referenceRecords: StudioDailyRecord[]` parameter. When provided and data is populated, metrics are computed from `ichimoku_strat_net_ret`. When not provided, existing recomputation logic runs.

```typescript
// Key branching logic
if (referenceMode && row.ichimoku_strat_net_ret != null) {
  stratEquity *= 1.0 + row.ichimoku_strat_net_ret;
  dailyReturns.push(row.ichimoku_strat_net_ret);
  // Active_Pos from ichimoku_active_pos
} else {
  // existing recomputation from position × close
}
```

**Rationale:** The interactive what-if (different feeBps) still needs to recompute. Keeping both paths preserves that capability while adding the authoritative source. The reference path also serves as a validation tool — comparing reference vs interactive metrics surfaces fee-modeling differences.

### Decision 4: Reference metrics displayed as primary, interactive as toggle

**Chosen:** The metrics grid defaults to showing `referenceMetrics` (computed from `ichi_strat_net_ret`). The `showInteractive` toggle controls the interactive overlay on the equity curve AND switches the metrics display to interactive-computed values.

**Rationale:** The authoritative numbers should be what the user sees first. The interactive what-if is an exploration tool. This matches the existing pattern where the equity curve defaults to reference curves.

## Data Flow

```
run_report_pipeline.py
  │
  ├── df_ich = run_backtest(df_ich, transaction_cost=0.001)
  │   ├── df_ich['Active_Pos']     ← Pos.shift(1)  [CAUSAL]
  │   ├── df_ich['Strat_Net_Ret']  ← Active_Pos × Market_Ret - TC
  │   └── df_ich['Cum_Strat']      ← already stored as ichi_cum_strat
  │
  ├── INSERT INTO unified_daily_analytics
  │   ├── ichi_active_pos    = df_ich['Active_Pos']
  │   └── ichi_strat_net_ret = df_ich['Strat_Net_Ret']
  │
  └── commit

GET /api/v1/quant/daily
  │
  ├── SELECT ... ichi_active_pos, ichi_strat_net_ret FROM unified_daily_analytics
  │
  └── Response JSON (per row):
      ichimoku_imo: {
        active_pos: 0.0 | 1.0,
        strat_net_ret: -0.023 | 0.015 | null,
        cum_strat: 1.45,
        ...
      }

IchimokuTerminal.tsx
  │
  ├── dailyData → build backtestData with ichimoku_strat_net_ret, ichimoku_active_pos
  │
  ├── useStudioBacktest(data, start, end, feeBps, { referenceMode: true })
  │   └── If ichimoku_strat_net_ret available → compound directly
  │       Else → recompute from position × close
  │
  ├── referenceMetrics → metrics grid (default visible)
  └── interactiveMetrics → toggle overlay (showInteractive)
```

## Risks / Trade-offs

- **[Risk] Existing database rows have NULL for new columns until next pipeline run**: Mitigated by graceful fallback — `useStudioBacktest` checks for `ichimoku_strat_net_ret != null` before using reference mode. Pre-existing behavior is unchanged for rows without the new data.

- **[Risk] Pipeline failure on schema change**: The `CREATE TABLE IF NOT EXISTS` with subsequent `ALTER TABLE ADD COLUMN` pattern is already used for all Ichimoku columns. Adding 2 more columns follows the exact same migration pattern. Zero risk of table recreation.

- **[Trade-off] Storage cost**: 2 REAL columns × ~3000 rows ≈ negligible (48KB). The `ichi_cum_strat` and `ichi_cum_market` columns are technically derivable from `ichi_strat_net_ret`, but removing them would be a breaking change and the storage cost is irrelevant.

- **[Trade-off] `Strat_Net_Ret` embeds the 10 bps transaction cost**: The reference metrics are computed with the pipeline's fixed 10 bps friction. If the user changes the fee slider, the interactive metrics diverge from reference — which is intentional and informative.

## Open Questions

- Should the reference metrics replace the default metrics display entirely, or should there be a `Source: Reference | Interactive` toggle on the metrics grid?
- Should we add a small "Validation Delta" indicator showing the difference between reference and interactive metrics when both are visible?
