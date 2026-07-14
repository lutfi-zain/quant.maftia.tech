# ichimoku-authoritative-metrics Specification

## ADDED Requirements

### Requirement: Pipeline Stores Daily Net Strategy Returns in unified_daily_analytics

The `run_report_pipeline.py` SHALL extract the `Strat_Net_Ret` column from the `df_ich` DataFrame produced by `run_backtest(df_ich, transaction_cost=0.001)` and store it as the `ichi_strat_net_ret` REAL column in the `unified_daily_analytics` table.

`Strat_Net_Ret` is defined by `backtest.py` as:

```
Strat_Net_Ret[t] = Active_Pos[t] × Market_Ret[t] - TC[t]
```

where:

- `Active_Pos[t]` = `Pos[t-1]` (causal t-1 shift, filled with 0)
- `Market_Ret[t]` = `(Close[t] - Close[t-1]) / Close[t-1]`
- `TC[t]` = `|Active_Pos[t] - Active_Pos[t-1]| × 0.001` (10 bps friction)

The field SHALL be NULL for dates before the Ichimoku system's warmup period (first ~120 bars where features are not yet computed).

#### Scenario: Pipeline extracts Strat_Net_Ret after backtest

- **WHEN** `run_report_pipeline.py` executes the Ichimoku computation block
- **THEN** `df_ich['Strat_Net_Ret']` SHALL be extracted from the `run_backtest()` return value
- **AND** stored as `ichi_strat_net_ret` in the `INSERT OR REPLACE INTO unified_daily_analytics` statement

#### Scenario: NULL values for warmup period

- **WHEN** a date falls within the Ichimoku system's warmup period (first ~120 bars)
- **THEN** `ichi_strat_net_ret` SHALL be NULL for that row
- **AND** the pipeline SHALL use `None`/`NULL` rather than 0 or any synthetic value

### Requirement: Pipeline Stores Causal Active Position in unified_daily_analytics

The `run_report_pipeline.py` SHALL extract the `Active_Pos` column from the `df_ich` DataFrame produced by `run_backtest(df_ich, transaction_cost=0.001)` and store it as the `ichi_active_pos` REAL column in the `unified_daily_analytics` table.

`Active_Pos` is the causal t-1 shifted position: `Active_Pos[t] = Pos[t-1]`, with NaN filled to 0. It SHALL be a floating-point value: 0.0 (flat) or 1.0 (positioned).

#### Scenario: Pipeline extracts Active_Pos after backtest

- **WHEN** `run_report_pipeline.py` executes the Ichimoku computation block
- **THEN** `df_ich['Active_Pos']` SHALL be extracted from the `run_backtest()` return value
- **AND** stored as `ichi_active_pos` in the `INSERT OR REPLACE INTO unified_daily_analytics` statement

#### Scenario: Active_Pos is 0 or 1 (never NULL)

- **WHEN** `run_backtest()` generates a complete `Active_Pos` column
- **THEN** `Active_Pos` SHALL be 0.0 for dates before the first trade signal and between trades
- **AND** `Active_Pos` SHALL be 1.0 for dates when the strategy is positioned
- **AND** `Active_Pos` SHALL be 0.0 for the very first date (Pos[-1] does not exist, filled as 0)

### Requirement: Schema Migration Adds 2 Columns to Existing Database

The `run_report_pipeline.py` SHALL include ALTER TABLE migration logic for `ichi_active_pos` and `ichi_strat_net_ret` in the same pattern used for other Ichimoku columns (`ichi_s_tk`, `ichi_s_cloud`, etc.).

The migration SHALL use the existing column-discovery pattern: query `PRAGMA table_info(unified_daily_analytics)` and `ALTER TABLE ADD COLUMN` only if the column is missing.

#### Scenario: Columns created on fresh pipeline run

- **WHEN** `run_report_pipeline.py` executes on a fresh database
- **THEN** the `CREATE TABLE IF NOT EXISTS unified_daily_analytics` statement SHALL include `ichi_active_pos REAL` and `ichi_strat_net_ret REAL` column definitions

#### Scenario: Existing database upgraded without data loss

- **WHEN** `run_report_pipeline.py` executes on a database that already has `unified_daily_analytics` without the two new columns
- **THEN** the migration block SHALL add `ichi_active_pos REAL` and `ichi_strat_net_ret REAL` via `ALTER TABLE ADD COLUMN`
- **AND** all existing rows SHALL retain their data with NULL in the new columns
- **AND** subsequent pipeline runs SHALL populate both columns for all dates with valid Ichimoku data

### Requirement: API Exposes active_pos and strat_net_ret

The `GET /api/v1/quant/daily` endpoint SHALL include `active_pos` and `strat_net_ret` fields under the `ichimoku_imo` response sub-object.

Both fields SHALL be `null` in the JSON response when the database returns NULL for those columns.

#### Scenario: API returns active_pos and strat_net_ret for populated dates

- **WHEN** `GET /api/v1/quant/daily` returns data
- **THEN** each item in the response `data` array SHALL have `ichimoku_imo.active_pos` (number | null) and `ichimoku_imo.strat_net_ret` (number | null)
- **AND** for dates where DB values are non-NULL, the API values SHALL match within tolerance |a - b| < 10⁻⁶

