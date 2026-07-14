## Context

The system has successfully undergone an infrastructure decoupling. Previously, the API Gateway accessed the subsystem databases directly and spawned external Python subprocesses. Now, `run_report_pipeline.py` acts as the sole orchestrator, extracting data from the 4 subsystems into a unified `maftia_quant.db` local SQLite database. The API Gateway serves as a read-only router fetching exclusively from `maftia_quant.db` and transmitting data through a single bound port (`:8910`). 

While the actual architecture was successfully implemented, the markdown documentation within `docs/architecture/` remains stale and still depicts the outdated, coupled flow. This creates a divergence between the documented behavior and actual system logic.

## Goals / Non-Goals

**Goals:**
- Update `docs/architecture/00_end_to_end.md` to clearly illustrate the new 5-layer decoupled sequence.
- Modify the Mermaid flowcharts in `00_end_to_end.md` to reflect that `DB_Val` and `DB_LTTD` are no longer queried by the API Gateway layer.
- Update `01_valuation_system.md` and `02_lttd_system.md` to formally deprecate and remove all mention of `POST` endpoint subprocess execution logic.

**Non-Goals:**
- No actual codebase logic or pipeline changes are being implemented (only documentation).
- No quantitative model logic, component definitions, or statistical constraints (e.g. `85px` chart rules, zero lookahead bias rules) will be modified.
- No modifications will be made to `UNIFIED_SYSTEM_ARCHITECTURE.md` as it is an abstract overview.

## Decisions

**1. Markdown-Only Modification Approach:**
We will use direct text replacement for the `docs/architecture/*.md` files rather than attempting a total rewrite of the documents. This preserves the existing comprehensive content (like the HMM regime logic, statistical equations, etc.) while accurately reflecting the new API boundaries.

**2. Flowchart Corrections:**
We will modify the Layer 3 Mermaid `subgraph` to correctly position `maftia_quant.db` as the exclusive bottleneck for Layer 4, reinforcing the single API gateway enforcement principle. The orchestrator (`run_report_pipeline.py`) will be visually depicted as populating all 4 tables in the master DB.

## Risks / Trade-offs

- **Risk:** Modifying Mermaid diagrams incorrectly can cause them to break or fail to render in markdown previewers.
  - **Mitigation:** We will ensure exact syntax adherence and utilize the exact previous subgraph node identifiers to maintain rendering integrity.
