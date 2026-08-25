## 1. Core Logic Updates

- [x] 1.1 Remove asymmetric multipliers (`cvsc_factor`, `vol_factor`) and IIP penalty (`iip_penalty_val`) from the valuation composite calculation in `/home/ubuntu/projects/run_report_pipeline.py`.
- [x] 1.2 Update the causal rescaler percentile calculation in `/home/ubuntu/projects/run_report_pipeline.py` to use a 1460-day rolling window of historical raw composite values instead of an expanding window from 2010.
- [x] 1.3 Ensure the `[-2.0, +2.0]` boundary clamping in `run_report_pipeline.py` is preserved after the rolling percentile rescaler is applied.

## 2. Audit Subsystem Consistency

- [x] 2.1 Update `engines/valuation/quant/audit/composite.py` (if it contains redundant composite calculation logic) to mirror the removal of the asymmetric multipliers and the switch to a 1460-day rolling rescaler.

## 3. Validation and Deployment

- [x] 3.1 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` to completely regenerate the `unified_daily_analytics` data structure with the new rolling causal rescaler.
- [x] 3.2 Verify the final generated outputs: Nov 2021 top `~ -2.0`, Nov 2022 bottom `~ +2.0`, and March 2024 mid-cycle local peak inside the `-0.3` to `-0.5` range (not clamped to `-2.0`).
