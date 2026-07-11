# valuation-studio-renormalize-flow Specification

## Purpose
TBD - created by archiving change valuation-studio-major-gap-fixes. Update Purpose after archive.
## Requirements
### Requirement: Renormalize endpoint exists at POST /api/v1/quant/metric/:metric_name/renormalize
The Hono API gateway SHALL expose `POST /api/v1/quant/metric/:metric_name/renormalize` that triggers per-metric renormalization of `unified_component_signals.normalized_score` using the currently stored threshold config in `maftia_quant.db`.

#### Scenario: Successful renormalize request
- **WHEN** `POST /api/v1/quant/metric/mvrv_zscore/renormalize` is called
- **THEN** the endpoint spawns the renormalization Python script for `mvrv_zscore`
- **AND** returns `{ success: true, metric: "mvrv_zscore", rows_updated: <N> }` with HTTP 200 on success

#### Scenario: Renormalize for unknown metric
- **WHEN** `POST /api/v1/quant/metric/nonexistent_metric/renormalize` is called
- **THEN** the endpoint returns HTTP 404 with `{ error: "Metric not found" }`

#### Scenario: Renormalize script timeout
- **WHEN** the Python subprocess does not complete within 30 seconds
- **THEN** the endpoint returns HTTP 504 with `{ error: "Renormalize timed out" }`

### Requirement: Threshold save triggers renormalization in frontend
After `saveMetricConfig` succeeds in `MetricDetailChart.tsx`, the component SHALL call `POST /api/v1/quant/metric/:metric_name/renormalize` before calling `onRefresh()`, so threshold changes are immediately reflected in displayed `normalized_score` values without requiring a full pipeline run.

#### Scenario: Save threshold config triggers renormalize then refresh
- **WHEN** the user edits thresholds and clicks Save
- **THEN** `saveMetricConfig` is called first
- **AND** on success, `renormalize` endpoint is called for the active metric
- **AND** on renormalize success, `onRefresh()` is called to reload the chart data

#### Scenario: Renormalize failure does not silently swallow error
- **WHEN** the renormalize endpoint returns an error after a threshold save
- **THEN** the UI displays a toast or error message indicating renormalization failed
- **AND** `onRefresh()` is still called so the user sees the saved config (even if not yet renormalized)

### Requirement: Renormalize Python script exists and is idempotent
The script at `quant-btc-valuation-system/scripts/renormalize_metric.py` SHALL accept a metric name as a CLI argument, read the current thresholds from `maftia_quant.db`, recompute `normalized_score` for all rows in `unified_component_signals` for that metric using piecewise linear interpolation, and update the rows in a SQLite WAL transaction.

#### Scenario: Renormalize script produces causal output
- **WHEN** the script runs for any metric
- **THEN** normalized scores are computed using only data available at each row's timestamp
- **AND** no future data is leaked (strict `t-1` causal filter)

#### Scenario: Renormalize script is idempotent
- **WHEN** the script is run twice with the same thresholds
- **THEN** the `normalized_score` values are identical after both runs

