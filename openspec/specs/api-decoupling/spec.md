# Spec: Decouple API Subsystem Dependencies

## Context

Currently, the `quant.maftia.tech` API Gateway has direct dependencies on the filesystems of the 4 independent quantitative systems. This tightly couples the operational environment and prevents standalone deployments of the API server. This spec defines the modifications to route all data through `maftia_quant.db`, utilizing `UnifiedDailyAnalytics`, `UnifiedComponentSignals`, and newly added tables.

## 1. Database Schema Changes (`data/maftia_quant.db`)

To remove the API's reliance on `quant-btc-valuation-system/database/metrics.db`, the pipeline must populate two new tables in the master DB.

### 1.1 `timeseries_metrics`
Stores the raw and normalized metric timeseries.
```sql
CREATE TABLE IF NOT EXISTS timeseries_metrics (
    date             TEXT,
    metric_name      TEXT,
    raw_value        REAL,
    normalized_value REAL,
    btc_price        REAL,
    PRIMARY KEY (date, metric_name)
);
```

### 1.2 `metric_config`
Stores the threshold parameters for each metric.
```sql
CREATE TABLE IF NOT EXISTS metric_config (
    metric_name    TEXT PRIMARY KEY,
    t_minus_2      REAL,
    t_minus_1      REAL,
    t_zero         REAL,
    t_plus_1       REAL,
    t_plus_2       REAL
);
```

## 2. Pipeline Modifications (`run_report_pipeline.py`)

The orchestrator script must synchronize these new tables from the Valuation subsystem. 
- Use SQLite Write-Ahead Logging (`WAL`) mode via `get_wal_connection`.
- Use parameterized SQL queries (`?-style`) via `execute_parameterized`.

### 2.1 Sync Logic
Before closing the `master_conn` (around line 588 of `run_report_pipeline.py`), append the sync logic for the two tables:
1. Connect to `VALUATION_DIR/database/metrics.db`.
2. Select all rows from `timeseries_metrics` where `date <= current_utc_date_str`.
3. Insert or replace them into `timeseries_metrics` in `maftia_quant.db`.
4. Select all rows from `metric_config`.
5. Insert or replace them into `metric_config` in `maftia_quant.db`.
6. Commit `master_conn`.

## 3. API Gateway Modifications (`src/api/`)

### 3.1 `src/api/db.ts`
- Remove the hardcoded absolute path `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db`.
- Use environment variable fallback and relative path resolution:
  ```typescript
  export const DB_PATH = process.env.MAFTIA_DB_PATH 
      || path.resolve(import.meta.dir, '../../data/maftia_quant.db');
  ```

### 3.2 `src/api/routes/metrics.ts`
- **Remove:** `getMetricsDb()` function, `METRICS_DB_PATH` constant, and `better-sqlite3`/`bun:sqlite` specific to metrics.
- **Update GET `/:metric_name`:** 
  - Switch from `subsystemDb.prepare("SELECT ... FROM timeseries_metrics ...").all(...)` to `executeQuery(...)` using the local DB.
- **Update GET `/:metric_name/config`:**
  - Switch from `subsystemDb.prepare("SELECT ...").get(...)` to `executeQuerySingle(...)`.
- **Update POST `/:metric_name/config`:**
  - Switch from `subsystemDb.prepare(...).run(...)` to executing parameterized statements on the local DB.
- **Remove POST `/:metric_name/renormalize` endpoint:**
  - Delete this route entirely, as running Python subprocesses is an ETL concern, not a read-only API concern.

### 3.3 `src/api/routes/lttd.ts`
- **Remove POST `/actions/run` endpoint:**
  - Delete lines 470-557. This endpoint spawns Python scripts (`run_pipeline.py`, `backfill.py`, etc.) for `quant-btc-lttd-system`. This operational capability will be restricted to the CLI.

## 4. Documentation Updates

- Update `docs/architecture/*.md` as needed to reflect that the API Gateway communicates **only** with `maftia_quant.db`.
- Ensure all diagrams reflect that the subsystems feed `run_report_pipeline.py`, which populates `MasterOHLCV`, `UnifiedDailyAnalytics`, `UnifiedComponentSignals`, `timeseries_metrics`, and `metric_config`.
