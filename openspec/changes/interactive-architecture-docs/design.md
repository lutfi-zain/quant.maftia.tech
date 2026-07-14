## Context

The Maftia Quant platform is a 4-system quantitative Bitcoin intelligence stack composed of: `quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`. These subsystems run under `/home/ubuntu/projects/` and are orchestrated by `run_report_pipeline.py`. The unified frontend SPA (`quant.maftia.tech`) runs under `/home/ubuntu/projects/quant.maftia.tech/web/`. The API gateway (Hono v4, Bun, port 8910) bridges backend SQLite stores to the frontend.

Currently, no canonical `docs/architecture/` directory exists. Architecture knowledge is scattered across `UNIFIED_SYSTEM_ARCHITECTURE.md` (highly dense, Indonesian-language narrative), 4 `docs/0x_*.md` system specs, and the `AGENTS.md` agent rules file. Onboarding engineers and auditors have no single entry point for the interactive, diagram-first architecture view.

## Goals / Non-Goals

**Goals:**
- Produce 5 linked Markdown files in `docs/architecture/` covering full E2E pipeline + 1 doc per system
- Each doc contains: Mermaid flowchart with groups, Mermaid sequence diagram where applicable, inter-system dependency table, role in unified pipeline, and navigation links
- All diagrams must be fully causal (no forward-looking data references)
- Docs must match exact DDD ubiquitous language: `MasterOHLCV`, `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`, `UnifiedDailyAnalytics`, `UnifiedComponentSignals`

**Non-Goals:**
- Modifying any existing source code, Python engines, or SQLite schemas
- Translating or replacing `UNIFIED_SYSTEM_ARCHITECTURE.md` (it stays as-is)
- Re-introducing deprecated `quant-technical-indicator-bank`
- Publishing or hosting the docs (static Markdown only)

## Decisions

### D1: `docs/architecture/` as output directory (not `openspec/` or `wiki/`)
**Decision**: Write all 5 files under `docs/architecture/` inside the `quant.maftia.tech` repo root.
**Rationale**: Co-locates architecture docs with the existing `docs/0x_*.md` system specs, making them discoverable from the same root. Engineers already know to look in `docs/`. Avoids contaminating the OpenSpec planning directory with runtime docs.
**Alternatives considered**: Root-level (`ARCHITECTURE.md` x5) — too cluttered for 5 separate files. Separate `wiki/` directory — no existing precedent in this repo.

### D2: Mermaid-first diagrams (flowchart with subgraph groups + sequence)
**Decision**: Each doc includes at minimum one `graph TD` flowchart using `subgraph` groups (matching the visual style already established in `UNIFIED_SYSTEM_ARCHITECTURE.md`) and one `sequenceDiagram` for the daily pipeline run.
**Rationale**: The project's existing architecture docs already use Mermaid with the Bloomberg dark palette convention. Consistency reduces cognitive load. Sequence diagrams add the temporal / causal ordering that flowcharts don't express.
**Alternatives considered**: ASCII art — not interactive. PlantUML — no existing tooling in the repo. Draw.io SVG — not renderable in plain Markdown.

### D3: File naming `00_` prefix for E2E, `01–04_` for per-system
**Decision**: Files named `00_end_to_end.md`, `01_valuation_system.md`, `02_lttd_system.md`, `03_mttd_system.md`, `04_ichimoku_system.md`.
**Rationale**: Numeric prefix enforces a logical reading order (macro → micro) and mirrors the existing `docs/0x_*.md` convention already established in this repo.

### D4: Navigation header + footer on every doc
**Decision**: Every doc starts with a `> **Navigation:**` blockquote listing links to all 5 docs, and ends with a `← Prev | ↑ Index | Next →` footer.
**Rationale**: In Markdown viewers (GitHub, VS Code), cross-links are clickable. Without them, readers must navigate the file tree manually. This is the "interactive" element of the architecture docs.

### D5: Per-system docs include: role summary, dependency table, layer flowchart, sequence, DB schema excerpt, API routes, frontend component wiring
**Decision**: Each per-system doc follows a uniform section template.
**Rationale**: Uniform structure allows auditors to compare systems side-by-side. Critical for catching architecture drift.

## Risks / Trade-offs

- **Diagram drift risk** → Docs are static Markdown; if Python engines or DB schemas evolve, diagrams can go stale. Mitigation: add a "Last verified" date stamp and note in `AGENTS.md` Historical Session Learnings.
- **Mermaid syntax errors** → Complex subgraph + sequence diagrams can fail silently in some renderers. Mitigation: keep node labels simple, quote labels containing special chars `(` `)` `[` `]`, avoid HTML tags per AGENTS.md rule.
- **Scope creep** → Request is docs-only, but could expand into auto-generation scripts. Non-goal: no code generation.

## Migration Plan

1. Create `docs/architecture/` directory
2. Write all 5 Markdown files in dependency order: `00_end_to_end.md` first (no dependencies), then the 4 per-system files (each references the E2E doc)
3. No rollback needed — these are net-new files; `git rm docs/architecture/` is sufficient if reverted

## Open Questions

- None blocking — all architectural details are sourced from `UNIFIED_SYSTEM_ARCHITECTURE.md`, `docs/0x_*.md`, `run_report_pipeline.py`, and `src/api/server.ts`
