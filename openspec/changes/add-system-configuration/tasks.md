## 1. Database Configuration Setup

- [ ] 1.1 Create the migration code/seed routine in the backend to initialize the `system_config` table in `maftia_quant.db` using SQLite WAL mode.
- [ ] 1.2 Seed default configuration records (e.g. `sync_schedule = "0 2 * * *"` and `scheduler_active = "true"`).

## 2. Backend Cron Scheduler Integration

- [ ] 2.1 Add the `croner` library to the Bun backend dependency declarations (`package.json`).
- [ ] 2.2 Implement a `SchedulerService` module in the Bun backend (`src/api/lib/scheduler.ts` or similar) that parses standard cron strings, schedules the execution of the pipeline, and updates sync metrics in SQLite.
- [ ] 2.3 Add `child_process` spawn logic to execute `python3 run_report_pipeline.py` and capture STDOUT/STDERR logs to the database.
- [ ] 2.4 Handle in-memory concurrency limits to prevent simultaneous manual/scheduled runs of the pipeline.

## 3. REST API Endpoints

- [ ] 3.1 Register `GET /api/v1/config/scheduler` to fetch the current schedule, active status, last execution runtime, status, and logs.
- [ ] 3.2 Register `POST /api/v1/config/scheduler` to update schedule settings and dynamically reschedule the background cron job.
- [ ] 3.3 Register `POST /api/v1/config/sync/run` to manually trigger an immediate background pipeline execution.

## 4. Frontend Navigation and Configuration Panel UI

- [ ] 4.1 Register `/configuration` route in the frontend router structure.
- [ ] 4.2 Add a "Configuration" sidebar link/item in the navigation shell.
- [ ] 4.3 Implement the **Sync Scheduler Widget**: show active cron expression, toggle active status, show next run timestamp, and offer a "Run Now" button.
- [ ] 4.4 Implement the **Valuation Threshold Editor**: drop-down to select one of the 17 valuation metrics and text inputs for `t_minus_2`, `t_minus_1`, `t_zero`, `t_plus_1`, `t_plus_2` to perform CRUD on `metric_config`.
- [ ] 4.5 Implement the **Sync Logs View**: displays the terminal logs of the last run.

## 5. Verification and Testing

- [ ] 5.1 Verify that the scheduler dynamically updates when edited from the FE configuration page.
- [ ] 5.2 Validate that clicking "Run Now" successfully spawns the pipeline, completes the run, and updates dashboard metrics.
- [ ] 5.3 Verify that commit messages follow the Conventional Commits specification.
