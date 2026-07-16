## 1. Ichimoku Engine — Replace yfinance + Binance with bitview.space

- [x] 1.1 Delete `fetch_binance_btc_data()` function from `engines/ichimoku/src/ichimoku_quant/data.py`
- [x] 1.2 Delete `fetch_btc_data()` function (yfinance primary with Binance fallback) from `engines/ichimoku/src/ichimoku_quant/data.py`
- [x] 1.3 Remove `import yfinance as yf` and cache-related `import os` usage from `engines/ichimoku/src/ichimoku_quant/data.py`
- [x] 1.4 Implement `fetch_btc_ohlcv_from_bitview(start_date: str = '2009-01-01') -> pd.DataFrame` in `engines/ichimoku/src/ichimoku_quant/data.py` using a single GET to `https://bitview.space/api/series/price_ohlc_cents/day1/data`, parsing `[o, h, l, c]` tuples (in cents), converting to USD (`/ 100.0`), skipping zero-close rows, and returning a DataFrame with `Open`, `High`, `Low`, `Close` columns indexed by UTC date anchored at `2009-01-01`
- [x] 1.5 Update all call sites in `engines/ichimoku/` that invoke `fetch_btc_data()` to call `fetch_btc_ohlcv_from_bitview()` instead
- [x] 1.6 Remove the `tmp/btc_cache.csv` read/write logic (file-based caching) from the module
- [x] 1.7 Remove `yfinance>=0.2.18` from `engines/ichimoku/requirements.txt`

## 2. LTTD Engine — Remove BinanceAdapter and env-var toggle

- [x] 2.1 Delete `BinanceAdapter` class from `engines/lttd/src/data/exchange_adapter.py`
- [x] 2.2 Remove `BTC_DATA_SOURCE = os.getenv(...)` and `EXCHANGE_API_KEY = os.getenv(...)` from `engines/lttd/src/config.py`
- [x] 2.3 Simplify `get_exchange_adapter()` in `engines/lttd/src/data/pipeline.py` to unconditionally `return BRKExchangeAdapter()`, removing the `if BTC_DATA_SOURCE.lower() == "binance":` branch
- [x] 2.4 Remove `BinanceAdapter` from the import line in `engines/lttd/src/data/pipeline.py`

## 3. Orchestration Pipeline — Update MasterOHLCV Source Metadata

- [x] 3.1 Update `run_report_pipeline.py` `CREATE TABLE IF NOT EXISTS master_ohlcv` statement to change `source TEXT DEFAULT 'binance'` to `source TEXT DEFAULT 'bitview'`

## 4. Verification

- [x] 4.1 Run `python3 run_report_pipeline.py` and confirm the pipeline log contains NO references to `yfinance`, `api.binance.com`, `data-api.binance.vision`, or `YFRateLimitError`
- [x] 4.2 Confirm `MasterOHLCV canonical sync` upserts ≥ 4,500 causal historical records into `maftia_quant.db`
- [x] 4.3 Confirm `UnifiedDailyAnalytics synced` and `UnifiedComponentSignals synced` upsert counts match or exceed baseline (≥ 6,399 daily records and ≥ 144,068 component records)
- [x] 4.4 Verify commit messages follow Conventional Commits specification (`refactor:` prefix for this change)
