## MODIFIED Requirements

### Requirement: E2E architecture document with master pipeline flowchart
The system SHALL provide a `docs/architecture/00_end_to_end.md` document that contains a Mermaid `graph TD` flowchart with labelled `subgraph` groups covering all 5 architectural layers: Data Sources, Orchestration Engine, Unified Storage, API Gateway, and Frontend SPA. The Unified Storage layer and API Gateway MUST reflect the decoupled architecture, clearly showing that `run_report_pipeline.py` populates `timeseries_metrics` and `metric_config` natively in `maftia_quant.db`, and the API Gateway reads strictly from `maftia_quant.db` without any direct filesystem dependencies on `metrics.db` or `lttd.db`.

#### Scenario: Full pipeline layers rendered
- **WHEN** a developer opens `docs/architecture/00_end_to_end.md` in a Mermaid-compatible viewer (GitHub, VS Code)
- **THEN** the flowchart renders with 5 distinctly styled subgraph groups, arrows showing data flow from exchange APIs through pipeline to the frontend, and all 4 subsystem engines visible in the orchestration layer
- **THEN** the Unified Storage layer correctly depicts data flowing from the Orchestration layer into a single `maftia_quant.db`, which exclusively feeds the API Gateway

#### Scenario: Navigation links resolve
- **WHEN** a developer clicks any cross-link in the navigation header or footer
- **THEN** they are taken to the corresponding per-system architecture document

### Requirement: Valuation system architecture deep-dive
The system SHALL provide `docs/architecture/01_valuation_system.md` with: role summary, 6-layer Mermaid flowchart, 17-indicator component table (grouped by pillar: Fundamental / Technical / Sentiment), `metrics.db` schema excerpt, relevant API routes, ValuationStudio frontend wiring, and navigation links. The documentation MUST explicitly confirm that the API Gateway acts as a read-only viewer on `maftia_quant.db` and the `POST /renormalize` endpoint has been removed, as the API no longer spawns Python subprocesses.

#### Scenario: 17 indicators documented by pillar
- **WHEN** a developer opens `01_valuation_system.md`
- **THEN** all 17 `ValuationComposite` component indicators are listed in a markdown table, grouped by pillar, with their score range and signal direction

#### Scenario: Decoupled API boundaries confirmed
- **WHEN** a developer reads the API boundaries section in `01_valuation_system.md`
- **THEN** they see no references to the deprecated `POST /renormalize` endpoint or any subprocess spawning functionality

### Requirement: LTTD system architecture deep-dive
The system SHALL provide `docs/architecture/02_lttd_system.md` with: role summary, 6-layer Mermaid flowchart (Layer 0 data through Layer 6 presentation), Gaussian HMM 3-state explanation, PCA+VIF orthogonalization block, SIDEWAYS macro override logic, `lttd.db` schema excerpt, LTTD Lab frontend wiring, and navigation links. The documentation MUST explicitly state that the API Gateway is read-only and no longer exposes `POST /actions/run` or directly manages LTTD Python subprocesses.

#### Scenario: SIDEWAYS override clearly marked
- **WHEN** a developer reads `02_lttd_system.md`
- **THEN** the SIDEWAYS override condition (`P_Sideways > 0.60 → target_exposure = 0.0`) is visually distinct in the flowchart (highlighted path or annotation) and explained in prose

#### Scenario: Decoupled API boundaries confirmed
- **WHEN** a developer reads the API boundaries section in `02_lttd_system.md`
- **THEN** they see no references to the deprecated `POST /actions/run` endpoint or any subprocess spawning functionality
