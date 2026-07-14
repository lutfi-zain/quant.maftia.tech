## Why

Currently, the `quant.maftia.tech` repository relies on the existence of external sibling folders (such as `quant-btc-valuation-system`, `quant-btc-lttd-system`, etc.) in `/home/ubuntu/projects` for daily analytical calculations. Although the API Gateway and frontend are decoupled from these systems at runtime, the ETL orchestrator (`run_report_pipeline.py`) still executes subprocesses within those external directories. To achieve modular, self-contained independence and ease deployment across environments without filesystem cross-talk, we need to port all 4 quantitative engines into a unified local monorepo directory layout under `engines/`.

## What Changes

- **Porting**: Copy the core Python modules and required mathematical scripts for all 4 subsystems into a local directory structure: `engines/valuation`, `engines/lttd`, `engines/mttd`, and `engines/ichimoku`.
- **Pipeline Refactoring**: Update `run_report_pipeline.py` to point its subsystem paths (`VALUATION_DIR`, `LTTD_DIR`, etc.) to the local `engines/` subdirectories.
- **Dependency Consolidation**: Ensure necessary Python package dependencies for all 4 engines are documented locally.

## Capabilities

### New Capabilities
- `local-calculation-engines`: Implementing a self-contained local engines structure that runs quantitative calculations inside the project folder.

### Modified Capabilities
- None

## Impact

- **Affected Systems**: All 4 quantitative systems (Valuation, LTTD, MTTD, Ichimoku) as their execution paths shift inside `quant.maftia.tech`.
- **Affected Code**: `run_report_pipeline.py` paths, and the new `engines/` directory structure.
- **Zero Lookahead Bias**: No changes are made to the actual signal math, HMM calculations, or time-series causal filter parameters (strictly t-1 causal).

## Non-goals

- We will not alter any quantitative parameters, strategy models, or statistical calculations.
- We will not copy or include legacy frontend, backend API server, or git history folders of the individual subsystems.
- The deprecated `quant-technical-indicator-bank` will remain untouched and excluded.
