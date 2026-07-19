## 1. Valuation Component Restructuring & Pruning

- [x] 1.1 Update `engines/valuation/quant/seed_metric_config.py` to recalibrate thresholds mathematically: `sharpe_ratio_52w` to `[3.0, 2.0, -1.0, -2.0]`, `cvdd_ratio` to `[25.0, 15.0, 1.0, 2.0]`, and `unrealized_sell_risk` to `[2.2, 1.8, 0.7, 0.85]`.
- [x] 1.2 Modify `engines/valuation/quant/components/williams_r.py` to utilize `ffill()` on the resulting pandas dataframe to propagate weekly data values forward to daily resolutions.
- [x] 1.3 Update `run_report_pipeline.py` to filter out `aviv_nupl` from the SQL average generation of `valuation_composite` due to its high multicollinearity with `aviv_ratio`.

## 2. Testing & Verification

- [x] 2.1 Re-run the valuation configuration seeding script `python3 seed_metric_config.py` in the valuation engine to apply the repaired threshold boundaries.
- [x] 2.2 Re-run the entire orchestrated ecosystem using `python3 /home/ubuntu/projects/run_report_pipeline.py` to rebuild the pipeline without `aviv_nupl` and with complete Williams %R values.
- [x] 2.3 Verify the updated `valuation_composite` scores in `unified_daily_analytics` properly reflect the symmetrically calculated component indicators.

## 3. Deployment & Finalization

- [x] 3.1 Review `git diff` for correctness against design specifications.
- [x] 3.2 Commit all changes adhering to Conventional Commits format (e.g., `quant: fix extreme valuation composite multicollinearity and normalization thresholds`).
