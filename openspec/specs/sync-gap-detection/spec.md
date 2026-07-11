# sync-gap-detection Specification

## Purpose
TBD - created by archiving change frontend-dashboard-revamp. Update Purpose after archive.
## Requirements
### Requirement: Sync gap UI exposed in AppLayout header
The `AppLayout` header SHALL render a sync status indicator showing whether the client data matches the server's latest available data, and a `⟳ Sync Data` action button.

#### Scenario: Sync badge renders in header
- **WHEN** the application header renders
- **THEN** a sync status badge appears to the right of the main title area showing either `⚠ N day(s) behind` or `✓ Data current`

#### Scenario: Sync button triggers refresh
- **WHEN** user clicks the `⟳ Sync Data` button
- **THEN** the `refreshData()` context function is invoked; button shows a loading spinner during fetch

### Requirement: AppLayout header exposes global Log/Linear toggle
The `AppLayout` header SHALL render a `[LOG | LIN]` toggle segment control. This toggle SHALL be passed as a prop/callback to the active chart component on the dashboard tab.

#### Scenario: Toggle visible on dashboard tab
- **WHEN** user is on the `dashboard` tab
- **THEN** `[LOG | LIN]` toggle segment is visible in the header

#### Scenario: Toggle hidden on studio tabs
- **WHEN** user switches to any studio tab (valuation, lttd, mttd, ichimoku)
- **THEN** the global LOG/LIN toggle is hidden (each studio manages its own toggle internally)

### Requirement: Header removes non-operational badge clutter
The current "85px Y-AXIS LOCK" and "SQLite WAL" badges in the header SHALL be removed. They provide no user value and waste header space.

#### Scenario: Clean header on all tabs
- **WHEN** any tab is active
- **THEN** the header shows only: page title, subtitle, sync gap badge, and action buttons

