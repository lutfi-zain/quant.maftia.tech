## Context

The `ValuationComposite` score flows through two layers of normalization:

1. **Component-level**: each of the ~17 indicators is normalized to `[-2.0, +2.0]` via piecewise linear interpolation against thresholds in `metric_config` and stored in `timeseries_metrics` (in `engines/valuation/database/metrics.db`).
2. **Composite-level**: `run_report_pipeline.py::fetch_valuation_composite_data()` queries `AVG(normalized_value)` grouped by `date`, applies a CVSC volatility multiplier plus IIP penalty, hard-clamps the result to `[-2.0, +2.0]`, then re-scales via an **expanding-window causal percentile rescaling** (p2.5 → -2.0, p50 → 0.0, p97.5 → +2.0) before writing to `unified_daily_analytics.valuation_composite`.

**Root cause — date format mismatch:**

`bitview_client.py::fetch_series()` generates all dates in `YYYY-MM-DDT00:00:00Z` format. Most components pass these dates straight through to `_default_store()`. However, two components perform an internal daily `reindex()` after fetching weekly data and then call `dt.strftime("%Y-%m-%d")`, stripping the `T` and `Z`:

| Component | Offending line | Records (plain) | Records (T-format) |
|---|---|---|---|
| `dvrsi.py` | `df["date"] = df["date"].dt.strftime("%Y-%m-%d")` (line 84) | 5,861 | 916 |
| `williams_r.py` | `df["date"] = df["date"].dt.strftime("%Y-%m-%d")` (line 46) | 5,818 | 831 |

Because `timeseries_metrics` uses `(metric_name, date) TEXT PRIMARY KEY`, each plain-format date is a **distinct row** from its T-format counterpart. When the composite query `GROUP BY date` aggregates, it creates ~6,800 extra "days" containing only 1–2 components each, with raw composite averages ranging wildly from -2.0 to +2.0.

**Impact on expanding-window percentiles:**

Without a minimum-component filter, these 6,800 junk rows enter the percentile history:

- Corrupted `p97_5` inflates from **1.52 → 2.00** (pulled by single-component +2.0 outliers)
- A real raw composite of 1.27 rescales to **~1.10** instead of the correct **~1.58**
- All historical `valuation_composite` values in `maftia_quant.db` are compressed by ~30%

## Goals / Non-Goals

**Goals:**

- Standardize date output in `dvrsi.py` and `williams_r.py` to `YYYY-MM-DDT00:00:00Z`, matching `bitview_client.py` and all other components.
- Run a one-off SQLite migration to reformat existing plain-date rows in `timeseries_metrics` to the T-format.
- Add `HAVING COUNT(normalized_value) >= 10` to the raw composite aggregation query inside `fetch_valuation_composite_data()` in `run_report_pipeline.py`, ensuring sparse or corrupted days are excluded from the percentile history.
- Re-run the full pipeline after the fix to repopulate corrected `valuation_composite` scores in `maftia_quant.db`.

**Non-Goals:**

- Changing the mathematical structure of piecewise linear interpolation or the expanding window percentile algorithm.
- Modifying LTTD, MTTD, or Ichimoku engine logic.
- Applying volatility-adjusted thresholds or illiquidity-adjusted Z-scores (structural regime shift — tracked separately in `findings.md`).
- Any changes to the deprecated `quant-technical-indicator-bank`.

## Decisions

### Decision 1: Fix date format at the source (component scripts), not at the query layer

**Chosen:** Change the `strftime("%Y-%m-%d")` call in `dvrsi.py` and `williams_r.py` to `strftime("%Y-%m-%dT00:00:00Z")`.

**Alternative considered:** Normalize dates at the SQL query layer using `substr(date, 1, 10)` in `GROUP BY`. Rejected because it would mask the root cause, require changes in multiple query sites, and leave structurally corrupt rows in the database.

**Rationale:** Fixing the source guarantees all future pipeline runs write consistent date strings. Combined with the DB migration, it produces a clean, fully consistent `timeseries_metrics` table.

