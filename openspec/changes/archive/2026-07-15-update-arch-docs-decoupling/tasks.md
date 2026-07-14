## 1. End-to-End Architecture Flow Update

- [x] 1.1 Update `docs/architecture/00_end_to_end.md`: Rewrite Layer 3 Mermaid diagram to remove `metrics.db` and `lttd.db`, and clearly show all pipelines funneling to `maftia_quant.db`.
- [x] 1.2 Update `docs/architecture/00_end_to_end.md`: Update prose in Section 4 and Section 5 to describe the single API Gateway access pattern solely via `maftia_quant.db`.

## 2. Valuation System Docs Update

- [x] 2.1 Update `docs/architecture/01_valuation_system.md`: Update the Layer 5 (API Gateway) Mermaid diagram section to remove direct `metrics.db` reads.
- [x] 2.2 Update `docs/architecture/01_valuation_system.md`: Remove all text referencing the `POST /api/v1/analytics/metric/:metric_name/renormalize` endpoint and related Python subprocess execution.

## 3. LTTD System Docs Update

- [x] 3.1 Update `docs/architecture/02_lttd_system.md`: Update the API layer diagram to remove direct reads from `lttd.db`.
- [x] 3.2 Update `docs/architecture/02_lttd_system.md`: Remove all text referencing the `POST /api/v1/lttd/actions/run` endpoint and any related script spawning execution details.

## 4. Verification and Version Control

- [x] 4.1 Verify all updated Mermaid graphs render correctly locally or in a markdown previewer.
- [x] 4.2 Commit all changes adhering to the Conventional Commits specification (e.g. `docs: update architecture diagrams for decoupled api`).
