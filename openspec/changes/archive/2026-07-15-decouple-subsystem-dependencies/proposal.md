# Proposal: Decouple Subsystem Dependencies

## Summary

Make `quant.maftia.tech` a fully self-contained, independent system that operates exclusively from its own `data/maftia_quant.db` database — eliminating all runtime dependencies on the 4 sibling subsystem repositories (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`).

**Current State:** The API gateway and pipeline orchestrator directly access external filesystem paths, databases, Python scripts, and port-bound services from sibling repos — creating brittle, undeployable coupling.

**Target State:** A clean boundary where `quant.maftia.tech` reads **only** from `data/maftia_quant.db` (populated by `run_report_pipeline.py` as an external ETL process), with zero hardcoded references to sibling filesystem paths.

## Systems Impacted

All 4 unified quantitative systems are impacted:

| System | Current Coupling | Decoupling Action |
|--------|-----------------|-------------------|
| **Valuation** | `metrics.ts` directly reads `/home/ubuntu/projects/quant-btc-valuation-system/database/metrics.db` at runtime; `renormalize` endpoint spawns Python subprocess from external repo | Migrate raw metric data into `maftia_quant.db` tables; internalize renormalize logic |
| **LTTD** | `lttd.ts` `/actions/run` endpoint spawns processes in `/home/ubuntu/projects/quant-btc-lttd-system/` with hardcoded `cwd` | Remove subprocess orchestration from API; make it a separate admin tool |
| **MTTD** | `run_report_pipeline.py` reads `signals.csv` from MTTD repo and syncs to `maftia_quant.db` | Already partially decoupled (reads from `unified_daily_analytics`); remove CSV path references |
| **Ichimoku** | `run_report_pipeline.py` imports Python modules directly from `quant-lttd-ichimoku/src/` | Already partially decoupled (reads from `unified_daily_analytics`); remove `sys.path` imports |

## Zero Lookahead Bias Confirmation

This change is strictly an **infrastructure/plumbing refactoring**. No mathematical transformations, strategy logic, signal calculations, or statistical filtering are modified. All causal filtering (t-1 stamp verification) remains untouched in the existing subsystem engines and in the `run_report_pipeline.py` orchestrator.

## Problem Statement

### 6 Critical Runtime Dependencies

1. **Direct External DB Access** — `src/api/routes/metrics.ts:L12` hardcodes `METRICS_DB_PATH = "/home/ubuntu/projects/quant-btc-valuation-system/database/metrics.db"` and opens a separate SQLite connection to read raw metric timeseries and threshold configs.

2. **External Python Subprocess** — `src/api/routes/metrics.ts:L415` spawns `python3 /home/ubuntu/projects/quant-btc-valuation-system/scripts/renormalize_metric.py` as a child process.

3. **External LTTD Process Orchestration** — `src/api/routes/lttd.ts:L480` defines `LTTD_PROJECT_ROOT = "/home/ubuntu/projects/quant-btc-lttd-system"` and spawns 6 different Python/Bun processes (`run_pipeline.py`, `backfill.py`, `backfill_gap.py`, `backfill_all.py`, `scripts/init_db.ts`, `scripts/performance_report.py`).

4. **Hardcoded Master DB Path** — `src/api/db.ts:L8` hardcodes `DB_PATH = path.resolve('/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db')` instead of using a relative path or environment variable.

5. **Shared `db_connector.py` Module** — The external orchestrator at `/home/ubuntu/projects/run_report_pipeline.py` depends on `/home/ubuntu/projects/db_connector.py` which is not inside the `quant.maftia.tech` repo.

6. **Documentation References** — Multiple `docs/architecture/*.md` files reference external repo paths for context.

### Why This Matters

- **Non-deployable**: The system cannot be deployed to any environment other than this exact server with this exact directory layout
- **Fragile**: Renaming, moving, or updating any sibling repo breaks the API gateway
- **Security surface**: API endpoints spawn arbitrary Python subprocesses from external directories
- **Testing impossible**: Cannot run integration tests without the full monorepo layout

## Proposed Solution

### Architecture Principle

> **Single Database Boundary**: `quant.maftia.tech` reads from and writes to ONLY `data/maftia_quant.db`. The external `run_report_pipeline.py` is the sole ETL process that populates this database from subsystem outputs. The API gateway never touches external filesystems.

### Changes Required

#### Phase 1: Internalize Metric Data (metrics.ts)

1. **Migrate `timeseries_metrics` and `metric_config` tables** into `maftia_quant.db` — the pipeline already syncs normalized values to `unified_component_signals`, but raw values and threshold configs are missing.
2. **Update `run_report_pipeline.py`** to also sync `timeseries_metrics` (raw values) and `metric_config` (thresholds) into `maftia_quant.db`.
3. **Rewrite `metrics.ts`** to read exclusively from `maftia_quant.db` using the existing `executeQuery()` helper.
4. **Remove the `renormalize` endpoint** or reimplement it as a self-contained TypeScript function that operates on data already in `maftia_quant.db`.

#### Phase 2: Remove LTTD Process Orchestration (lttd.ts)

1. **Remove `/api/v1/lttd/actions/run` endpoint** — this is an operational/admin action that does not belong in a read-only API gateway. Move to a separate CLI tool or admin script.
2. All LTTD data endpoints (`/latest`, `/history`, `/chart`, `/regime`, `/diagnostics`, `/onchain`, `/backtest`) already read from `maftia_quant.db` — no changes needed.

#### Phase 3: Resolve Hardcoded Paths (db.ts)

1. **Replace hardcoded absolute path** in `db.ts` with a relative path resolution: `path.resolve(import.meta.dir, '../../data/maftia_quant.db')` or environment variable `process.env.DB_PATH`.

#### Phase 4: Documentation Cleanup

1. Update `docs/architecture/*.md` to note that subsystem paths are for the **ETL pipeline** context only, not for the API gateway.
2. Add a clear architectural boundary diagram showing the decoupled data flow.

## Non-goals

- **Modifying `run_report_pipeline.py`** beyond adding new table syncs — the orchestrator lives outside this repo and its refactoring is out of scope.
- **Removing `quant-technical-indicator-bank`** references — already deprecated and removed in prior cleanup.
- **Changing any quantitative logic** — no signal calculations, indicator math, or strategy parameters are modified.
- **Making subsystem repos independent of each other** — only `quant.maftia.tech` is being decoupled.
- **Removing the `db_connector.py` shared module** — it lives outside this repo.

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Data freshness regression | Pipeline sync frequency unchanged; `maftia_quant.db` already receives all data |
| Missing raw metric values | Add explicit `timeseries_metrics` sync to pipeline before cutting over |
| Breaking Valuation Studio metric drilldown | Verify all 17 metric names resolve against new internal tables |
| LTTD admin actions unavailable | Document CLI-based alternative for pipeline operations |

## Success Criteria

1. `grep -r "quant-btc-valuation-system\|quant-btc-lttd-system\|quant-btc-mttd-system\|quant-lttd-ichimoku" src/` returns **zero matches**
2. `grep -r "/home/ubuntu/projects/" src/` returns **zero matches** (except documentation comments)
3. All API endpoints return identical data before and after the change
4. `bun run dev` starts successfully without any sibling repo present on disk
