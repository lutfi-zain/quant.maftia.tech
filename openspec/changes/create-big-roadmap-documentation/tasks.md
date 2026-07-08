## 1. Master Roadmap Documentation & Phase Trajectory Setup

- [x] 1.1 Create `MASTER_ROADMAP.md` documenting the overarching 4-phase trajectory across `quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`
- [x] 1.2 Document the phase breakdown matrix (`Phase 1: Data & WAL`, `Phase 2: Quant Engines`, `Phase 3: API Gateway :8765`, `Phase 4: Financial Terminal UI`) along with prerequisite dependencies
- [x] 1.3 Verify and document zero lookahead bias (`CausalFilter` $t-1$ stamp validation) and deprecated component exclusion (`quant-technical-indicator-bank`) inside `MASTER_ROADMAP.md`
- [ ] 1.4 Commit phase roadmap documentation adhering to Conventional Commits (`docs: create master roadmap and 4-phase engineering trajectory`)

## 2. Phase 1 Proposal & Pipeline Verification Setup

- [ ] 2.1 Scaffold the next atomic OpenSpec proposal for Phase 1 (`/opsx:propose phase-1-data-and-wal-pipeline`) covering `MasterOHLCV` ingestion and SQLite Write-Ahead Logging (`WAL`) mode enforcement
- [ ] 2.2 Verify canonical data orchestration and alignment across `.db` and `btc_daily.json` by running `python3 /home/ubuntu/projects/run_report_pipeline.py`
- [ ] 2.3 Commit and prepare handoff for Phase 1 implementation adhering to Conventional Commits (`quant: prepare phase 1 data ingestion and wal pipeline proposal`)
