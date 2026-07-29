## 1. CVSC Cache Persistence Layer

- [x] 1.1 Create `cvsc_cache` SQLite table in `engines/valuation/database/metrics.db` with schema `(date TEXT PRIMARY KEY, cvsc_value REAL, fetched_at TEXT)` using WAL mode and parameterized queries. Add table creation to `seed_metric_config.py`.
- [x] 1.2 Implement `_load_cvsc_from_sqlite(db_path) -> dict[str, float]` in `normalization.py` that reads the `cvsc_cache` table into the global `_cvsc_cache` dict. Use `get_wal_connection()` from `db_connector.py`.
- [x] 1.3 Implement `_save_cvsc_to_sqlite(cache: dict, db_path)` in `normalization.py` that persists the in-memory cache to the `cvsc_cache` table using `INSERT OR REPLACE` with parameterized queries.
- [x] 1.4 Implement `_compute_cvsc_approximation(date: str) -> float` hardcoded fallback in `normalization.py` using the formula `10^(12.5 + 0.15 * years_since_2015)`. Log a WARNING when this fallback is used.

## 2. Multi-tier CVSC Loading Logic

- [x] 2.1 Refactor `load_cvsc_cache()` in `normalization.py` to implement the 3-tier fallback chain: (1) SQLite cache → (2) bitview.space API with SQLite writeback → (3) hardcoded approximation. Remove the `return {}` failure path.
- [x] 2.2 Update `compute_cvsc_norm()` to assert the return value is `>= 10.0` (sanity guard). Replace the `return 1.0` fallback with a call to `_compute_cvsc_approximation()`. Add a debug log when returning non-cached values.
- [x] 2.3 Write unit test `test_cvsc_cache_fallback` verifying: (a) cache loads from SQLite when API is unavailable, (b) approximation formula returns values in `[12.0, 15.0]` range for dates 2015-2026, (c) `compute_cvsc_norm()` never returns `1.0`.

## 3. Degenerate Series Handling in Rescaler

- [x] 3.1 Update `expanding_window_rescale()` in `normalization.py` to detect zero-variance windows (where `p2_5 == p97_5`) and return `0.0` (neutral) for those data points instead of propagating the degenerate boundary value.
- [x] 3.2 Write unit test `test_rescale_degenerate_series` verifying that an all-`-2.0` input series produces `0.0` output after the 180-day warmup period, and a mixed series with partial degeneracy transitions correctly.

## 4. Threshold Recalibration

- [x] 4.1 Create one-shot script `engines/valuation/quant/recalibrate_cvsc_thresholds.py` that: (a) runs full rebuild fetch_data + CVSC-division for all 6 CVSC components, (b) computes p2.5, p25, p75, p97.5 of the CVSC-divided raw values, (c) prints recommended `metric_config` threshold values in SQL INSERT format.
- [x] 4.2 Execute the recalibration script and capture the recommended thresholds. Update `seed_metric_config.py` with the recalibrated values for `ahr999_cvsc`, `mvrv_z_cvsc`, `pi_cycle_top_cvsc`, `risk_metrics_cvsc`, `two_year_ma_rcap`, and `vpli_cvsc`.
- [x] 4.3 Run `seed_metric_config.py` to update `metric_config` table in `metrics.db` with the new thresholds. Verify with a SQL query that all 6 CVSC metrics have non-zero, distinct threshold values.

## 5. Full Historical Rebuild

- [x] 5.1 Backup `metrics.db` to `metrics.db.bak` before rebuild.
- [x] 5.2 Execute `--rebuild` for all 6 CVSC components: `ahr999_cvsc`, `mvrv_z_cvsc`, `pi_cycle_top_cvsc`, `risk_metrics_cvsc`, `two_year_ma_rcap`, `vpli_cvsc`. Verify each component's pipeline returns `status: success`.
- [x] 5.3 Validate post-rebuild distributions: for each CVSC component, query `SELECT COUNT(*) as total, SUM(CASE WHEN normalized_value = -2.0 THEN 1 ELSE 0 END) as neg2 FROM timeseries_metrics WHERE metric_name = ?` and confirm `neg2/total < 50%` (was 82-100% before fix).

## 6. Component Distribution Guard

- [x] 6.1 Add `_check_distribution_health(metric_name, db_path) -> dict` method in `base.py` that queries the `timeseries_metrics` table for boundary-value percentages and returns `{"warning": str | None, "boundary_pct": float}`.
- [x] 6.2 Integrate `_check_distribution_health()` into `_default_run_pipeline()` after the `store()` step. Include the result in the pipeline return dict under `"distribution_health"` key. Log `WARNING` if boundary percentage exceeds 95%.
- [x] 6.3 Write unit test `test_distribution_guard` verifying that a component with >95% boundary values triggers a warning, and one with <95% does not.

## 7. Pipeline Verification & Composite Validation

- [x] 7.1 Run `python3 run_report_pipeline.py` end-to-end and confirm all systems complete without errors.
- [x] 7.2 Query the `ValuationComposite` score for the latest date and verify it is higher than the pre-fix value (should be ~+1.0 to +1.5 in current market vs pre-fix ~+0.6). Compare composite time-series for known cycle peaks (Nov 2021, Sep-Nov 2025) to confirm they still trigger overvaluation signals (`< -1.0`).
- [x] 7.3 Query the API endpoint `GET /api/v1/quant/components?system=quant-btc-valuation-system` and verify that CVSC component `normalized_score` values are distributed across `[-2.0, +2.0]` range instead of being stuck at `-2.0`.
- [x] 7.4 Commit all changes with `fix: recalibrate CVSC-adjusted valuation indicators and restore composite accuracy`.