### Decision 2: One-off DB migration script (not a persistent upgrade trigger)

**Chosen:** A standalone Python migration script `scripts/migrate_timeseries_date_format.py` that:

1. Opens `metrics.db` via WAL connection.
2. Finds all rows where `date NOT LIKE '%T%'`.
3. Checks whether the T-format counterpart already exists for `(metric_name, date)`.
4. If T-format exists: deletes the plain-format row (duplicate already stored).
5. If T-format does not exist: updates the plain-format date string to T-format in-place.
6. Commits atomically, logs a summary.

**Alternative considered:** Using `INSERT OR REPLACE` with a SELECT from existing plain rows. Rejected as more complex and prone to primary-key conflicts mid-migration.

**Rationale:** A standalone script is safe, auditable, idempotent (safe to re-run), and clearly separable from the ongoing pipeline.

### Decision 3: Add `HAVING COUNT >= 10` to the composite aggregation query

**Chosen:** In `run_report_pipeline.py::fetch_valuation_composite_data()`, modify the SQL to:

```sql
SELECT date, AVG(normalized_value) as comp, MAX(btc_price) as btc
FROM timeseries_metrics
WHERE normalized_value IS NOT NULL
  AND metric_name NOT IN ('aviv_nupl', 'williams_r', 'fear_greed_cmc')
GROUP BY date
HAVING COUNT(normalized_value) >= 10
ORDER BY date ASC
```

**Rationale:** This mirrors the quality gate already used by `composite.py::fit_rescaling_params()` (the audit runner), bringing the production pipeline in line with the audit module. Ten is a conservative threshold — there are currently 15 active components (after exclusions), and a day with fewer than 10 is almost certainly a partial/corrupted date-format entry.

## Risks / Trade-offs

- **Migration rewrites ~11,000 rows** → Run inside a single WAL transaction; the DB file must not be read by the pipeline concurrently during migration. Risk is low given WAL mode; mitigated by running migration before the next pipeline run.
- **`p50` shift after fix** → Once junk rows are removed, the expanding-window median may shift slightly. The repopulated `valuation_composite` scores will differ from the current (corrupted) values. This is the intended correction.
- **`williams_r` is excluded from the composite** (it's in the `NOT IN` exclusion list) so its date-format fix primarily stops it from creating junk dates that were previously polluting the percentile set.
- **No rollback path for DB migration** → The migration logs a before/after row count for auditability; the original data is not deleted for T-format rows that already exist (only the duplicate plain-format entry is removed).

## Migration Plan

1. **Stop any running pipeline** (`run_report_pipeline.py`).
2. **Apply component fixes**: modify `strftime` format strings in `dvrsi.py` and `williams_r.py`.
3. **Run DB migration**: `python3 scripts/migrate_timeseries_date_format.py`.
4. **Patch `run_report_pipeline.py`**: add `HAVING COUNT(normalized_value) >= 10`.
5. **Rebuild the composite**: run `python3 run_report_pipeline.py` from `/home/ubuntu/projects/`. This re-runs all engines, re-aggregates the composite, recomputes correct percentile bounds, and syncs corrected `valuation_composite` into `maftia_quant.db`.
6. **Verify**: query `SELECT MIN(valuation_composite), MAX(valuation_composite) FROM unified_daily_analytics` to confirm scores span the expected range. Check that recent values (~1.5–1.8) and historical bear-market values (approaching -2.0) are correctly spread.

## Open Questions

- Should `dvrsi` remain in the `NOT IN` exclusion list for the composite, or should it be re-included? Currently excluded alongside `williams_r` and `fear_greed_cmc`. After the date-format fix removes its junk entries, its normalized values are clean — re-inclusion is a separate decision.
- The structural regime shift (findings.md) means even corrected composite values will not reach ±2.0 at market extremes. Adaptive threshold normalization is out of scope here but should be tracked in a follow-up change.