#### Scenario: NULL values serialized as JSON null

- **WHEN** an Ichimoku field is NULL in the database (warmup period or pre-migration rows)
- **THEN** the JSON response SHALL include the key with value `null`

### Requirement: Frontend Types and Mappings Include Authoritative Metric Fields

The `DailyAnalyticsPoint` interface in `web/src/api/types.ts` SHALL include two new optional fields:

```typescript
ichimoku_active_pos?: number;
ichimoku_strat_net_ret?: number;
```

The `getDailyAnalytics()` function in `web/src/api/client.ts` SHALL map both fields from the API response:

```typescript
ichimoku_active_pos: item.ichimoku_imo?.active_pos ?? undefined,
ichimoku_strat_net_ret: item.ichimoku_imo?.strat_net_ret ?? undefined,
```

The `TerminalContext.tsx` SHALL map the same fields through its data transformation.

#### Scenario: All frontend layers have access to authoritative metric fields

- **WHEN** TypeScript compiles components using `ichimoku_active_pos` and `ichimoku_strat_net_ret` from a `DailyAnalyticsPoint`
- **THEN** the types SHALL compile without errors

#### Scenario: Client mapping handles NULL gracefully

- **WHEN** the API returns `null` for `ichimoku_imo.active_pos` or `ichimoku_imo.strat_net_ret`
- **THEN** the corresponding `DailyAnalyticsPoint` field SHALL be `undefined`

### Requirement: useStudioBacktest Computes Metrics from Reference Data When Available

The `useStudioBacktest` hook SHALL gain an optional `referenceMode` mode. When `referenceMode` is active AND all filtered rows have non-null `ichimoku_strat_net_ret` AND `ichimoku_active_pos`, the hook SHALL use these fields directly to compute all metrics:

- **Cumulative equity**: `stratEquity *= (1 + ichimoku_strat_net_ret)` — identical to Python's `(1 + Strat_Net_Ret).cumprod()`
- **Daily returns for metrics**: Use `ichimoku_strat_net_ret` directly for mean/std calculations
- **Trade detection**: Use `ichimoku_active_pos` transitions (0→1 = entry, 1→0 = exit)
- **No fee recomputation**: The 10 bps friction is already embedded in `ichimoku_strat_net_ret`

When `referenceMode` is active but some filtered rows have NULL values (pre-migration data), the hook SHALL fall back to the existing recomputation logic for those rows.

When `referenceMode` is false (default for interactive what-if), the hook SHALL behave exactly as today — recomputing from `position × close × feeBps`.

#### Scenario: Reference metrics computed from stored strat_net_ret

- **WHEN** `useStudioBacktest` is called with `referenceMode: true` and data contains non-null `ichimoku_strat_net_ret` for all filtered rows
- **THEN** the returned `metrics.sharpeRatio` SHALL equal `calculate_metrics()` output within |a - b| < 10⁻⁶ for the same date window
- **AND** `metrics.totalReturnStrat` SHALL equal the last value of `ichi_cum_strat` minus 1, times 100, within tolerance
- **AND** `metrics.maxDrawdown` SHALL be computed from the compounded equity curve derived from `ichi_strat_net_ret`

#### Scenario: Reference trade log matches prior system

- **WHEN** `useStudioBacktest` runs in referenceMode with `ichimoku_active_pos`
- **THEN** `trades` entries SHALL have the same entry/exit dates as the prior system's `extract_trades()` output for the same window
- **AND** each trade's `returnPct` SHALL match the prior system's `return` field within |a - b| < 10⁻⁴

#### Scenario: Fallback to recomputation when strat_net_ret is missing

- **WHEN** data contains NULL `ichimoku_strat_net_ret` for any filtered row
- **THEN** the hook SHALL fall back to the existing position × close × feeBps recomputation
- **AND** the `source` field in the returned metrics SHALL indicate "computed" rather than "reference"

### Requirement: Terminal Displays Reference Metrics as Primary

The `IchimokuTerminal.tsx` metrics grid SHALL display metrics computed from the authoritative `ichi_strat_net_ret` data as the default view. The interactive what-if metrics (from `useStudioBacktest` with the user-specified feeBps) SHALL remain available as a toggle overlay, matching the existing `showInteractive` pattern on the equity curve subplot.

#### Scenario: Metrics grid shows reference metrics on load

- **WHEN** `IchimokuTerminal` mounts with dailyData containing `ichimoku_strat_net_ret`
- **THEN** the metrics grid SHALL display values computed from the authoritative reference data
- **AND** no "Interactive" or "Computed" label SHALL be shown by default (reference is the canonical view)

#### Scenario: Interactive metrics accessible via toggle

- **WHEN** the user activates the "Show What-If" toggle (same toggle that reveals interactive equity curves)
- **THEN** the metrics grid SHALL switch to display interactive-computed metrics
- **AND** the terminal SHALL indicate which metric set is currently displayed via a label or color change
