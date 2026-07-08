# AGENTS.md

**Repository:** `quant.maftia.tech`
**Domain:** `Unified Quantitative & Statistical Bitcoin Intelligence Platform (4-System Multi-Layered Quantitative Defense & High-End Financial Terminal)`

This file is the authoritative guide for AI coding agents working in this repository. It defines the layered architecture, code style rules, testing requirements, and hard constraints that every change must satisfy.

---

## Commands

```bash
python3 run_report_pipeline.py
```

Run all tests and confirm they pass before finalising any change.

---

## Project Context & Business Domain (DDD)

**Ubiquitous Language:**
- **`MasterOHLCV` (`master_ohlcv`):** The single source of truth for daily Bitcoin price (`open`, `high`, `low`, `close`, `volume`) ingested from exchange feeds. All calculations must source from this canonical table.
- **`ValuationComposite` (`valuation_composite`):** Macroeconomic cycle valuation score piecewise linear interpolated into `[-2.0, +2.0]` across 17 Fundamental, Technical, and Sentiment indicators. Acts as the primary macro `CircuitBreakerFilter` when `score >= +1.50` (bubble risk) or `<= -1.00` (deep discount).
- **`LTTDRegime` (`lttd_regime`):** Orthogonal long-term trend classification via 3-State Gaussian HMM (`BULL`, `BEAR`, `SIDEWAYS`) using Log Returns and 20-day Volatility, validated by PCA and VIF pruning ($>10$). When `regime == SIDEWAYS` ($P_{\text{Sideways}} > 0.60$), acts as a macro override forcing `0.0` exposure on mid-term trend systems.
- **`MTTDIntegratedOscillator` (`mttd_imo`):** Multi-principle consensus oscillator (`[-1.0, +1.0]`) derived from 10 Statistical Families. Governed by three strict gates: `EfficiencyRatioGate` (`ER >= 0.20`), `ShannonEntropyGate` (`Entropy <= 2.30`), and `ChikouMomentumExit` (`< -0.30`).
- **`IchimokuDenoisedOscillator` (`ichimoku_imo`):** Stationary bounded $\tanh$ oscillator (`[-1.0, +1.0]`) transforming non-stationary Ichimoku cloud components (`S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`) filtered through Ehlers 2-pole `SuperSmoother` IIR transfer function.
- **`UnifiedDailyAnalytics` (`unified_daily_analytics`):** Master consolidated relational database table joining daily dates to composite outputs from all 4 systems (`Valuation`, `LTTD`, `MTTD`, and `Ichimoku Quant`).
- **`UnifiedComponentSignals` (`unified_component_signals`):** Granular component tracking table (`date`, `system_source`, `component_name`, `normalized_score`, `signal_direction` in `{-1, 0, +1}`).

Ensure all variable names, database columns, and API responses strictly adhere to this ubiquitous language.

---

## Architecture Boundaries (Progressive Disclosure)

Logic flows strictly according to the defined architectural patterns. 

