## 1. Centralized SQLite WAL Connector Setup

- [x] 1.1 Create `db_connector.py` implementing `get_wal_connection(db_path: str) -> sqlite3.Connection` with `PRAGMA journal_mode=WAL;`, `PRAGMA synchronous=NORMAL;`, and `PRAGMA busy_timeout=10000;`
- [x] 1.2 Write unit test `test_db_connector.py` verifying `journal_mode == wal` and proper connection cleanup across multi-threaded operations
- [x] 1.3 Commit `db_connector.py` utility adhering to Conventional Commits (`feat: implement shared sqlite wal mode connection utility`)

## 2. Ingestion Pipeline & MasterOHLCV Parameterization

- [ ] 2.1 Refactor `run_report_pipeline.py` and subsystem data connectors to import and route database connections through `db_connector.get_wal_connection()`
- [ ] 2.2 Migrate raw or unparameterized SQL queries in the ingestion loop to `cursor.execute("INSERT OR REPLACE INTO master_ohlcv VALUES (?, ?, ?, ?, ?, ?)", (...))` parameterized format
- [ ] 2.3 Implement and verify `CausalFilter` index check ($t-1$ or `date <= current_utc_date()`) inside `run_report_pipeline.py` before inserting bars into `master_ohlcv` and `unified_daily_analytics`
- [ ] 2.4 Commit pipeline refactoring adhering to Conventional Commits (`quant: enforce parameterized queries and causal filter in data ingestion pipeline`)

## 3. Automated Verification & Phase 1 Handoff

- [ ] 3.1 Run end-to-end orchestration verification `python3 /home/ubuntu/projects/run_report_pipeline.py` and confirm 0 `database is locked` errors
- [ ] 3.2 Verify WAL mode state across `maftia_quant.db` and subsystem databases using `sqlite3 -line <db> "PRAGMA journal_mode;"`
- [ ] 3.3 Commit any final bugfixes adhering to Conventional Commits (`test: verify phase 1 data ingestion and wal pipeline stability`)
