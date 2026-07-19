## MODIFIED Requirements

### Requirement: Canonical Schema Definition for MasterOHLCV

The system SHALL maintain a relational table named `master_ohlcv` inside `maftia_quant.db` with strict column definitions: `date` (TEXT PRIMARY KEY in YYYY-MM-DD format), `open` (REAL NOT NULL), `high` (REAL NOT NULL), `low` (REAL NOT NULL), `close` (REAL NOT NULL), `volume` (REAL NOT NULL), and optional external metrics like `brk_metric` (REAL). The `close` column SHALL be the single canonical price source for all downstream systems including `unified_daily_analytics.btc_price`.

#### Scenario: Table creation during pipeline initialization

- **WHEN** the `db_connector.py` module initializes `maftia_quant.db`
- **THEN** it MUST execute `CREATE TABLE IF NOT EXISTS master_ohlcv (date TEXT PRIMARY KEY, open REAL, high REAL, low REAL, close REAL, volume REAL)` using parameterized statements without data truncation

#### Scenario: Price propagation to unified analytics

- **WHEN** `run_report_pipeline.py` upserts records into `unified_daily_analytics`
- **THEN** `btc_price` SHALL equal `master_ohlcv.close` for the same date, NOT from external sources like `bitview.space`

## ADDED Requirements

### Requirement: Price Source Single Source of Truth

The `master_ohlcv.close` column SHALL be the ONLY canonical price source for `unified_daily_analytics.btc_price`. External price sources (e.g., `bitview.space`) SHALL NOT override or substitute this value.

#### Scenario: Pipeline uses master_ohlcv.close

- **WHEN** `run_report_pipeline.py` processes a date with both subsystem data and `master_ohlcv` data
- **THEN** `btc_price` in the upsert SHALL be `master_ohlcv.close`, not `val_btc_all.get(dt)`

#### Scenario: Missing master_ohlcv record handling

- **WHEN** a date exists in subsystem data but has no corresponding `master_ohlcv` record
- **THEN** `btc_price` SHALL be set to `NULL` (not estimated from external sources)
