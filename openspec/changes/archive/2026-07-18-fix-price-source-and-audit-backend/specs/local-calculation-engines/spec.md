## MODIFIED Requirements

### Requirement: Local Engines Directory Structure

The system SHALL organize all quantitative calculation logic inside the local `engines/` directory at the project root. This directory MUST contain four subfolders: `engines/valuation`, `engines/lttd`, `engines/mttd`, and `engines/ichimoku`. Additionally, shared calculation modules (including the SDCA engine) SHALL be placed in `src/lib/` for use by both the API gateway and frontend.

#### Scenario: File structure initialized

- **WHEN** the files are ported
- **THEN** folders for all 4 subsystems exist in the local project directory structure and can run independently of external filesystem files

#### Scenario: Shared SDCA engine module

- **WHEN** the API gateway or frontend needs SDCA signal computation
- **THEN** they SHALL import from `src/lib/sdcaEngine.ts` (shared module)

### Requirement: Pipeline Relative Path Resolution

The system's daily orchestrator `run_report_pipeline.py` SHALL resolve the subsystem directory paths (`VALUATION_DIR`, `LTTD_DIR`, `MTTD_DIR`, `ICHIMOKU_DIR`) relatively within the project directory structure rather than pointing to hardcoded absolute system paths (such as `/home/ubuntu/projects/`).

#### Scenario: Relative path execution

- **WHEN** `run_report_pipeline.py` is executed
- **THEN** it resolves paths relative to the script location and executes the calculations from `engines/` successfully

## ADDED Requirements

### Requirement: Backend-Computed Backtests for Auditability

The API gateway SHALL provide server-side backtest computation endpoints that复现 the same logic as frontend `useStudioBacktest()` and `useSdcaBacktest()`. These endpoints SHALL use the canonical `master_ohlcv.close` price source and database-stored position values.

#### Scenario: LTTD backtest matches frontend

- **WHEN** `GET /api/v1/lttd/backtest` is called with the same parameters as the frontend
- **THEN** the returned metrics (sharpeRatio, totalReturn, maxDrawdown) SHALL match within 0.01% tolerance

#### Scenario: SDCA backtest available

- **WHEN** `POST /api/v1/sdca/backtest` is called
- **THEN** it SHALL return equity curves, trade logs, and metrics computed server-side using `master_ohlcv.close` and `valuation_composite`
