## ADDED Requirements

### Requirement: Master Multi-Phase Trajectory Governance
The system SHALL maintain a canonical Master Roadmap document (`MASTER_ROADMAP.md`) that structures all engineering migrations across the 4 quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`) strictly aligned with `UNIFIED_SYSTEM_ARCHITECTURE.md` and `run_report_pipeline.py`.

#### Scenario: Authoritative phase breakdown validation
- **WHEN** an engineer or AI coding agent initiates a new OpenSpec proposal for system unification
- **THEN** the proposal MUST map directly to one of the 4 defined phases (`Phase 1: Data & WAL`, `Phase 2: Quant Math Engines`, `Phase 3: API Gateway`, `Phase 4: Financial Terminal UI`) in the Master Roadmap

### Requirement: Atomic Phase Decomposition and Sequential Execution
The system SHALL mandate that major multi-system architectural refactoring be broken down into atomic, sequential OpenSpec proposals (`/opsx:propose`) rather than executed inside a single monolithic change, preventing context truncation and circular dependencies.

#### Scenario: Sequential prerequisite verification
- **WHEN** an OpenSpec proposal for `Phase 3` (API Gateway) or `Phase 4` (Terminal UI) is proposed
- **THEN** its dependencies MUST verify that prerequisite data entities (`MasterOHLCV`, `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`, `UnifiedDailyAnalytics`, `UnifiedComponentSignals`) from earlier phases are already established and schema-locked

### Requirement: Deprecated Component Exclusivity
The Master Roadmap and any subsequent phase specifications SHALL explicitly exclude and prohibit any integration, reference, or restoration of the deprecated `quant-technical-indicator-bank` (`05. Indicator Bank`) repository structure.

#### Scenario: Rejection of deprecated indicator bank references
- **WHEN** an AI coding agent scans project documentation or phase proposals for valid indicator dependencies
- **THEN** any attempt to import or document `quant-technical-indicator-bank` SHALL be flagged and blocked per authoritative repository guardrails
