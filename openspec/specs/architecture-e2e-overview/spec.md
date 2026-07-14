# architecture-e2e-overview Specification

## Purpose
TBD - created by archiving change interactive-architecture-docs. Update Purpose after archive.
## Requirements
### Requirement: E2E architecture document with master pipeline flowchart
The system SHALL provide a `docs/architecture/00_end_to_end.md` document that contains a Mermaid `graph TD` flowchart with labelled `subgraph` groups covering all 5 architectural layers: Data Sources, Orchestration Engine, Unified Storage, API Gateway, and Frontend SPA.

#### Scenario: Full pipeline layers rendered
- **WHEN** a developer opens `docs/architecture/00_end_to_end.md` in a Mermaid-compatible viewer (GitHub, VS Code)
- **THEN** the flowchart renders with 5 distinctly styled subgraph groups, arrows showing data flow from exchange APIs through pipeline to the frontend, and all 4 subsystem engines visible in the orchestration layer

#### Scenario: Navigation links resolve
- **WHEN** a developer clicks any cross-link in the navigation header or footer
- **THEN** they are taken to the corresponding per-system architecture document

### Requirement: E2E sequence diagram for daily pipeline run
The system SHALL include a Mermaid `sequenceDiagram` in `00_end_to_end.md` showing the temporal sequence of the daily `run_report_pipeline.py` execution — from data ingestion through each of the 4 system engines to `unified_daily_analytics` write.

#### Scenario: Causal ordering in sequence diagram
- **WHEN** a developer reads the sequence diagram
- **THEN** every step references only past data (t-1 stamp) and the 4 engines appear in the correct execution order: Valuation → LTTD → MTTD → Ichimoku

### Requirement: Cross-system interlocking circuit breaker matrix
The system SHALL document the 3 inter-system dependency rules as a Mermaid `flowchart LR` in `00_end_to_end.md`: (1) Valuation → LTTD Circuit Breaker at `score >= +1.50`, (2) LTTD SIDEWAYS → MTTD + Ichimoku exposure override at `P_Sideways > 0.60`, (3) MTTD ↔ Ichimoku confluence gate.

#### Scenario: Circuit breaker arrows are labelled
- **WHEN** the interlocking matrix diagram is rendered
- **THEN** each arrow between systems includes the condition label (threshold value and action taken)

### Requirement: Valuation system architecture deep-dive
The system SHALL provide `docs/architecture/01_valuation_system.md` with: role summary, 6-layer Mermaid flowchart, 17-indicator component table (grouped by pillar: Fundamental / Technical / Sentiment), `metrics.db` schema excerpt, relevant API routes, ValuationStudio frontend wiring, and navigation links.

#### Scenario: 17 indicators documented by pillar
- **WHEN** a developer opens `01_valuation_system.md`
- **THEN** all 17 `ValuationComposite` component indicators are listed in a markdown table, grouped by pillar, with their score range and signal direction

### Requirement: LTTD system architecture deep-dive
The system SHALL provide `docs/architecture/02_lttd_system.md` with: role summary, 6-layer Mermaid flowchart (Layer 0 data through Layer 6 presentation), Gaussian HMM 3-state explanation, PCA+VIF orthogonalization block, SIDEWAYS macro override logic, `lttd.db` schema excerpt, LTTD Lab frontend wiring, and navigation links.

#### Scenario: SIDEWAYS override clearly marked
- **WHEN** a developer reads `02_lttd_system.md`
- **THEN** the SIDEWAYS override condition (`P_Sideways > 0.60 → target_exposure = 0.0`) is visually distinct in the flowchart (highlighted path or annotation) and explained in prose

### Requirement: MTTD system architecture deep-dive
The system SHALL provide `docs/architecture/03_mttd_system.md` with: role summary, Mermaid flowchart for the multi-principle consensus pipeline, table of 10 statistical families with their sub-indicators, EfficiencyRatioGate (`ER >= 0.20`), ShannonEntropyGate (`Entropy <= 2.30`), ChikouMomentumExit (`< -0.30`) logic, MTTD Console frontend wiring, and navigation links.

#### Scenario: 10 statistical families enumerated
- **WHEN** a developer opens `03_mttd_system.md`
- **THEN** all 10 statistical families contributing to `MTTDIntegratedOscillator` are listed in a table with family name and example sub-indicators

### Requirement: Ichimoku Quant system architecture deep-dive
The system SHALL provide `docs/architecture/04_ichimoku_system.md` with: role summary, 5-layer Mermaid flowchart (Spectral Filtering → Fractal Gating → Entropy Gate → Cloud Boundary Gate → Signal Confirmation), tanh decomposition formulas for `S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`, SuperSmoother IIR transfer function, 5-test statistical validation table, Ichimoku Terminal frontend wiring, and navigation links.

#### Scenario: SuperSmoother formula rendered
- **WHEN** a developer views `04_ichimoku_system.md` in a Markdown renderer supporting LaTeX
- **THEN** the SuperSmoother IIR transfer function `y_t = c1(xt + xt-1)/2 + c2*yt-1 + c3*yt-2` is shown in a code block or mathematical notation

#### Scenario: 5 statistical tests documented
- **WHEN** a developer reads the statistical validation section
- **THEN** all 5 formal tests (ADF, KS, Welch's t-test, Bootstrap CI, Bonferroni) appear in a markdown table with null hypothesis, result, and quantitative implication columns

