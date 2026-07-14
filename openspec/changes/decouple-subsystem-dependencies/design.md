# Design: Decouple Subsystem Dependencies

## Design Approach

**Strategy: Database Boundary Isolation**

The decoupling follows a strict "single source of truth" pattern where `quant.maftia.tech` communicates with subsystems exclusively through the `data/maftia_quant.db` SQLite database, which acts as a materialized view of all subsystem outputs.

```
┌─────────────────────────────────────────────────────────────────┐
│  BEFORE (Current Architecture)                                  │
│                                                                 │
│  quant.maftia.tech API                                         │
│    ├── metrics.ts ──────► /projects/quant-btc-valuation-system/ │
│    │                         ├── database/metrics.db (direct)   │
│    │                         └── scripts/renormalize_metric.py  │
│    ├── lttd.ts ─────────► /projects/quant-btc-lttd-system/     │
│    │                         ├── run_pipeline.py (subprocess)   │
│    │                         ├── backfill.py (subprocess)       │
│    │                         └── ... (4 more subprocesses)      │
│    └── db.ts ───────────► data/maftia_quant.db                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AFTER (Target Architecture)                                    │
│                                                                 │
│  quant.maftia.tech API                                         │
│    ├── metrics.ts ──┐                                          │
│    ├── lttd.ts ─────┤                                          │
│    ├── daily.ts ────┼──────► data/maftia_quant.db (ONLY)       │
│    ├── components.ts┤         ├── master_ohlcv                 │
│    └── db.ts ───────┘         ├── unified_daily_analytics      │
│                               ├── unified_component_signals    │
│                               ├── timeseries_metrics (NEW)     │
│                               └── metric_config (NEW)          │
│                                                                 │
│  run_report_pipeline.py (EXTERNAL ETL - unchanged boundary)    │
│    ├── Reads from 4 subsystem databases/files                  │
│    └── Writes to data/maftia_quant.db                          │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Design

### 1. New Database Tables in `maftia_quant.db`

Two tables must be added to `maftia_quant.db` to replace the direct `metrics.db` dependency:

```sql
-- Raw metric timeseries values (mirrors quant-btc-valuation-system/database/metrics.db → timeseries_metrics)
CREATE TABLE IF NOT EXISTS timeseries_metrics (
    date           TEXT,
    metric_name    TEXT,
    raw_value      REAL,
    normalized_value REAL,
    btc_price      REAL,
    PRIMARY KEY (date, metric_name)
);

-- Per-metric threshold configuration (mirrors metrics.db → metric_config)
CREATE TABLE IF NOT EXISTS metric_config (
    metric_name    TEXT PRIMARY KEY,
    t_minus_2      REAL,
    t_minus_1      REAL,
    t_zero         REAL,
    t_plus_1       REAL,
    t_plus_2       REAL
);
```

### 2. Pipeline Sync Additions (`run_report_pipeline.py`)

The pipeline must add a sync step for `timeseries_metrics` and `metric_config`:

```python
# Sync raw timeseries_metrics from valuation subsystem
val_conn = get_wal_connection(os.path.join(VALUATION_DIR, "database/metrics.db"))
tm_rows = val_conn.execute(
    "SELECT date, metric_name, raw_value, normalized_value, btc_price FROM timeseries_metrics WHERE date <= ?",
    (current_utc_date_str,)
).fetchall()
val_conn.close()

for row in tm_rows:
    execute_parameterized(
        master_conn,
        """INSERT OR REPLACE INTO timeseries_metrics (date, metric_name, raw_value, normalized_value, btc_price)
           VALUES (?, ?, ?, ?, ?)""",
        row, commit=False
    )
master_conn.commit()

