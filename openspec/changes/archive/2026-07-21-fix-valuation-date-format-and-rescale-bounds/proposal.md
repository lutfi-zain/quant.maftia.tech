## Why

The production data sync pipeline (`run_report_pipeline.py`) currently generates distorted and compressed `valuation_composite` scores (ranging between ~0.83 and ~1.30 instead of the standard `[-2.0, +2.0]` range). This compression is caused by a date format mismatch in the SQLite `timeseries_metrics` database: two components (`dvrsi` and `williams_r`) write dates in plain `YYYY-MM-DD` format, while the other 15 components write in `YYYY-MM-DDT00:00:00Z` format. This discrepancy creates duplicate records per calendar day, causing the expanding-window percentile calculator to treat incomplete, single-component entries as distinct days, skewing the historical percentile distribution (`p97_5` gets inflated to +2.0) and compressing the real scores.

## What Changes

- Modify `dvrsi` and `williams_r` component scripts to consistently write dates in `YYYY-MM-DDT00:00:00Z` format, matching all other components in the Valuation system.
- Clean up existing database inconsistencies by converting all legacy `YYYY-MM-DD` plain dates in `timeseries_metrics` and related tables to the standard `YYYY-MM-DDT00:00:00Z` format.
- Add a component-count safeguard to the daily raw composite query in `run_report_pipeline.py` (using `HAVING COUNT(normalized_value) >= 10`) to prevent future incomplete data days from corrupting the expanding percentile bounds.
- Confirm zero lookahead bias by ensuring that all percentiles for date $t$ continue to be computed strictly on historical values up to $t-1$.

## Non-goals

- Altering the fundamental mathematical structure of the piecewise linear interpolation or expanding window percentiles.
- Modifying LTTD, MTTD, or Ichimoku core strategy models.
- Re-introducing or touching any legacy files related to the deprecated `quant-technical-indicator-bank` system.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities

- `causal-expanding-rescaling`: Ensure that the historical dataset used to calculate the causal expanding percentiles is filtered for data quality (requiring at least 10 active components) and is free of date-string format duplicates.

## Impact

- **Valuation System (`quant-btc-valuation-system` / `engines/valuation`)**: The component scripts `dvrsi.py` and `williams_r.py` will format dates as `YYYY-MM-DDT00:00:00Z`. The database migration script will update the `timeseries_metrics` table.
- **Orchestration & Data Sync Pipeline (`run_report_pipeline.py`)**: The raw composite aggregation query will include a `HAVING COUNT(normalized_value) >= 10` filter.
- **Unified Daily Analytics DB (`maftia_quant.db`)**: Corrected, uncompressed `valuation_composite` scores will propagate to the frontend.
