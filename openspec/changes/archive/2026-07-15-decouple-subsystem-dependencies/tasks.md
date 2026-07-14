# Implementation Tasks: Decouple Subsystem Dependencies

## 1. Pipeline Sync Updates (Valuation System Boundary)

**Objective**: Ensure raw metrics and threshold configs from the Valuation System are synced to the local master database so the API can read them without external filesystem access.

- [x] Update `/home/ubuntu/projects/run_report_pipeline.py` to create `timeseries_metrics` and `metric_config` tables in `maftia_quant.db`.
- [x] Add parameterized SQL (`?-style`) sync logic for `timeseries_metrics` using SQLite WAL mode connection.
- [x] Add parameterized SQL (`?-style`) sync logic for `metric_config` using SQLite WAL mode connection.
- [x] Test the pipeline script manually to verify tables are populated in `data/maftia_quant.db`.

## 2. API Database Connector (Platform Boundary)

**Objective**: Ensure the local DB connector uses relative paths and is configurable via environment variables.

- [x] Modify `src/api/db.ts` to use `import.meta.dir` and `process.env.MAFTIA_DB_PATH` instead of the hardcoded `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db` absolute path.

## 3. Valuation API Endpoint Refactor (Valuation System Boundary)

**Objective**: Remove direct external database connection to `metrics.db` and the external python subprocess spawning.

- [x] Modify `src/api/routes/metrics.ts`: Remove `getMetricsDb()` function, remove `better-sqlite3`/`bun:sqlite` instantiation, and remove the `METRICS_DB_PATH` constant.
- [x] Update `GET /:metric_name`, `GET /:metric_name/config`, and `POST /:metric_name/config` to use `executeQuery` / `executeQuerySingle` from `../db.js`.
- [x] Remove `POST /:metric_name/renormalize` endpoint completely.

## 4. LTTD API Endpoint Refactor (LTTD System Boundary)

**Objective**: Remove Python subprocess orchestration from the API gateway.

- [x] Modify `src/api/routes/lttd.ts`: Delete the `POST /actions/run` endpoint (lines 470-557).

## 5. Documentation (System-Wide)

**Objective**: Update docs to reflect the new decoupled data flow.

- [x] Update `docs/architecture/00_end_to_end.md` and `docs/architecture/01_valuation_system.md` to remove references to the API gateway reading from external DBs or spawning scripts.

## 6. Verification and Commit

**Objective**: Verify system integrity and commit the changes following strict conventions.

- [x] Run automated pipeline verification: `python3 /home/ubuntu/projects/run_report_pipeline.py`.
- [x] Verify API health and endpoints: `bun run src/api/index.ts` and fetch metrics data.
- [x] Commit changes adhering to Conventional Commits specification (e.g., `refactor: decouple API from external filesystem dependencies`).
