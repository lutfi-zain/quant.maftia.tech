## ADDED Requirements

### Requirement: Database configuration storage

The system MUST persist configuration parameters (including cron strings, last run timestamp, next run timestamp, and scheduler active status) inside a dedicated `system_config` table in `maftia_quant.db` using parameterized SQL queries.

#### Scenario: Successful configuration storage

- **WHEN** the backend initializes the database or saves a new configuration
- **THEN** it executes parameterized SQL writes to the `system_config` table in SQLite WAL mode

### Requirement: Backend-driven Cron Scheduler

The backend API Gateway MUST run a self-contained background cron scheduler that executes `run_report_pipeline.py` based on the configured cron string saved in the database.

#### Scenario: Scheduler reloads configuration

- **WHEN** the scheduler configuration is updated via the API Gateway
- **THEN** the backend dynamically re-initializes and reschedules the running cron job without requiring a server restart

### Requirement: Sync Schedule CRUD API

The Hono API Gateway MUST expose REST endpoints to retrieve, update, and delete the cron schedule configuration and trigger an immediate synchronization.

#### Scenario: User requests immediate sync run

- **WHEN** the user sends a POST request to `/api/v1/config/sync/run`
- **THEN** the backend immediately spawns `run_report_pipeline.py` in the background and writes the execution status to the config table

### Requirement: Frontend Configuration Interface

The React SPA MUST provide a Configuration view allowing the user to view, edit, and trigger the sync schedules, as well as configure individual Valuation metric thresholds.

#### Scenario: User updates valuation thresholds from Configuration view

- **WHEN** the user edits a threshold on the Configuration page and clicks Save
- **THEN** the SPA sends a POST request to `/api/v1/analytics/metric/:metric_name/config` and updates the database
