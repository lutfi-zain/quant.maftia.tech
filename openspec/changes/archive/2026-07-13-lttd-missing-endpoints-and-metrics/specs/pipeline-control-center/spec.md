## ADDED Requirements

### Requirement: LttdLab shall display Pipeline Control Center panel

The LTTD Studio SHALL render a Pipeline Control Center panel with action trigger buttons and a real-time execution log for managing the LTTD data pipeline.

#### Scenario: Action trigger buttons

- **WHEN** the panel renders
- **THEN** it displays action buttons for: Sync Today's Data, Recover Last 10 Days, Sync Gap, Run VIF Audit, Full Repopulation
- **THEN** each button shows an icon, name, and description
- **THEN** clicking a button calls `POST /api/v1/lttd/actions/run` with `action` set to the corresponding action ID (`sync_today`, `recover_10d`, `sync_gap`, `vif_audit`, `full_repopulation`)

#### Scenario: Execution log

- **WHEN** an action is triggered
- **THEN** a log entry appears in the Execution Log panel showing:
  - Timestamp
  - Action name
  - Status (Running → Success/Failed)
  - Output text (truncated)
- **THEN** the log is displayed with newest entries first, max 5 entries visible

#### Scenario: Loading state and disabled buttons

- **WHEN** an action is currently running
- **THEN** all action buttons are disabled with reduced opacity
- **THEN** "Running..." text replaces the action label on the executing button

#### Scenario: Confirmation dialogs

- **WHEN** user clicks "Reset DB"
- **THEN** a browser confirmation dialog appears: "Are you sure you want to completely RESET the database? This cannot be undone."
- **WHEN** user clicks "Full Repopulation"
- **THEN** a browser confirmation dialog appears: "Full repopulation will take a long time. Proceed?"

#### Scenario: Error handling

- **WHEN** the API call fails
- **THEN** the log entry status shows "Failed" in red with the error message
- **THEN** buttons remain enabled for retry
