## Why

Managing quantitative sync schedules currently requires manual, low-level OS-level command configurations (such as Linux crontab) which are prone to user-input syntax errors and run-time environment mismatches. By introducing a self-contained Backend-driven Cron Scheduler and a Frontend Configuration panel, users can view, update, and manage synchronization intervals and model configurations (such as Valuation thresholds and defense posture overrides) directly from the interface, ensuring operational simplicity and reliability.

## What Changes

- **Frontend Configuration Panel**: A new route/view in the React SPA (`/configuration`) displaying:
  - **Sync Scheduler Management**: CRUD for active cron sync intervals (e.g., standard cron strings like `0 2 * * *` or preset intervals).
  - **System Parameters Config**: Control over model parameters, specifically valuation threshold configurations (`metric_config` table) and circuit-breaker settings.
  - **Sync Logs / Status Widget**: Real-time status display of the latest/next run, plus triggers to execute a sync immediately.
- **Backend Cron Scheduler**:
  - Integrate a self-contained cron-scheduler library (e.g., `croner` or native JavaScript timers) inside the Bun + Hono API Gateway process.
  - Dynamically read scheduler schedules from a new SQLite config table (`system_config`).
  - Automatically reload running background jobs when the configuration changes via API.
- **SQLite Database Additions**:
  - Create a new `system_config` table in `maftia_quant.db` to save key-value pairs (schedules, system parameters).

## Capabilities

### New Capabilities
- `system-configuration`: Provides UI controls for scheduler CRUD, valuation metric config updates, and backend-driven automatic scheduler execution.

### Modified Capabilities
None.

## Non-Goals
- Changing the underlying quantitative core mathematical models or signals.
- Re-introducing or editing the deprecated `quant-technical-indicator-bank`.
- Modifying OS-level `crontab` files directly; all scheduling is handled inside the application's runtime.

## Impact

- **Affected Systems**: All 4 unified quantitative systems (Valuation, LTTD, MTTD, Ichimoku) will be triggered by the new backend-driven scheduler when executing `run_report_pipeline.py`.
- **Database**: Adds `system_config` table to `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db`.
- **API**: Introduces new API routes (`GET/POST /api/v1/config/scheduler`, `POST /api/v1/config/sync/run`).
- **Mathematical Causal Filter**: All math transformations and data syncing executed by the scheduler maintain strict causal filtering ($t-1$ stamp verification) to prevent lookahead bias.
