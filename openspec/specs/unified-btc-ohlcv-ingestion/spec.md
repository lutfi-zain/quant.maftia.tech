# Unified BTC OHLCV Ingestion

## Purpose
Defines requirements for unified Bitcoin OHLCV data ingestion across all quantitative engines (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`) exclusively via the `bitview.space` REST API. Eliminates legacy provider dependencies (`yfinance`, Yahoo Finance, Binance) from every engine's data fetch path, and enforces accurate `source` metadata lineage in the canonical `MasterOHLCV` table.

## Requirements

### Requirement: Unified BitviewSpace OHLCV Ingestion for All Engines
All quantitative engines that require daily BTC OHLCV data SHALL source it exclusively from the `bitview.space` REST API using the `price_ohlc_cents/day1` series or the BRK client series equivalents (`price_open`, `price_high`, `price_low`, `price`). No engine SHALL depend on `yfinance`, Yahoo Finance, or any Binance API endpoint for OHLCV data.

#### Scenario: Ichimoku engine fetches OHLCV from bitview.space
- **WHEN** `engines/ichimoku/src/ichimoku_quant/data.py` `fetch_btc_ohlcv_from_bitview()` is called
- **THEN** it MUST issue a single GET request to `https://bitview.space/api/series/price_ohlc_cents/day1/data`, parse the `[open_cents, high_cents, low_cents, close_cents]` tuple array, divide each value by 100 to convert cents to USD, and return a `pd.DataFrame` with columns `Open`, `High`, `Low`, `Close` indexed by UTC date (anchored at `2009-01-01` + index offset)

#### Scenario: LTTD engine defaults to BRKExchangeAdapter
- **WHEN** `engines/lttd/src/data/pipeline.py` `ohlcv_pipeline()` is called
- **THEN** `get_exchange_adapter()` MUST always return `BRKExchangeAdapter()` (bitview.space) without any env-var override path

#### Scenario: Zero-value filtering preserved
- **WHEN** `fetch_btc_ohlcv_from_bitview()` processes the raw response array
- **THEN** any row where `close_cents == 0` MUST be skipped (early Bitcoin genesis period data with no market price), matching Valuation engine's existing `btc_ohlc.py` behavior

#### Scenario: No yfinance or Binance import in any engine
- **WHEN** `python3 -c "import engines.ichimoku.src.ichimoku_quant.data"` is executed
- **THEN** no `yfinance` import is resolved and no call to `api.binance.com` or `data-api.binance.vision` is made at any point in the OHLCV fetch path

### Requirement: Canonical MasterOHLCV Source Metadata Accuracy
The `MasterOHLCV` (`master_ohlcv`) table's `source` column default value in `run_report_pipeline.py` SHALL reflect the actual upstream provider (`'bitview'`) to maintain accurate data lineage.

#### Scenario: Source column reflects bitview provenance
- **WHEN** `run_report_pipeline.py` initializes the `master_ohlcv` table using `CREATE TABLE IF NOT EXISTS`
- **THEN** the `source TEXT DEFAULT 'bitview'` column default MUST be set to `'bitview'` (not `'binance'`), so all newly inserted rows accurately reflect the canonical OHLCV provider

### Requirement: Cache File Elimination from Ichimoku Engine
The Ichimoku engine SHALL NOT use any file-based caching (`tmp/btc_cache.csv`) for OHLCV data. The `bitview.space` API is the sole, fresh data source on every pipeline execution.

#### Scenario: No CSV cache file dependency
- **WHEN** `engines/ichimoku/src/ichimoku_quant/data.py` `fetch_btc_ohlcv_from_bitview()` executes
- **THEN** it MUST NOT read from or write to any CSV file path; it MUST issue a direct API call to `bitview.space` on each invocation without checking for cached file existence
