## ADDED Requirements

### Requirement: Centralized SQLite WAL Connection Utility (`db_connector.py`)
The system SHALL provide a shared connection utility (`db_connector.py`) that initializes SQLite connections with `PRAGMA journal_mode=WAL;`, `PRAGMA synchronous=NORMAL;`, and `PRAGMA busy_timeout=10000;` before executing transactions across `maftia_quant.db` and any subsystem database files (`valuation.db`, `lttd.db`).

#### Scenario: Connection setup verification
- **WHEN** any Python script or API service calls `get_wal_connection(db_path)`
- **THEN** the returned SQLite connection handle MUST have `journal_mode` set to `wal` and a `busy_timeout` of `10000` milliseconds

### Requirement: Elimination of SQLite Database Lock Contention
All quantitative scripts (`run_report_pipeline.py`, `quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`) SHALL route their database operations through `db_connector.py` and ensure cursor/connection handles are cleanly closed after transactions or query executions.

#### Scenario: Concurrent write and read simulation
- **WHEN** `run_report_pipeline.py` executes a multi-table transaction writing to `master_ohlcv` and `unified_daily_analytics` while the Hono API Gateway (`:8765`) concurrently reads daily analytics
- **THEN** both operations MUST succeed concurrently without raising `sqlite3.OperationalError: database is locked`
