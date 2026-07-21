## 1. Fix Component Date Format at Source

- [x] 1.1 In `engines/valuation/quant/components/dvrsi.py` (line 84), change `df["date"] = df["date"].dt.strftime("%Y-%m-%d")` → `df["date"] = df["date"].dt.strftime("%Y-%m-%dT00:00:00Z")` so all daily-reindexed DVRSI dates match the standard T-format used by `bitview_client.py`.
- [x] 1.2 In `engines/valuation/quant/components/williams_r.py` (line 46), change `df["date"] = df["date"].dt.strftime("%Y-%m-%d")` → `df["date"] = df["date"].dt.strftime("%Y-%m-%dT00:00:00Z")` so all daily-reindexed Williams %R dates match the standard T-format.
- [x] 1.3 Verify the fix by running the `dvrsi` component pipeline in isolation: `cd engines/valuation && python3 -m quant.run_all --metric dvrsi` and confirm that new rows in `timeseries_metrics` use `YYYY-MM-DDT00:00:00Z` format.
- [x] 1.4 Verify `williams_r` similarly: `python3 -m quant.run_all --metric williams_r` and spot-check the `date` column in `timeseries_metrics`.

## 2. Database Migration — Normalize Legacy Plain-Format Dates

- [x] 2.1 Create `scripts/migrate_timeseries_date_format.py`. The script must: open `engines/valuation/database/metrics.db` via WAL connection (`get_wal_connection`); query all rows where `date NOT LIKE '%T%'`; for each `(metric_name, plain_date)`, compute the T-format equivalent; if a T-format row already exists for `(metric_name, t_date)`, delete the plain-format row; otherwise, `UPDATE timeseries_metrics SET date = t_date WHERE metric_name = ? AND date = plain_date`; commit atomically and log a summary of updated, deleted, and skipped rows.
- [x] 2.2 Run the migration script: `python3 scripts/migrate_timeseries_date_format.py` and confirm the output log shows 0 remaining plain-format rows.
- [x] 2.3 Verify post-migration state: `SELECT COUNT(*) FROM timeseries_metrics WHERE date NOT LIKE '%T%'` should return 0.
- [x] 2.4 Verify that the total row count for `dvrsi` and `williams_r` in `timeseries_metrics` is consistent (no net loss beyond true duplicates), using `SELECT metric_name, COUNT(*) FROM timeseries_metrics GROUP BY metric_name`.

## 3. Patch the Composite Aggregation Query in the Orchestration Pipeline

- [x] 3.1 In `run_report_pipeline.py::fetch_valuation_composite_data()`, add `HAVING COUNT(normalized_value) >= 10` to the raw composite SQL query (after the `GROUP BY date` clause and before `ORDER BY date ASC`) to exclude sparse/junk dates from the expanding-window percentile history.
- [x] 3.2 Confirm the existing `HAVING COUNT(normalized_value) >= 10` filter is already present in `engines/valuation/quant/audit/composite.py::fit_rescaling_params()` (no change needed there — verify parity).

## 4. Pipeline Verification and Score Correction

- [x] 4.1 Run the full orchestration pipeline: `python3 /home/ubuntu/projects/run_report_pipeline.py` to rebuild all engines and re-sync corrected `valuation_composite` scores into `maftia_quant.db`.
- [x] 4.2 After the pipeline run, verify score distribution: `SELECT MIN(valuation_composite), MAX(valuation_composite), AVG(valuation_composite) FROM unified_daily_analytics WHERE valuation_composite IS NOT NULL` — confirm `MAX` approaches the corrected upper bound (~1.5–2.0 for recent data, depending on historical regime) and scores are no longer compressed around 1.0.
- [x] 4.3 Cross-validate the corrected composite against the audit module: `cd engines/valuation && python3 -m quant.audit.runner` and confirm the printed `p97.5` audit composite param is consistent with values now stored in `unified_daily_analytics`.
- [x] 4.4 Spot-check the Valuation Studio frontend to confirm the composite score line in the `ValuationStudio` chart now spans a wider range and the `+1.50` bubble threshold reference line is no longer at the practical ceiling of the chart.

## 5. Tests and Commit

- [x] 5.1 Run the existing Valuation System test suite: `cd engines/valuation && python3 -m pytest quant/tests/ -v` and confirm all tests pass with no regressions.
- [x] 5.2 Commit the component date-format fixes: `git commit -m "fix: standardize date format to ISO8601 T-format in dvrsi and williams_r components"`.
- [x] 5.3 Commit the migration script: `git commit -m "fix: add timeseries_metrics date format migration script to eliminate plain-date duplicates"`.
- [x] 5.4 Commit the pipeline query patch: `git commit -m "fix: add HAVING COUNT >= 10 guard to valuation composite aggregation in run_report_pipeline"`.
