## Why

The Maftia Quant platform currently documents its 4 subsystems and unified architecture in fragmented Markdown files (`UNIFIED_SYSTEM_ARCHITECTURE.md`, `docs/0x_*.md`) that lack navigable cross-linking, machine-readable Mermaid diagrams covering end-to-end pipeline flow, sequence interactions, and dependency graphs. Engineers onboarding to the project or auditing a subsystem cannot quickly trace data lineage (from exchange API → pipeline → DB → API gateway → frontend) or understand inter-system interlocking without reading multiple large files. Structured, linked, diagram-first architecture docs close this gap now — before the platform scales further.

## What Changes

- **New**: `docs/architecture/` directory with 5 linked Markdown files
- **New**: `00_end_to_end.md` — master E2E architecture doc with Mermaid flowchart (grouped layers), Mermaid sequence diagram for the daily pipeline run, and cross-links to all 4 system docs
- **New**: `01_valuation_system.md` — deep-dive architecture for `quant-btc-valuation-system` with flowchart (layers 0–6), component dependency table, data schema, API routes, and circuit breaker logic
- **New**: `02_lttd_system.md` — architecture for `quant-btc-lttd-system` with 6-layer flowchart, HMM/PCA/VIF/ensemble pipeline, SIDEWAYS override, and DB schema
- **New**: `03_mttd_system.md` — architecture for `quant-btc-mttd-system` with 10 statistical families, ER gate, entropy gate, Chikou exit, and multi-principle consensus flowchart
- **New**: `04_ichimoku_system.md` — architecture for `quant-lttd-ichimoku` with 5-gate signal flowchart, tanh decomposition, SuperSmoother IIR math, and statistical validation table
- All 5 docs include: inter-system dependency arrows, linked navigation header/footer, Mermaid diagrams (flowchart with groups + sequence), and role-in-unified-platform section

## Capabilities

### New Capabilities

- `architecture-e2e-overview`: End-to-end master architecture document covering all 5 layers (data ingestion → orchestration → storage → API gateway → frontend), unified pipeline sequence, and cross-system interlocking circuit breaker matrix
- `architecture-valuation-system`: Deep-dive architecture doc for System 1 (Valuation): 17-indicator piecewise linear composite, macro CircuitBreakerFilter, `metrics.db` schema, API routes, and frontend Valuation Studio wiring
- `architecture-lttd-system`: Deep-dive architecture doc for System 2 (LTTD): 3-State Gaussian HMM, PCA+VIF orthogonalization, XGBoost/L1-Lasso ensemble, SIDEWAYS macro override, `lttd.db` schema, and LTTD Lab wiring
- `architecture-mttd-system`: Deep-dive architecture doc for System 3 (MTTD): 10 statistical families, EfficiencyRatioGate, ShannonEntropyGate, ChikouMomentumExit, multi-principle consensus, MTTD Console wiring
- `architecture-ichimoku-system`: Deep-dive architecture doc for System 4 (Ichimoku Quant): tanh decomposition, Ehlers SuperSmoother IIR, 5-gate confirmation logic, formal statistical validation (ADF, KS, t-test, Bootstrap, Bonferroni), Ichimoku Terminal wiring

### Modified Capabilities

- (none — this is a docs-only addition; no existing spec-level behavior is changing)

## Impact

- **Files created**: `docs/architecture/00_end_to_end.md`, `01_valuation_system.md`, `02_lttd_system.md`, `03_mttd_system.md`, `04_ichimoku_system.md`
- **No code changes**: zero impact to Python engines, SQLite schemas, API gateway, or frontend runtime
- **No lookahead bias risk**: documentation only — no mathematical transformations affected
- **Non-goals**: Does not modify `UNIFIED_SYSTEM_ARCHITECTURE.md`, `AGENTS.md`, or any `docs/0x_*.md` source files; does not re-introduce deprecated `quant-technical-indicator-bank`; does not alter runtime behavior of any of the 4 systems
