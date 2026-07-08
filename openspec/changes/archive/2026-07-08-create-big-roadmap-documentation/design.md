## Context

Currently, `quant.maftia.tech` manages four interlocked quantitative Bitcoin trading systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`) coordinated via `run_report_pipeline.py`. Each system maintains local storage (`.db`, `.csv`, `.json`), creating challenges for cross-system querying, real-time UI charting, and causal validation. To migrate and unify these into a high-end financial terminal without breaking existing strategy logic or overwhelming AI context windows, we require a master architectural design that breaks down the unification trajectory into 4 sequential OpenSpec proposals.

## Goals / Non-Goals

**Goals:**
- Architect the Master Roadmap structure partitioning the unification into 4 distinct phases: Data Ingestion & Storage (`MasterOHLCV` / WAL), Quant Math & Circuit Breakers (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`), Single Hono API Gateway (`api.quant.maftia.tech` on `:8765`), and React 19 Executive Terminal (`85px` Y-axis lock & crosshair sync).
- Establish exact technical contracts between phases so that subsequent OpenSpec proposals (`/opsx:propose`) inherit verified schemas and guardrails.
- Mandate strict zero lookahead bias (`CausalFilter` with $t-1$ stamp verification) and SQLite Write-Ahead Logging (`WAL`) concurrency across all proposed phases.

**Non-Goals:**
- We will not execute the production code mutations or file migrations within this single documentation change.
- We will not design, document, or include any components from the legacy `quant-technical-indicator-bank` (`05. Indicator Bank`), which has been explicitly deprecated.
- We will not support multi-port temporary backends (`:3000`, `:8766`, etc.) for individual sub-studios; all routing must unify through `:8765`.

## Decisions

- **Decision 1: 4-Phase Atomic OpenSpec Decomposition**
  - *Rationale*: Decomposing the platform roadmap into 4 sequential OpenSpec proposals (`Phase 1: Data/WAL`, `Phase 2: Quant Math Engine`, `Phase 3: API Gateway`, `Phase 4: Frontend Terminal`) guarantees that each AI coding session operates on a clean, isolated domain context without context rot or dependency confusion.
  - *Alternatives Considered*: A single massive all-at-once migration proposal (rejected due to extreme risk of token truncation and hallucinated variables).
- **Decision 2: Single Hono v4 + Bun API Gateway Enforcement (`:8765`)**
  - *Rationale*: All cross-system queries (`UnifiedDailyAnalytics` and `UnifiedComponentSignals`) and live WebSocket broadcasts must route strictly through `api.quant.maftia.tech` on port `:8765`. This eliminates CORS issues and local port contention across the 4 systems.
  - *Alternatives Considered*: Microservices running on separate ports per system (`:3000` for Valuation, `:8001` for LTTD, etc.) (rejected per strict guardrail enforcement).
- **Decision 3: Mandatory UI Charting Standardization (`85px` Y-Axis Width Lock & Vertical Crosshair Sync)**
  - *Rationale*: In Lightweight Charts (`v5.2`), price subplots ($60k+ strings) and bounded oscillator subplots (`[-1.0, +1.0]` strings) render different character widths by default, causing horizontal time-tick drift between stacked charts. Locking right Y-axis width to exactly `85px` across all subplots and linking their vertical crosshairs ensures pixel-perfect vertical alignment across `Valuation Studio`, `LTTD Lab`, `MTTD Console`, and `Ichimoku Terminal`.
  - *Alternatives Considered*: Dynamic auto-sizing Y-axis (rejected because it causes visual misalignment during zooming and panning).

## Risks / Trade-offs

- **[Risk: SQLite Database Lock Contention]** → *Mitigation*: Strictly mandate `WAL` (Write-Ahead Logging) mode and parameterized SQL (`?-style` / ORM bindings) on `maftia_quant.db` across Phase 1 and Phase 3, ensuring background ingestion pipelines (`run_report_pipeline.py`) never block API read queries.
- **[Risk: Historical Lookahead Bias in Multi-System Normalization]** → *Mitigation*: Enforce `CausalFilter` ($t-1$ verification) across Phase 2 specifications. All piecewise linear interpolations (`[-2.0, +2.0]`) and Ehlers SuperSmoother transfer functions must compute strictly using trailing causal data.

## Migration Plan

1. Approve and merge this Master Roadmap Documentation proposal (`create-big-roadmap-documentation`).
2. Generate the overarching `MASTER_ROADMAP.md` document inside the repository summarizing the 4 phases and their dependency matrix.
3. Launch `openspec new change phase-1-data-and-wal-pipeline` to begin executing Phase 1 of the roadmap.

## Open Questions

- Should the 4 Deep-Dive Sandboxes (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) be implemented as client-side route tabs (`/studio/valuation`, etc.) in React 19 Router or as modal views within the Master Executive Dashboard? *(Recommendation: Client-side route tabs for clean URL deep-linking).*
