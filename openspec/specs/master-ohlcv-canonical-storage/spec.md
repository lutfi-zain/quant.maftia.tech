# master-ohlcv-canonical-storage Specification

## Purpose
TBD - created by archiving change phase-1-data-and-wal-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Canonical Schema Definition for MasterOHLCV
The system SHALL maintain a relational table named `master_ohlcv` inside `maftia_quant.db` with strict column definitions: `date` (TEXT PRIMARY KEY in YYYY-MM-DD format), `open` (REAL NOT NULL), `high` (REAL NOT NULL), `low` (REAL NOT NULL), `close` (REAL NOT NULL), `volume` (REAL NOT NULL), and optional external metrics like `brk_metric` (REAL).

#### Scenario: Table creation during pipeline initialization
- **WHEN** the `db_connector.py` module initializes `maftia_quant.db`
- **THEN** it MUST execute `CREATE TABLE IF NOT EXISTS master_ohlcv (date TEXT PRIMARY KEY, open REAL, high REAL, low REAL, close REAL, volume REAL)` using parameterized statements without data truncation

### Requirement: Causal Ingestion Validation and Upsertion
The ingestion pipeline (`run_report_pipeline.py`) SHALL only insert or update daily records into `master_ohlcv` where `date <= current_utc_date()` ($t-1$ or closed daily bar causal boundary validation) using `INSERT OR REPLACE INTO master_ohlcv VALUES (?, ?, ?, ?, ?, ?)` parameterized queries.

#### Scenario: Future timestamp injection attempt
- **WHEN** an upstream exchange feed or API payload contains a bar with a timestamp greater than `current_utc_date()`
- **THEN** the `CausalFilter` inside `run_report_pipeline.py` MUST reject or drop the future bar and only commit causal historical bars into `master_ohlcv`

#### Scenario: Parameterized query execution on daily updates
- **WHEN** `run_report_pipeline.py` receives a valid closed daily bar
- **THEN** it MUST execute the upsert query strictly using `cursor.execute(sql, tuple_of_values)` to prevent string-formatting syntax errors and SQL injection

