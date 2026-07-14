## Why

The recent architectural decoupling successfully isolated the `quant.maftia.tech` API Gateway and Frontend from the direct filesystems of the 4 external quantitative systems. The API now exclusively reads from the unified `maftia_quant.db` local SQLite database. However, the existing architecture documentation in `docs/architecture/` (especially `00_end_to_end.md` and the subsystem files) still reference the old coupled architecture where the API reads directly from `metrics.db` and spawns `python3` subprocesses on the fly. We need to update these documents to reflect the new decoupled data flow to prevent developer confusion and ensure architectural gold standards remain accurate.

## What Changes

- Update `00_end_to_end.md` to clearly define `run_report_pipeline.py` as the sole ETL orchestrator writing to `maftia_quant.db`, and the API Gateway strictly as a read-only viewer.
- Update Mermaid diagrams in `00_end_to_end.md` to remove `DB_Val` (`metrics.db`) and `DB_LTTD` (`lttd.db`) from Layer 3, emphasizing that they are no longer queried by the API.
- Update `01_valuation_system.md` to formally remove references to the `POST /renormalize` API endpoint spawning Python subprocesses.
- Update `02_lttd_system.md` to formally remove references to the `POST /actions/run` API endpoint spawning Python scripts.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `architecture-e2e-overview`: Modifying the E2E architecture flow documentation to reflect the decoupled API structure.

## Impact

- **Affected Systems**: All 4 quantitative systems (Valuation, LTTD, MTTD, Ichimoku) as well as the API Gateway, but strictly at the documentation level.
- **Affected Code**: `docs/architecture/00_end_to_end.md`, `docs/architecture/01_valuation_system.md`, `docs/architecture/02_lttd_system.md`.
- **Zero Lookahead Bias**: No mathematical transformations or logic are being modified, maintaining the t-1 causal freshness guarantees.

## Non-goals

- We will not alter any quantitative models, signal math, or backtest logic.
- We will not modify any actual system configurations or code implementations (this change is strictly documentation parity).
- We will not reference or reintroduce the deprecated `quant-technical-indicator-bank`.