# Sync metric_config
val_conn = get_wal_connection(os.path.join(VALUATION_DIR, "database/metrics.db"))
mc_rows = val_conn.execute("SELECT metric_name, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2 FROM metric_config").fetchall()
val_conn.close()
for row in mc_rows:
    execute_parameterized(
        master_conn,
        """INSERT OR REPLACE INTO metric_config (metric_name, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2)
           VALUES (?, ?, ?, ?, ?, ?)""",
        row, commit=False
    )
master_conn.commit()
```

### 3. metrics.ts Rewrite

**Before:**
```typescript
const METRICS_DB_PATH = "/home/ubuntu/projects/quant-btc-valuation-system/database/metrics.db";
// ... Opens separate connection to external DB
const subsystemDb = getMetricsDb();
const rawRows = subsystemDb.prepare("SELECT ...").all(metricName, ...);
```

**After:**
```typescript
// Uses existing executeQuery from db.ts - reads from maftia_quant.db
const rawRows = executeQuery(
    "SELECT date, raw_value FROM timeseries_metrics WHERE metric_name = ? AND date >= ? AND date <= ? ORDER BY date ASC",
    [metricName, startParam, endParamRaw]
);
```

Key changes:
- Remove `getMetricsDb()` function entirely
- Remove `METRICS_DB_PATH` constant
- Remove `better-sqlite3` and `bun:sqlite` dual-runtime database creation
- Use existing `executeQuery()` / `executeQuerySingle()` from `../db.js`
- Update `/config` GET endpoint to read from `metric_config` table in `maftia_quant.db`
- Update `/config` POST endpoint to write to `metric_config` table in `maftia_quant.db`
- Remove `/renormalize` endpoint entirely (this is an admin/pipeline action)

### 4. lttd.ts Changes

**Remove:** The `/api/v1/lttd/actions/run` endpoint (lines 470-557) which spawns external processes.

**Keep unchanged:** All read-only endpoints (`/latest`, `/history`, `/chart`, `/regime`, `/diagnostics`, `/onchain`, `/backtest`) — these already read from `maftia_quant.db`.

### 5. db.ts Path Resolution

**Before:**
```typescript
export const DB_PATH = path.resolve('/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db')
```

**After:**
```typescript
export const DB_PATH = process.env.MAFTIA_DB_PATH
    || path.resolve(import.meta.dir, '../../data/maftia_quant.db');
```

This makes the database path:
1. Configurable via environment variable for deployment
2. Resolved relative to the module location as a fallback

## Compatibility

### API Contract Preservation

| Endpoint | Change | Notes |
|----------|--------|-------|
| `GET /api/v1/quant/metric/:name` | **Data source changed** | Same response shape; data now from `maftia_quant.db` |
| `GET /api/v1/quant/metric/:name/config` | **Data source changed** | Same response shape |
| `POST /api/v1/quant/metric/:name/config` | **Data source changed** | Writes to `maftia_quant.db` instead of external db |
| `GET /api/v1/quant/metric/defaults` | **No change** | Hardcoded defaults unchanged |
| `POST /api/v1/quant/metric/:name/renormalize` | **REMOVED** | Admin action, not API concern |
| `POST /api/v1/lttd/actions/run` | **REMOVED** | Pipeline orchestration, not API concern |
| All other endpoints | **No change** | Already read from `maftia_quant.db` |

### Breaking Changes

1. **`POST /renormalize`** — Removed. Frontend Valuation Studio must hide the renormalize button or show a message directing users to run the pipeline CLI.
2. **`POST /lttd/actions/run`** — Removed. Frontend LTTD Lab must remove the admin action buttons or grey them out.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Migrate raw metrics into `maftia_quant.db` rather than proxying to external DB | Eliminates cross-filesystem dependency; enables deployment |
| D2 | Remove `/renormalize` and `/actions/run` rather than reimplementing | These are ETL/admin operations that break the read-only API gateway pattern |
| D3 | Use env var + relative path for DB_PATH | Enables deployment to any server without code changes |
| D4 | Keep pipeline sync additions in `run_report_pipeline.py` | This is the established ETL boundary; adding more sync targets is consistent |
