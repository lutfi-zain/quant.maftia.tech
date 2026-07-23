# cointime-adjusted-indicators Specification

## Purpose

Normalize raw onchain indicators by Cointime Value Stored Cumulative (CVSC) or rolling realized cap to produce naturally stationary, DR-immune oscillators that maintain consistent signal amplitude across all BTC market cycles.

## Requirements

### Requirement: Cointime-Adjusted Indicator Computation

The `quant-btc-valuation-system` SHALL compute cointime-adjusted versions of MVRV Z-Score, Pi Cycle Top, Risk Metrics, Two-Year MA, AHR999, and VPLI by dividing each indicator's raw value by the log-transformed CVSC or an equivalent network-scaled denominator.

#### Scenario: Normal daily computation

- **WHEN** the daily valuation pipeline runs
- **THEN** the system fetches the latest CVSC value from bitview.space, computes `CVSC_norm = log10(max(CVSC, 1))`, and for each cointime-adjusted indicator divides its raw value by `CVSC_norm` before passing through the piecewise linear normalization thresholds

#### Scenario: CVSC fetch failure

- **WHEN** the bitview.space API is unreachable or returns an error
- **THEN** the system SHALL use `CVSC_norm = 1.0` as fallback, effectively using the raw indicator value as-is (graceful degradation to existing behavior)

#### Scenario: New indicator threshold configuration

- **WHEN** the `metric_config` table is queried for a cointime-adjusted indicator
- **THEN** the system SHALL return the thresholds defined in the design's Decision 4 table

### Requirement: AVIV Ratio Permanently Active

The `AVIV Ratio` indicator SHALL be permanently included in the active composite calculation set, regardless of any future indicator pruning.

#### Scenario: Composite aggregation includes AVIV

- **WHEN** the system builds the list of active indicators for composite averaging
- **THEN** `aviv_ratio` SHALL always be included in the query and never excluded by any dynamic filtering

### Requirement: Cointime-Adjusted Indicator Addition

The system SHALL compute and store additional cointime-adjusted indicators beyond the core replacement set as specified in the `metric_config` seed data.

#### Scenario: Seed data migration

- **WHEN** the pipeline runs with cointime-adjusted indicators enabled
- **THEN** the system SHALL insert new rows into `metric_config` for `mvrv_z_cvsc`, `pi_cycle_top_cvsc`, `risk_metrics_cvsc`, `two_year_ma_rcap`, `ahr999_cvsc`, and `vpli_cvsc` with thresholds from design.md Decision 4

### Requirement: CVSC Caching

CVSC value SHALL be fetched once per pipeline execution and cached in an in-memory dictionary for reuse across all cointime-adjusted indicator computations.

#### Scenario: Pipeline execution

- **WHEN** `run_report_pipeline.py` executes
- **THEN** it fetches CVSC once, stores it as a global/shared variable, and each indicator component reads from this cache rather than making individual API calls
