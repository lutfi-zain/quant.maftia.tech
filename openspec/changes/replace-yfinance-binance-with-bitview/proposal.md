## Why

The Ichimoku and LTTD engines currently depend on **yfinance** (Yahoo Finance) and **Binance REST API** for fetching daily BTC OHLCV data. Both sources have proven unreliable in production: yfinance suffers from frequent rate-limiting (`YFRateLimitError`) and unstable column schemas across versions; the Binance klines API requires pagination, timestamp-manipulation, and introduces an external exchange dependency unnecessary for strictly causal historical data. The Valuation engine already uses `bitview.space` exclusively and successfully (fetching 6,400+ rows in pipeline runs). Unifying all OHLCV data fetching to a single canonical source — `bitview.space` — eliminates two fragile third-party dependencies, simplifies the data lineage, and removes the only remaining stale cache file (`tmp/btc_cache.csv`) from the Ichimoku engine.

## What Changes

- **Remove** `yfinance` library dependency from `engines/ichimoku/requirements.txt`
- **Remove** `fetch_binance_btc_data()` fallback function from `engines/ichimoku/src/ichimoku_quant/data.py`
- **Replace** `fetch_btc_data()` in `engines/ichimoku/src/ichimoku_quant/data.py` with a `bitview.space` implementation using the `price_ohlc_cents/day1` series (same pattern as Valuation's `btc_ohlc.py`)
- **Remove** `BinanceAdapter` class from `engines/lttd/src/data/exchange_adapter.py`
- **Remove** `BTC_DATA_SOURCE` env-var toggle and hard-coded `"binance"` default from `engines/lttd/src/config.py`
- **Update** `engines/lttd/src/data/pipeline.py` `get_exchange_adapter()` to exclusively return `BRKExchangeAdapter` (which already uses `bitview.space`)
- **Remove** `EXCHANGE_API_KEY` env-var from `engines/lttd/src/config.py` (only used by `BinanceAdapter`)
- **Delete** stale `tmp/btc_cache.csv` cache logic from Ichimoku (bitview data is already ephemeral; caching is done at the `lttd.db` level by `SQLiteCache`)
- **Update** `run_report_pipeline.py` `source` field in `master_ohlcv` from `'binance'` to `'bitview'`

## Capabilities

### New Capabilities
- `unified-btc-ohlcv-ingestion`: All 4 quantitative engines source daily BTC OHLCV data exclusively from `bitview.space` (`price_ohlc_cents/day1`), achieving a single canonical ingestion path with consistent date anchoring (`2009-01-01`), cents-to-dollars conversion, and zero-value filtering.

### Modified Capabilities
- `data-ingestion-and-wal-pipeline`: Data ingestion requirement changes — the `lttd_regime` and `ichimoku_imo` pipelines must no longer accept `BTC_DATA_SOURCE=binance` as a valid configuration. The OHLCV fetch path is now exclusively `bitview.space`, removing the Binance fallback path from the architecture contract.

## Non-Goals

- No changes to the **Valuation engine** OHLCV fetching (already on `bitview.space`)
- No changes to the **MTTD engine** (sources OHLCV from `lttd.db` JSON sync, not directly from an exchange)
- No changes to any charting, frontend, or API gateway code
- No changes to `quant-technical-indicator-bank` (deprecated and excluded)
- No modifications to the Valuation engine's 17 on-chain metric sources (those use `bitview.space` independently and remain unchanged)
- No introduction of a new centralized OHLCV microservice — engines continue fetching independently

## Impact

- **Engines affected:** `engines/ichimoku` (primary), `engines/lttd` (secondary — `BinanceAdapter` removal)
- **Files modified:**
  - `engines/ichimoku/requirements.txt` — remove `yfinance`
  - `engines/ichimoku/src/ichimoku_quant/data.py` — full rewrite of OHLCV fetch
  - `engines/lttd/src/config.py` — remove `BTC_DATA_SOURCE`, `EXCHANGE_API_KEY`
  - `engines/lttd/src/data/exchange_adapter.py` — remove `BinanceAdapter`
  - `engines/lttd/src/data/pipeline.py` — simplify `get_exchange_adapter()`
  - `run_report_pipeline.py` — update `source` column default from `'binance'` to `'bitview'`
- **Dependencies removed:** `yfinance` (ichimoku only)
- **External APIs removed:** `api.binance.com/api/v3/klines`, `data-api.binance.vision/api/v3/klines`, Yahoo Finance `download()`
- **Zero lookahead bias:** `bitview.space` returns historical index-aligned series anchored at `2009-01-01`; all data transformation retains strict $t-1$ causal access as currently implemented in `BRKExchangeAdapter`
