## ADDED Requirements

### Requirement: Canonical Price Source Enforcement

The system SHALL ensure `unified_daily_analytics.btc_price` equals `master_ohlcv.close` for every date where both records exist. The pipeline SHALL NOT use external price sources (e.g., `bitview.space`) for the `btc_price` column in `unified_daily_analytics`.

#### Scenario: Pipeline writes matching prices

- **WHEN** `run_report_pipeline.py` upserts a record into `unified_daily_analytics`
- **THEN** `btc_price` SHALL equal the `close` value from `master_ohlcv` for the same date

#### Scenario: Missing master_ohlcv record

- **WHEN** `run_report_pipeline.py` processes a date that exists in subsystem data but not in `master_ohlcv`
- **THEN** `btc_price` SHALL be set to `NULL` and the record SHALL still be upserted with other available fields

### Requirement: Historical Price Backfill

The system SHALL provide a one-time backfill operation that updates all existing `unified_daily_analytics.btc_price` values to match `master_ohlcv.close`.

#### Scenario: Backfill execution

- **WHEN** the backfill script is executed
- **THEN** all rows in `unified_daily_analytics` where `btc_price != (SELECT close FROM master_ohlcv WHERE date = unified_daily_analytics.date)` SHALL be updated

#### Scenario: Backfill idempotency

- **WHEN** the backfill script is executed a second time after completion
- **THEN** zero rows SHALL be modified (all prices already match)

### Requirement: Price Divergence Monitoring Endpoint

The API gateway SHALL expose `GET /api/v1/audit/price-comparison` that returns dates where `unified_daily_analytics.btc_price` differs from `master_ohlcv.close` by more than a configurable threshold (default: $1.00). The endpoint SHALL enforce the CausalFilter: no query can return dates beyond `current_utc_date()`.

#### Scenario: Divergence detection

- **WHEN** a client calls `GET /api/v1/audit/price-comparison?threshold=1.0`
- **THEN** the response SHALL contain `{"status": "divergent", "count": N, "data": [{date, btc_price, master_close, difference}]}` for all divergent records where `date <= current_utc_date()`

#### Scenario: No divergences found

- **WHEN** all prices match within the threshold
- **THEN** the response SHALL return `{"status": "clean", "count": 0, "data": []}`

#### Scenario: Future date filter

- **WHEN** a client calls `GET /api/v1/audit/price-comparison` and the database contains divergent records with dates > `current_utc_date()`
- **THEN** those future records SHALL be excluded from the response
