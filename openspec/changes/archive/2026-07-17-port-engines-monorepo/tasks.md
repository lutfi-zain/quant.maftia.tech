## 1. Directory Setup

- [x] 1.1 Create the root `engines/` directory inside `quant.maftia.tech`.
- [x] 1.2 Create `engines/valuation`, `engines/lttd`, `engines/mttd`, and `engines/ichimoku` subfolders.

## 2. Port Valuation System

- [x] 2.1 Copy the `quant` python module directory from `/home/ubuntu/projects/priors-system/quant-btc-valuation-system/quant` to `engines/valuation/quant`.
- [x] 2.2 Copy `requirements.txt` from `/home/ubuntu/projects/priors-system/quant-btc-valuation-system/requirements.txt` to `engines/valuation/requirements.txt`.

## 3. Port LTTD System

- [x] 3.1 Copy the `src` python module directory from `/home/ubuntu/projects/priors-system/quant-btc-lttd-system/src` to `engines/lttd/src`.
- [x] 3.2 Copy `run_pipeline.py` and `requirements.txt` from `/home/ubuntu/projects/priors-system/quant-btc-lttd-system` to `engines/lttd/`.

## 4. Port MTTD System

- [x] 4.1 Copy `mttd` module and `indicators` directory from `/home/ubuntu/projects/priors-system/quant-btc-mttd-system` to `engines/mttd/`.
- [x] 4.2 Copy strategy files: `multi_principle_strategy.py`, `generate_multi_principle_chart.py`, `indicators_helper.py`, `regime_detector.py`, and `library.yaml` to `engines/mttd/`.

## 5. Port Ichimoku System

- [x] 5.1 Copy the `src` module directory from `/home/ubuntu/projects/priors-system/quant-lttd-ichimoku/src` to `engines/ichimoku/src`.
- [x] 5.2 Copy `main.py` and `requirements.txt` from `/home/ubuntu/projects/priors-system/quant-lttd-ichimoku` to `engines/ichimoku/`.

## 6. Pipeline Path Refactoring

- [x] 6.1 Modify `run_report_pipeline.py` to change `PROJECTS_DIR = "/home/ubuntu/projects"` to a relative layout mapping to the local `engines/` subdirectories.
- [x] 6.2 Fix imports and paths in `run_report_pipeline.py` (e.g. updating `sys.path.insert(0, ICHIMOKU_DIR)` and JSON configuration path references).

## 7. Verification and Testing

- [x] 7.1 Verify that the daily pipeline executes cleanly by running `python3 run_report_pipeline.py`.
- [x] 7.2 Commit all changes adhering to the Conventional Commits specification (e.g. `feat: port subsystem engines into local monorepo engines/`).
