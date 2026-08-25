## 1. Eliminate dvrsi Sawtooth Noise

- [x] 1.1 In `engines/valuation/quant/components/dvrsi.py`, delete the daily price fallback try-except block (which imports daily price, computes daily RSI, and merges it).
- [x] 1.2 In `engines/valuation/quant/components/dvrsi.py`, replace the reindexing and fallback block with simple `.reindex(daily_idx).ffill()` to forward-fill the weekly volume-weighted DVRSI values.
- [x] 1.3 Update the return date formatting: ensure the output dates use `strftime("%Y-%m-%dT00:00:00Z")`.

## 2. Smooth lth_sth_sopr_ratio Indicator

- [x] 2.1 In `engines/valuation/quant/components/lth_sth_sopr_ratio.py::normalize()`, update the raw value calculation to apply a causal 14-day simple moving average: `df["raw_value"] = (df["value_lth"] / df["value_sth"]).rolling(window=14, min_periods=1).mean()`.

## 3. Pipeline Run & Noise Reduction Verification

- [x] 3.1 Run the full data sync pipeline to rebuild database values: `python3 /home/ubuntu/projects/run_report_pipeline.py`.
- [x] 3.2 Verify that the `dvrsi` sawtooth noise is completely eliminated and `lth_sth_sopr_ratio` is smoothed, using a python query that computes the standard deviation of daily changes.
- [x] 3.3 Run pytest to verify all tests continue to pass: `cd engines/valuation && python3 -m pytest quant/tests/ -v`.
- [x] 3.4 Build the frontend web project to confirm zero TypeScript compilation errors: `cd web && bun run build`.

## 4. Commit Changes

- [x] 4.1 Commit all modifications to main: `git commit -m "quant: eliminate DVRSI sawtooth noise with ffill and apply 14-day SMA to LTH/STH SOPR ratio"`.
