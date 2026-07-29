# Component Distribution Guard Specification

## ADDED Requirements

### Requirement: Boundary Distribution Validation
After each component pipeline run, the system SHALL compute the percentage of `normalized_value` entries at the exact boundary values (`-2.0` or `+2.0`).

#### Scenario: Normal distribution
- **WHEN** a component pipeline finishes processing and the percentage of boundary values is low
- **THEN** the guard silently completes without raising warnings.

### Requirement: Degenerate Score Detection
If >95% of a component's historical normalized values are at a single boundary (`-2.0` or `+2.0`), the system SHALL log a WARNING containing the component name and the calculated percentage.

#### Scenario: Stuck boundary values detected
- **WHEN** 98% of a component's normalized values are pinned at `-2.0`
- **THEN** the system emits a WARNING log with the component name and the percentage.

### Requirement: Guard Integration and Advisory Nature
The validation SHALL run in the base pipeline (`_default_run_pipeline`) after the store step. The guard SHALL NOT block the pipeline — it is advisory only (log + return metadata). Validation SHALL use parameterized SQL queries with WAL mode.

#### Scenario: Guard execution during pipeline
- **WHEN** the store step completes in `_default_run_pipeline`
- **THEN** the guard runs parameterized SQL queries in WAL mode to check distributions, logs warnings if necessary, and allows the pipeline to proceed without interruption.
