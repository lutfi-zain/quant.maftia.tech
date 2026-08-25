# CVSC Cache Resilience Specification

## ADDED Requirements

### Requirement: Reliable CVSC Loading and Caching
The `compute_cvsc_norm()` function SHALL load CVSC (Cointime Value Stored Cumulative) data from the bitview.space API and cache it in a local SQLite table (`cvsc_cache` in `metrics.db`). On subsequent runs, it SHALL check the SQLite cache first before making API calls. The cache MUST store `(date TEXT PRIMARY KEY, cvsc_value REAL, fetched_at TEXT)` and operate in WAL mode.

#### Scenario: API call with successful caching
- **WHEN** CVSC data for a specific date is not found in the SQLite cache
- **THEN** the system fetches it from the bitview.space API, stores it in `cvsc_cache`, and uses the fetched value.

#### Scenario: Subsequent run uses cache
- **WHEN** CVSC data for a specific date exists in the SQLite cache
- **THEN** the system skips the API call and uses the cached value.

### Requirement: Multi-tier Fallback Strategy
If both the API and SQLite cache fail, `compute_cvsc_norm()` SHALL use a hardcoded historical approximation formula (linear growth model of CVSC based on Bitcoin's known Cointime history). It SHALL NEVER return the fallback value `1.0`.

#### Scenario: API and cache failure
- **WHEN** both the API request fails and the date is missing from the local SQLite cache
- **THEN** the system computes the CVSC value using the historical approximation formula instead of returning a default `1.0`.

### Requirement: CVSC Normalization Range
`compute_cvsc_norm()` MUST return `log10(max(cvsc_value, 1.0))`. For modern Bitcoin, this value should generally fall within the range `[12.0, 15.0]`.

#### Scenario: Normalization calculation
- **WHEN** a valid `cvsc_value` is retrieved from any tier (API, cache, or fallback)
- **THEN** the system applies the `log10(max(value, 1.0))` transformation before returning it.

### Requirement: Zero Lookahead Bias in CVSC
The CVSC value for date `t` MUST use data available at `t-1`.

#### Scenario: Daily CVSC retrieval
- **WHEN** processing metrics for date `t`
- **THEN** the system queries for and uses the CVSC value logged for date `t-1`.
