## Context

Two engines currently source daily BTC OHLCV data from different providers:

1. **Ichimoku engine** (`engines/ichimoku`) — primary source is `yfinance` (`BTC-USD`), with a self-built pagination loop against `api.binance.com/api/v3/klines` as a fallback. A file cache at `tmp/btc_cache.csv` is used to reduce repeat API calls.
2. **LTTD engine** (`engines/lttd`) — configurable via `BTC_DATA_SOURCE` env-var, defaulting to `"binance"` (`data-api.binance.vision/api/v3/klines`). An alternative `BRKExchangeAdapter` using `bitview.space` already exists but is not the default.

The **Valuation engine** already uses `bitview.space` exclusively via a purpose-built `BitviewClient` (with retry logic and proper error types). The **MTTD engine** consumes OHLCV data from `lttd.db` JSON sync and is not a direct API consumer.

During the 2026-07-16 pipeline run, yfinance raised `YFRateLimitError` mid-execution. The Binance fallback succeeded, but this creates a non-deterministic pipeline where the same data day could resolve differently depending on which source is available — violating the canonical MasterOHLCV single source-of-truth principle.

## Goals / Non-Goals

**Goals:**
- Route all OHLCV ingestion through `bitview.space` (`price_ohlc_cents/day1` series) for both Ichimoku and LTTD engines
- Remove `yfinance` from `engines/ichimoku/requirements.txt`
- Remove `BinanceAdapter` class from `engines/lttd`
- Eliminate the env-var `BTC_DATA_SOURCE` toggle (Binance path)
- Delete stale file cache logic (`tmp/btc_cache.csv`) from Ichimoku
- Preserve `MasterOHLCV` `source` field accuracy by updating its default from `'binance'` → `'bitview'`

**Non-Goals:**
- Any changes to the Valuation engine (already on bitview.space)
- Any changes to the MTTD engine data pipeline
- Any frontend, API gateway, or database schema changes
- Adding centralized OHLCV caching or a shared ingestion microservice
- Modifying the Valuation engine's 17 on-chain metric sources

## Decisions

### Decision 1: Use `price_ohlc_cents/day1` series for Ichimoku (not `BRKExchangeAdapter`)

The LTTD `BRKExchangeAdapter` fetches separate series (`price_open`, `price_high`, `price_low`, `price`) with individual API calls. The Valuation engine's `btc_ohlc.py` uses a single call to `price_ohlc_cents/day1` returning `[open, high, low, close]` tuples in cents — one request, 4 fields, 6,400+ rows.

**Chosen approach for Ichimoku:** Replicate the Valuation pattern — single call to `price_ohlc_cents/day1`, divide by 100 for USD, return a DataFrame with `Open`, `High`, `Low`, `Close` columns indexed by date.

**Rationale:** Minimal surface area. One network call, no pagination, same pattern already proven in production. Ichimoku only needs Close and the OHLC fields for `mplfinance` rendering — not `volume` — so the compact cents endpoint is ideal.

### Decision 2: LTTD defaults to `BRKExchangeAdapter` exclusively

The `BRKExchangeAdapter` already exists and fetches `price_open`, `price_high`, `price_low`, `price` from `bitview.space`. Rather than rewriting it, we simply:
- Remove `BinanceAdapter`
- Remove the `BTC_DATA_SOURCE` config toggle
- Hardcode `get_exchange_adapter()` to always return `BRKExchangeAdapter()`

**Alternative considered:** Create a unified `BitviewOHLCVAdapter` using `price_ohlc_cents/day1` for LTTD too. **Rejected** because `BRKExchangeAdapter` already works, is tested implicitly by past pipeline runs, and a rewrite introduces unnecessary regression risk.

### Decision 3: No shared OHLCV client module across engines

Engines remain independently executable (`cd engines/lttd && python3 run_pipeline.py`). A shared client library would require either a pip-installed package or relative path hacks — both add complexity without benefit. Each engine gets its own bitview.space call pattern.

### Decision 4: Remove `tmp/btc_cache.csv` cache entirely

The cache was introduced to avoid yfinance rate-limit hammering during development iteration. With `bitview.space`, the response is fast (~300ms for full history) and there is no rate limit issue in observed production runs. The LTTD engine already implements proper caching in `lttd.db` via `SQLiteCache` — that handles incremental syncing correctly. Ichimoku runs once daily via the orchestration pipeline, so a file cache is unnecessary overhead.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| `bitview.space` becomes unavailable or changes API contract | Same risk already accepted by Valuation engine. Series names (`price_ohlc_cents`) have been stable. Add retry logic (already in `BRKExchangeAdapter`). |
| `BRKExchangeAdapter` fetches multiple series separately, slightly more network calls than single `price_ohlc_cents` endpoint | Acceptable — LTTD full-history fetch happens once; incremental fetches are small delta calls. Performance impact is negligible. |
| Ichimoku's `tmp/btc_cache.csv` deletion may break a local dev workflow that relied on it | Cache is opt-in via file existence check; deleting it just means one extra network call on next run. No behavior difference in production scheduler. |
| `master_ohlcv.source` column default change (`'binance'` → `'bitview'`) | Only cosmetic/metadata. No downstream query joins on this column. |

## Migration Plan

1. **Ichimoku engine** — rewrite `engines/ichimoku/src/ichimoku_quant/data.py`:
   - Delete `fetch_binance_btc_data()` and `fetch_btc_data()` functions
   - Write new `fetch_btc_ohlcv_from_bitview()` using `requests.get(price_ohlc_cents/day1)`, returning DataFrame with `Open`, `High`, `Low`, `Close` indexed by UTC date
   - Remove cache read/write logic (`tmp/btc_cache.csv`)
   - Remove `import yfinance as yf` and `import os` (cache path use)
   - Remove `yfinance>=0.2.18` from `requirements.txt`
2. **LTTD engine** — targeted removals:
   - Delete `BinanceAdapter` class from `exchange_adapter.py`
   - Remove `BTC_DATA_SOURCE` and `EXCHANGE_API_KEY` from `config.py`
   - Simplify `get_exchange_adapter()` in `pipeline.py` to `return BRKExchangeAdapter()`
   - Remove `BinanceAdapter` import from `pipeline.py`
3. **Orchestration** — update `run_report_pipeline.py` CREATE TABLE default for `source` column from `'binance'` to `'bitview'`
4. **Verification** — run `python3 run_report_pipeline.py` and confirm:
   - No yfinance or Binance log lines appear
   - `MasterOHLCV canonical sync` upserts ≥ 4,500 causal records
   - `UnifiedDailyAnalytics` and `UnifiedComponentSignals` upsert counts match baseline

**Rollback:** `git checkout` the modified files. No database schema changes, no migration scripts needed.

## Open Questions

- None. `BRKExchangeAdapter` and `BitviewClient` patterns are already in production with no outstanding issues.
