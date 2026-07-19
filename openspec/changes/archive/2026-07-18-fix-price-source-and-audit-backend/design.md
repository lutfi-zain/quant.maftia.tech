## Context

The quantitative platform has 4 systems (Valuation, LTTD, MTTD, Ichimoku) writing to `unified_daily_analytics`. The price column `btc_price` is sourced from `bitview.space` via the valuation engine's `timeseries_metrics`, while `master_ohlcv.close` comes from CoinGecko. These diverge by 0.2%–6.3% on 3,744 records, causing frontend backtests to compound different returns than backend backtests.

Current architecture:

```
bitview.space → valuation engine → timeseries_metrics.btc_price → unified_daily_analytics.btc_price
CoinGecko → master_ohlcv → (used by backend API only)
```

Frontend backtests use `btc_price`; backend API backtests use `master_ohlcv.close`. Neither verifies against the other.

## Goals / Non-Goals

**Goals:**

- Single canonical price: `unified_daily_analytics.btc_price` SHALL equal `master_ohlcv.close`
- Backend-computed SDCA signals/backtests for auditability (server-side TypeScript)
- All studios read positions from database, not recompute locally
- Monitoring endpoint to detect future price divergences

**Non-Goals:**

- Changing the 4 core quant engine calculations (Valuation, LTTD, MTTD, Ichimoku)
- Modifying `bitview.space` ingestion for valuation indicator raw values (only btc_price fallback)
- Reintroducing `quant-technical-indicator-bank`
- WebSocket architecture changes

## Decisions

### Decision 1: Price Source Unification Strategy

**Choice**: Modify `run_report_pipeline.py` to always use `master_ohlcv.close` for `btc_price`, removing the `bitview.space` fallback for this field.

**Rationale**: `master_ohlcv.close` is the canonical exchange feed used by the API gateway's backtest endpoint. The `bitview.space` price is an approximation that diverges significantly. The valuation engine still uses `bitview.space` for its own indicator calculations (ahr999, etc.) — only the btc_price written to unified_daily_analytics changes.

**Alternatives considered**:

- A) Keep both sources, add reconciliation: rejected — adds complexity without fixing root cause
- B) Use `bitview.space` everywhere: rejected — `master_ohlcv` is the established canonical source per `master-ohlcv-canonical-storage` spec

### Decision 2: Backend SDCA Engine Language

**Choice**: TypeScript (Bun runtime), co-located with API gateway.

**Rationale**: The SDCA engine is pure logic (no scipy/hmmlearn dependencies). TypeScript keeps it in the same runtime as the Hono gateway, avoiding cross-process calls. The existing `web/src/lib/sdcaEngine.ts` can be refactored into `src/lib/sdcaEngine.ts` (shared between frontend and backend).

**Alternatives considered**:

- A) Python subsystem: rejected — would require HTTP call from Bun gateway to Python, adding latency and complexity
- B) Keep in frontend only: rejected — defeats the auditability goal

### Decision 3: Portfolio Persistence

**Choice**: Server-side SQLite table `sdca_portfolios` with transaction log.

**Rationale**: Enables multi-device sync, audit trail, and server-side backtest computation. localStorage is insufficient for audit requirements.

**Alternatives considered**:

- A) localStorage only: rejected — no audit trail, lost on browser clear
- B) Hybrid (localStorage + server sync): deferred — adds conflict resolution complexity

### Decision 4: Frontend Position Source

**Choice**: All studios read position from database columns (`mttd_position`, `ichimoku_position`, `lttd_exposure`), eliminating client-side recomputation.

**Rationale**: The pipeline already applies circuit breaker overrides (LTTD sideways, valuation bubble) before storing positions. Frontend recomputation ignores these overrides, producing incorrect backtest results.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Historical backfill of `btc_price` changes visible chart data | Run backfill as one-time migration, document in changelog |
| SDCA backend computation differs from existing frontend logic during transition | Run parallel computation and compare before cutover |
| Server-side portfolio requires authentication | Add simple API key auth for portfolio endpoints initially |
| Removing `bitview.space` btc_price fallback may break valuation indicator calculations | Only change unified_daily_analytics; valuation engine keeps its own data path |
| SDCA backtest over 5000+ days may be slow on every request | Implement in-memory caching with 24h TTL; cache invalidation on new pipeline run |
| Backfill during active pipeline run could cause data corruption | Acquire SQLite WAL lock before backfill; abort if lock cannot be acquired within 5s |

## Migration Plan

1. **Phase 1**: Fix pipeline to use `master_ohlcv.close` for `btc_price`, backfill historical records
2. **Phase 2**: Add backend SDCA endpoints, refactor shared engine code
3. **Phase 3**: Fix frontend position logic to use database values
4. **Phase 4**: Add audit monitoring endpoint, update verification scripts

**Rollback**: Each phase is independently reversible. Phase 1 can be rolled back by re-running pipeline with `bitview.space` source.
