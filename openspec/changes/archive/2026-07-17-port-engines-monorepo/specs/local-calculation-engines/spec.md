## ADDED Requirements

### Requirement: Local Engines Directory Structure
The system SHALL organize all quantitative calculation logic inside the local `engines/` directory at the project root. This directory MUST contain four subfolders: `engines/valuation`, `engines/lttd`, `engines/mttd`, and `engines/ichimoku`.

#### Scenario: File structure initialized
- **WHEN** the files are ported
- **THEN** folders for all 4 subsystems exist in the local project directory structure and can run independently of external filesystem files

### Requirement: Pipeline Relative Path Resolution
The system's daily orchestrator `run_report_pipeline.py` SHALL resolve the subsystem directory paths (`VALUATION_DIR`, `LTTD_DIR`, `MTTD_DIR`, `ICHIMOKU_DIR`) relatively within the project directory structure rather than pointing to hardcoded absolute system paths (such as `/home/ubuntu/projects/`).

#### Scenario: Relative path execution
- **WHEN** `run_report_pipeline.py` is executed
- **THEN** it resolves paths relative to the script location and executes the calculations from `engines/` successfully
