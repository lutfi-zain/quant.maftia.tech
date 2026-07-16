## Context

Currently, the daily synchronization pipeline (`run_report_pipeline.py`) is run as an OS crontab job. This configuration makes it difficult for a user accessing the quantitative terminal interface to monitor the scheduler's status, adjust synchronization intervals, or view execution logs. The goal is to move the cron schedule management inside the application's boundaries (managed by the Bun backend) and expose configuration tools in the React SPA.

## Goals / Non-Goals

**Goals:**
- Provide a unified **Configuration Page** in the frontend React SPA.
- Implement a backend-native cron scheduler in Bun to trigger `run_report_pipeline.py` and log execution metrics to SQLite.
- Allow the user to update Valuation indicator thresholds and trigger a manual synchronization from the UI.

**Non-Goals:**
- Direct modification of the OS crontab files.
- Modification of mathematical model logic or introducing lookahead bias.

## Decisions

### 1. Backend Cron Engine
- **Option A (Chosen):** Use the `croner` library in the Bun backend. It is pure JS, highly reliable under Bun, support standard cron expressions, and allows stopping/restarting cron jobs dynamically without restarting the server.
- **Option B:** Simple `setInterval` loop checking the database config every minute. (Rejected because cron parsing is complex and error-prone to implement manually).
- **Option C:** OS-level crontab file writes via Node's `child_process`. (Rejected because writing to `/etc/crontab` or user crontab requires elevated permissions and is fragile).

### 2. Database Schema for System Config
Add a `system_config` key-value table inside `maftia_quant.db` using parameterised queries:
```sql
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT
);
```
Keys stored:
- `sync_schedule`: Cron string (e.g. `0 2 * * *`).
- `scheduler_active`: `"true"` or `"false"`.
- `last_sync_timestamp`: ISO time of the last finished execution.
- `last_sync_status`: `"success"` or `"error"`.
- `last_sync_log`: Terminal log outputs of the last run.

### 3. Frontend Layout & Navigation
Add a new link named "Configuration" to the main Navigation Sidebar. The configuration view will contain:
- A Card for **Sync Scheduler**: displays current schedule, scheduler status (active/inactive), and "Run Now" action.
- A Card for **Valuation Metrics Configurations**: allows selecting any of the 17 valuation metrics from a select input, fetching its current config from `/api/v1/analytics/metric/:metric_name/config`, and saving edits.

## Risks / Trade-offs

- **[Risk]** Overlapping Sync Executions: If a sync is triggered manually while a scheduled sync is running, it could cause SQLite write locks.
  - *Mitigation:* The backend will maintain an in-memory `isSyncing` flag and reject any new sync requests (returning HTTP 409 Conflict) if a sync is already in progress.
- **[Risk]** Bun process restart terminates the scheduler.
  - *Mitigation:* Ensure `start.sh` or pm2 keeps the Bun server running in the background. At start-up, Bun always queries `system_config` to re-initialize the scheduler.
