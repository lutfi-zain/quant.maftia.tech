## Context

Currently, the master execution pipeline script `run_report_pipeline.py` executes subsystem calculations by changing directories (`cwd`) to external sibling folders (e.g. `/home/ubuntu/projects/quant-btc-valuation-system`). This coupling of environments restricts stand-alone deployment and makes execution outside of a specific local folder layout complex.

This design covers moving all core calculation modules of the 4 systems locally under an `engines/` subdirectory and refactoring the pipeline to execute them using relative path resolving.

## Goals / Non-Goals

**Goals:**
- Port only the relevant quantitative calculation script structures to local paths.
- Update `run_report_pipeline.py` paths to be relative.
- Remove hardcoded external `/home/ubuntu/projects` path dependencies.

**Non-Goals:**
- We will NOT copy legacy web folders, node modules, git history, or FastAPI servers of the individual subsystems.
- We will NOT change any strategy models, signals math, or causal filters (strictly t-1).
- We will NOT touch the deprecated `quant-technical-indicator-bank`.

## Decisions

**1. Copy Core Logics Separately:**
We will copy only the quantitative code folders of each subsystem:
- Valuation: `quant/` module
- LTTD: `src/` module, `run_pipeline.py` script
- MTTD: `mttd/`, `indicators/`, `multi_principle_strategy.py`, `generate_multi_principle_chart.py`, `indicators_helper.py`, `regime_detector.py`
- Ichimoku: `src/` module, `main.py` script

We decide to exclude the individual `.git` directories and frontend directories to keep the monorepo size small and clean.

**2. Relativize run_report_pipeline.py:**
Modify the directory definition block at the top of the file:
```python
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VALUATION_DIR = os.path.join(BASE_DIR, "engines/valuation")
LTTD_DIR = os.path.join(BASE_DIR, "engines/lttd")
MTTD_DIR = os.path.join(BASE_DIR, "engines/mttd")
ICHIMOKU_DIR = os.path.join(BASE_DIR, "engines/ichimoku")
```

## Risks / Trade-offs

- **Risk:** Missing internal relative module imports (e.g., Python `sys.path` errors when the script runs inside a different directory structure).
  - **Mitigation:** Ensure that `sys.path.insert` statements in `run_report_pipeline.py` are adjusted to the new local paths, and verify the run completes without `ImportError`.
