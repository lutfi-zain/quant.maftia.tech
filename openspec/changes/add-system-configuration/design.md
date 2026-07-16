## Context

Currently, the daily synchronization pipeline (`run_report_pipeline.py`) is run as an OS crontab job. This configuration makes it difficult for a user accessing the quantitative terminal interface to monitor the scheduler's status, adjust synchronization intervals, or view execution logs. The goal is to move the cron schedule management inside the application's boundaries (managed by the Bun backend) and expose configuration tools in the React SPA.

## Goals / Non-Goals

**Goals:**
- Provide a unified, high-fidelity **Configuration Page** in the frontend React SPA.
- Implement a backend-native cron scheduler in Bun to trigger `run_report_pipeline.py` and log execution metrics to SQLite.
- Allow the user to update Valuation indicator thresholds and trigger a manual synchronization from the UI.
- Establish a premium, high-density, accessible layout for system configuration settings.

**Non-Goals:**
- Direct modification of the OS crontab files.
- Modification of mathematical model logic or introducing lookahead bias.

## Technical Decisions

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

---

## Frontend UI/UX Design System Specification (UI/UX Pro Max)

To maintain parity with the dark-terminal Bloomberg/Slate aesthetic of the quantitative platform, the Configuration Panel will follow a high-density, card-based grid layout with micro-animations, clear touch-target spacing, and strong visual hierarchy.

```
┌────────────────────────────────────────────────────────────────────────┐
│  CONFIGURATION                                                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────────────────┐   ┌──────────────────────────────┐  │
│  │ ⚙️ SYNC SCHEDULER              │   │ 📊 VALUATION METRIC CONFIG   │  │
│  ├───────────────────────────────┤   ├──────────────────────────────┤  │
│  │ Status: [ Active  ● ]          │   │ Select Metric: [ MVRV Z ] ▾  │  │
│  │ Interval: [ Daily (02:00) ] ▾ │   │                              │  │
│  │ Cron:    [ 0 2 * * *      ]   │   │ Thresholds:                  │  │
│  │ Next Run: 2026-07-17 02:00    │   │  • t_plus_2:  [  0.15 ]      │  │
│  │                               │   │  • t_plus_1:  [  0.17 ]      │  │
│  │ [ Save Changes ] [ Run Now ⚡ ]│   │  • t_minus_1: [  4.60 ]      │  │
│  │                               │   │  • t_minus_2: [  6.65 ]      │  │
│  └───────────────────────────────┘   │                              │  │
│                                      │ [ Save Thresholds ]          │  │
│  ┌───────────────────────────────┐   └──────────────────────────────┘  │
│  │ 💻 LATEST EXECUTION LOGS      │                                     │
│  ├───────────────────────────────┤                                     │
│  │ [02:00:01] Ingestion started. │                                     │
│  │ [02:00:15] Valuation complete.│                                     │
│  │ [02:00:23] Master sync done.  │                                     │
│  └───────────────────────────────┘                                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Visual Hierarchy & Aesthetic Tokens
- **Theme**: Slate/Zinc Dark Mode.
  - Background: `slate-950` (`#020617`) for deep terminal grounding.
  - Card Surface: `slate-900/50` (`#0f172a` at 50% opacity) with glassmorphism border (`border-slate-800/80`).
- **Color Palette & Signifiers**:
  - Primary Accent: `emerald-500` (`#10b981`) for active scheduler states, success logs, and confirmation triggers.
  - System Alert / Execution: `amber-500` (`#f59e0b`) for active run indicator and modified-but-unsaved configurations.
  - Error Indicators: `rose-500` (`#f43f5e`) for failed sync logs or invalid cron/numerical inputs.
- **Typography**:
  - Headings: Inter/Outfit (Semi-Bold `font-semibold`, letter-spacing `tracking-tight`).
  - Inputs & Code Blocks: JetBrains Mono / SF Mono (`font-mono`) to align numerical variables and cron strings on a perfect grid baseline.

### 2. Interaction Design & Micro-animations
- **Transitions**: All interactive hover, focus, and modal expansion states MUST transition smoothly using custom easing:
  - Duration: `200ms`
  - Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (Fluid Out)
- **Tappable Elements**:
  - Target Size: Minimum `44x44px` hit area (leveraging insets or `Pressable` padding).
  - Press Feedback: A subtle scale transform (`scale-98` / `active:scale-98`) combined with a background brightness change to signify hardware-like tactile feedback.
- **Scheduler Input UX**:
  - Mode Switcher: Tab bar switcher between "Preset Schedules" (e.g., Every Midnight, Every 12 Hours, Custom) and "Advanced (Cron String)".
  - Inline Validation: The Cron Input field validation executes on `blur` with visual indicators:
    - Valid: Green border glow (`shadow-emerald-500/20`).
    - Invalid: Red border glow (`shadow-rose-500/20`) with helper text dynamically describing the validation syntax error.

### 3. Log Console Terminal UX
- **Design**: Code-block terminal style (`bg-slate-950/80` with a slight inner shadow).
- **Auto-scroll**: Terminal container automatically scrolls to the bottom as new lines append during manual runs.
- **Copy-to-Clipboard**: A persistent icon-button in the top-right corner of the logs panel (labeled with aria-label) allowing quick export of sync logs.
- **Live Sync Transition**: When "Run Now" is triggered, the button transitions into a loading spinner state (`animate-spin`) and the logs console container transitions into view using a fade-and-slide motion (`opacity-100` and `translate-y-0` from `translate-y-2`).

### 4. Accessibility (WCAG 2.1 AA Compliance)
- **Color Contrast**: All text elements maintain a minimum contrast ratio of `4.5:1` against their respective backgrounds (e.g. Slate-300 on Slate-900).
- **Aria Attributes**:
  - Active log console uses `aria-live="polite"` to dynamically read log additions to screen-reader users.
  - Error messages use `role="alert"` for immediate screen-reader warnings.
- **Focus Rings**: Custom, high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`) are defined on all interactive inputs and buttons.

---

## Risks / Trade-offs

- **[Risk]** Overlapping Sync Executions: If a sync is triggered manually while a scheduled sync is running, it could cause SQLite write locks.
  - *Mitigation:* The backend will maintain an in-memory `isSyncing` flag and reject any new sync requests (returning HTTP 409 Conflict) if a sync is already in progress.
- **[Risk]** Bun process restart terminates the scheduler.
  - *Mitigation:* Ensure `start.sh` or pm2 keeps the Bun server running in the background. At start-up, Bun always queries `system_config` to re-initialize the scheduler.
