## Context

The Ichimoku equity curve in the unified frontend (`IchimokuTerminal.tsx` Pane 4) currently recomputes cumulative strategy returns client-side using a TypeScript backtest engine (`useStudioBacktest.ts`). This engine has drifted from the Python baseline in three ways:

1. **Position signal override**: The pipeline stores a macro-overridden position (LTTD Sideways/Valuation Bubble) rather than the pure Ichimoku position. The prior system's equity curve uses the pure position.
2. **Fee model mismatch**: The TypeScript engine uses `feeRate/2` per position change vs the Python engine's `Active_Pos.diff().abs() * transaction_cost` — producing 5 bps vs 10 bps per half-turn.
3. **Separate codebase drift**: Two independent backtest engine implementations inevitably diverge over time.

The prior system (`quant-lttd-ichimoku`) already computes the authoritative equity curve in `backtest.py::run_backtest()`, producing `Cum_Strat` and `Cum_Market` columns per date row. The cleanest fix is to store these values directly in the database and serve them through the existing API — eliminating the need for FE recomputation of the reference curve.

## Goals / Non-Goals

**Goals:**

- Pure Ichimoku equity curve (prior system's `Cum_Strat` and `Cum_Market`) stored in `unified_daily_analytics` alongside existing fields.
- Pure (non-overridden) Ichimoku position signal stored as reference alongside the overridden `ichimoku_position`.
- API returns reference equity fields in the `ichimoku_imo` response sub-object.
- FE Pane 4 renders the reference equity curve from API data; `useStudioBacktest` is only used for interactive what-if scenarios (date range, fee slider).
- TypeScript backtest engine fee formula fixed to match Python exactly.
- Parity verification extended to equity curve metrics (cumulative return, Sharpe, MDD, trade count).

**Non-Goals:**

- No changes to `quant-lttd-ichimoku` source code.
- No removal of the interactive backtest controls or `useStudioBacktest` hook.
- No changes to Valuation, LTTD, or MTTD systems.
- No removal of cross-system macro overrides — overridden position remains for unified consensus view.
- No deprecation of existing `ichimoku_position` column.

## Decisions

### D1: Store Reference Equity in Existing `unified_daily_analytics` Table

**Decision:** Add three new columns to `unified_daily_analytics`:

- `ichi_ref_pos REAL` — pure Ichimoku position (0.0 or 1.0) BEFORE macro overrides
- `ichi_cum_strat REAL` — cumulative strategy equity multiplier from `backtest.py::run_backtest()`
- `ichi_cum_market REAL` — cumulative buy-and-hold market equity multiplier

Populate these during the pipeline sync after calling `generate_signals()` and `backtest.run_backtest()`. The existing prior system module is already imported and called; we just need to call `run_backtest()` and extract the additional columns.

**Rationale:** Single table, no JOIN overhead. The prior system's `run_backtest()` already computes these values; serializing them from the DataFrame to SQLite adds negligible overhead (~500 float writes per date).

**Alternatives Considered:**

- *Separate `reference_equity` table* — cleaner separation but forces a LEFT JOIN on every daily query. Rejected for chart render performance.
- *FE calls prior system API directly* — violates the unified API Gateway rule (`:8765`). Rejected.

### D2: Call Prior System's `run_backtest()` from Pipeline

**Decision:** After `generate_signals()` produces `Pos`, call `run_backtest(df, transaction_cost=0.001)` from the prior system's `backtest.py` to get the authoritative `Cum_Strat` and `Cum_Market` columns. Extract these alongside `Pos` into `ich_data_all`.

```python
from src.ichimoku_quant.backtest import run_backtest

df_ich = generate_signals(df_ich)
df_ich = run_backtest(df_ich, transaction_cost=0.001)  # ADD THIS

# Then extract additional columns:
df_ich['Cum_Strat']  # → ichi_cum_strat
df_ich['Cum_Market'] # → ichi_cum_market
df_ich['Pos']        # → ichi_ref_pos (before override)
```

**Rationale:** Zero computation duplication. The prior system's engine IS the authoritative backtest. Calling it directly guarantees bit-exact equity curves as long as the pipeline uses the same OHLCV data.

**Alternatives Considered:**

- *Re-implement backtest in TypeScript with corrected fee model* — still subject to drift. Even with identical formulas, pandas vs JS numeric boundaries (fillna, NaN handling, floating point) diverge over thousands of bars. Rejected.
- *Parse prior system's `main.py` output (dashboard.html)* — fragile, not structured data. Rejected.

### D3: Separate ICHIMOKU_REFERENCE Component Signals

**Decision:** Add `system_source='ICHIMOKU_REFERENCE'` entries to `unified_component_signals` for cumulative returns and reference position, so the existing `/api/v1/quant/components?system=quant-lttd-ichimoku` endpoint can differentiate pure-reference metrics from the macro-overridden position.

**Rationale:** The existing ICHIMOKU source records show the macro-overridden state (IMO, S_TK, etc.). The reference position and cumulative returns are a different logical dataset. Using a distinct `system_source` avoids confusion in the component signals table.

**Alternatives Considered:**

- *Reuse ICHIMOKU source* — would mix overridden and pure signals, confusing consumers. Rejected.
- *Store only in `unified_daily_analytics` without component signals* — works for the daily API endpoint but misses the components endpoint used by the breakdown table. Rejected.

### D4: Fix TypeScript Fee Model to Match Python

**Decision:** Change the fee deduction in `useStudioBacktest.ts` from:

```typescript
// Current (wrong):
if (activePos !== (prevRow ? prevRow.position || 0 : 0)) {
    stratRet -= feeRate / 2.0;
}
```

To:

```typescript
// Fixed: match Python's Active_Pos.diff().abs() * transaction_cost
if (activePos !== (prevRow ? prevRow.position || 0 : 0)) {
    stratRet -= feeRate;  // full half-turn fee deducted on change
}
```

Default `feeBps` remains 10 (10 bps = 0.001), matching the prior system's `transaction_cost=0.001`.

**Rationale:** The Python formula `TC = Active_Pos.diff().abs() * transaction_cost` deducts the full `transaction_cost` on each position change bar (0→1 or 1→0). The TypeScript version was deducting half that, producing a 2x fee discount over the strategy's lifetime.

**Alternatives Considered:**

- *Keep half-fee model and adjust Python* — would change the prior system's backtest output, breaking the authority. Rejected.
- *Ignore the mismatch* — compounds over hundreds of trades. Rejected.

### D5: FE Pane 4 Uses Reference Curve by Default, Interactive Curve as Overlay

**Decision:** The equity curve subplot shows TWO line series by default:

1. **Reference Strat (green, solid)**: `ichi_cum_strat` from API — this IS the prior system's equity curve.
2. **Reference Market (blue, solid)**: `ichi_cum_market` from API — buy-and-hold baseline.

The interactive `useStudioBacktest` curve (with date range and fee sliders) becomes an optionally visible overlay (toggle button), computed client-side per user request.

**Rationale:** The default view must show the authoritative, verified equity curve. The interactive backtest is a "what-if" exploration tool, not the truth.

**Alternatives Considered:**

- *Replace entirely with API data, remove client-side engine* — loses interactive backtest functionality. Rejected.
- *Keep client-side engine as primary, add API curve as reference line* — the buggy curve remains default. Rejected.

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Pipeline execution adds `run_backtest()` call** | Negligible — the prior system's backtest is a vectorized pandas operation on ~2500 rows. Completes in <20ms. | N/A — safe by design. |
| **Database schema migration** | New columns `ichi_ref_pos`, `ichi_cum_strat`, `ichi_cum_market` must be added to existing tables. SQLite ALTER TABLE ADD COLUMN is safe and additive. | Use `CREATE TABLE IF NOT EXISTS` with all columns; existing rows get NULL before next pipeline run. |
| **FE shows two equity curves (reference + interactive)** | Visual confusion if both are visible simultaneously. | Default: only reference curve visible. Interactive curve hidden behind toggle. Clear legend labels differentiate them. |
| **API response payload size increase** | Adding 3 floats per daily row (~24 bytes each) = negligible for 500-row limit. | Acceptable. |
| **Prior system data source drift** | If `fetch_btc_data()` returns different data than the pipeline's `master_ohlcv`, the reference equity curve will diverge from what the unified platform shows on its own price charts. | The pipeline already re-uses the same `fetch_btc_data()` call — same cache, same data. Verified by existing metric parity checks. |
