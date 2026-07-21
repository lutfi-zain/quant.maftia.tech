## 1. Core Logic Changes in Valuation Studio

- [x] 1.1 Implement volatility-adjusted normalization scaling logic inside `engines/valuation/quant/components/normalization.py`. The scaling ratio must clamp to `[0.4, 1.5]` and dynamically adjust $t_{-1}$ and $t_{-2}$ thresholds for `mvrv_z`, `aviv_ratio`, and `aviv_nupl` based on 1Y rolling price volatility.
- [x] 1.2 Modify `engines/valuation/quant/run_peaks_analysis.py` to calculate the IIP Penalty using a cumulative average (expanding window) of the `illiquidity_factor` instead of the 1460-day rolling mean.
- [x] 1.3 Update `engines/valuation/quant/run_regime_analysis.py` to match the cumulative IIP Penalty calculation behavior.

## 2. Report Pipeline and Analytics Integration

- [x] 2.1 Update the database parameter fitting logic in `engines/valuation/quant/audit/composite.py` to handle volatility-scaled indicator values during composite fitting.
- [x] 2.2 Update `run_report_pipeline.py` to calculate the volatility regime multiplier and cumulative IIP penalty correctly, matching the changes in the valuation engine.
- [x] 2.3 Ensure the calculated `valuation_composite` is pushed to `maftia_quant.db`'s `unified_daily_analytics` table via parameterized queries under Write-Ahead Logging (`WAL`) mode.

## 3. Verification & Testing

- [x] 3.1 Run tests inside `engines/valuation/quant/tests/` to verify that existing normalization logic is unchanged and that new volatility adjustments execute properly.
- [x] 3.2 Execute the master synchronization and report generation script `python3 /home/ubuntu/projects/run_report_pipeline.py` as the final pipeline verification.
- [x] 3.3 Verify that the calculated valuation composite on 2025-10-06 registers as overvalued ($\le -1.0$).
- [x] 3.4 Commit changes using Conventional Commits convention (e.g. `quant: implement adaptive cycle-top indicators and cumulative IIP`).