For the canonical implementation patterns, refer to these Gold Standard files:
- **Master Unified Architecture Specification:** [[UNIFIED_SYSTEM_ARCHITECTURE.md]](file:///home/ubuntu/projects/quant.maftia.tech/UNIFIED_SYSTEM_ARCHITECTURE.md)
- **Orchestration & Data Sync Pipeline:** [[run_report_pipeline.py]](file:///home/ubuntu/projects/run_report_pipeline.py)
- **Valuation System Architecture:** [[01_quant_btc_valuation_system.md]](file:///home/ubuntu/projects/quant.maftia.tech/docs/01_quant_btc_valuation_system.md)
- **LTTD System Architecture:** [[02_quant_btc_lttd_system.md]](file:///home/ubuntu/projects/quant.maftia.tech/docs/02_quant_btc_lttd_system.md)
- **MTTD System v2 Architecture:** [[03_quant_btc_mttd_system.md]](file:///home/ubuntu/projects/quant.maftia.tech/docs/03_quant_btc_mttd_system.md)
- **Ichimoku Quant Architecture:** [[04_quant_lttd_ichimoku.md]](file:///home/ubuntu/projects/quant.maftia.tech/docs/04_quant_lttd_ichimoku.md)

*Agents: Do not hallucinate structural patterns. Read the Gold Standard files before creating new components.*

---

## Security & Compliance Guardrails

- **Zero Lookahead Bias (`CausalFilter`):** Mathematical transformation and statistical filtering must strictly be causal ($t-1$ stamp verification). Never leak future data or right-aligned rolling windows into historical training/backtesting.
- **Parameterized SQL & SQLite WAL Concurrency:** Never execute raw unparameterized SQL queries (`f-strings` or direct concatenation). All database connections to `maftia_quant.db` or subsystem `.db` files must enable SQLite Write-Ahead Logging (`WAL`) mode to prevent lock contention.
- **Single API Gateway Enforcement & Network Binding (`api.quant.maftia.tech` / `:8765`):** Do not spin up ad-hoc temporary backend servers or use default/random ports (`:3000`, `:8000`, `:8080`, etc.) in production or development. All cross-system data querying and live WebSocket broadcasts must route strictly through the unified Hono v4 + Bun API Gateway on port `:8765`. Always explicitly bind server listeners (`serve()`, `app.listen()`, `export default { fetch, port, hostname }`) to `0.0.0.0` (`hostname: '0.0.0.0'`) so services are accessible externally and across containers rather than restricted to `127.0.0.1` or `localhost`.
- **Strict UI Charting Rules (`85px Y-Axis Lock & Vertical Sync`):** Every chart component (`Lightweight Charts v5.2`) across the Master Executive Dashboard and all 4 Deep-Dive Sandboxes (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) must strictly lock the right price/oscillator Y-axis width to `85px` and implement real-time Vertical Crosshair Synchronization across all subplots.

---

## Git & Workflow Conventions

- **Branching Strategy:** Use descriptive feature or bugfix branches (`feature/quant-mttd-v2`, `fix/lttd-hmm-convergence`, `refactor/api-gateway-bun`).
- **Pushing Rules:** Never force push (`--force` or `-f`) to the `main` branch. Always rebase or pull clean changes before pushing.
- **Commit Format:** Strictly adhere to **Conventional Commits** specification (`feat: ...`, `fix: ...`, `quant: ...`, `refactor: ...`, `docs: ...`, `test: ...`).

---

## Dependencies & Environment

- **Python Environment:** Python 3.11+. Use `pip` / `python3` from the system or project virtual environment. Ensure exact numerical packages (`numpy`, `scipy`, `pandas`, `scikit-learn`, `hmmlearn`, `xgboost`) are maintained.
- **JavaScript / TypeScript Runtime:** Bun v1.0+ (`/home/ubuntu/.bun/bin/bun` or `bun`) for backend API Gateway (`Hono v4`) and frontend SPA build (`React 19`, `Vite`, `Lightweight Charts v5.2`).

---

## Historical Session Learnings (Dynamic Log)

*When you consistently fail at a specific architectural nuance or encounter a repeating edge-case, add a note here to prevent future agents from making the same mistake.*

- **System Count Unification (`2026-07-08`):** The quantitative ecosystem has been consolidated from 5 systems to **4 unified systems** (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`). The legacy `quant-technical-indicator-bank` project documentation and references (`05_quant_technical_indicator_bank.md`) have been explicitly removed and deprecated. Future agents must not re-introduce or reference `quant-technical-indicator-bank`. — [Evidence: `README.md` & `UNIFIED_SYSTEM_ARCHITECTURE.md` multi-system unification cleanup]
- **Data Sync Caching Rule (`2026-07-08`):** When `run_report_pipeline.py` executes, `lttd.db` (`ohlcv` table) is synced directly into `btc_daily.json` (`aligned_data`) for the MTTD engine. Ensure SQLite WAL connections close cleanly before reading JSON payloads. — [Evidence: `run_report_pipeline.py:L63-98`]
- **Multi-File Reference Cleanliness (`2026-07-08`):** When modifying across multiple Markdown specs (`README.md`, `UNIFIED_SYSTEM_ARCHITECTURE.md`, `PROMPT_HANDOFF.md`, `docs/*.md`), always use `multi_replace_file_content` with exact line ranges and run `git diff` after edits to verify that section numbering and markdown tables remain aligned without duplicate headers. — [Evidence: 4-system cleanup across `README.md`, `UNIFIED_SYSTEM_ARCHITECTURE.md`, and `PROMPT_HANDOFF.md`]
- **Chart Sizing & Crosshair Lock Enforcement (`2026-07-08`):** When building frontend subplots (`Lightweight Charts v5.2`), any chart without an explicit right Y-axis width lock (`85px`) and vertical crosshair sync will experience horizontal time-tick drift when price ($60k+) vs oscillator ($-1.0$) character widths differ. Always verify `85px` lock on every subplot container. — [Evidence: `UNIFIED_SYSTEM_ARCHITECTURE.md:L274-278` & Phase 2 user interview confirmation]
- **SQLite Explicit Column Spec (`2026-07-08`):** When syncing pandas `DataFrame` rows into `master_ohlcv` or `unified_daily_analytics` using parameterized queries (`INSERT OR REPLACE INTO ...`), always specify exact column names (e.g., `INSERT OR REPLACE INTO master_ohlcv (date, open, high, low, close, volume, source, fetched_at) VALUES (?, ...)`). Omitting column names causes `OperationalError: table X has N columns but M values were supplied` when schemas contain default timestamp or source columns (`source`, `fetched_at`). — [Evidence: `run_report_pipeline.py:L98-104` 8 vs 6 column mismatch fix]
- **Subsystem Path & WAL Import Resolution (`2026-07-08`):** Subsystem modules (e.g., `quant-btc-valuation-system/database/db.py`, `quant-btc-lttd-system/src/data/db.py`) execute both independently (`cd quant-btc-lttd-system && python3 run_pipeline.py`) and via orchestration (`python3 /home/ubuntu/projects/run_report_pipeline.py`). When importing `get_wal_connection` from `db_connector.py`, always ensure `/home/ubuntu/projects` (`sys.path.insert(0, "/home/ubuntu/projects")`) is dynamically added if not present before `from db_connector import get_wal_connection`. — [Evidence: `quant-btc-valuation-system/database/db.py:L10-14` & `quant-btc-lttd-system/src/data/db.py:L11-15`]
- **External Network Visibility & Non-Default Port Binding (`2026-07-09`):** Never use default ports (`3000`, `8000`, `8080`) when configuring servers or gateways, and never let Node/Bun HTTP server adapters (`@hono/node-server`, `serve()`, etc.) default their host binding to `127.0.0.1` or `localhost`. Always explicitly specify custom assigned ports (`8765` for API Gateway) and strictly pass `hostname: '0.0.0.0'` in all server configurations (`serve({ fetch, port, hostname: '0.0.0.0' })` and `export default { port, hostname: '0.0.0.0', fetch }`) to ensure external and cross-container visibility. — [Evidence: `src/api/server.ts` and `src/api/index.ts` explicit `0.0.0.0` binding]

