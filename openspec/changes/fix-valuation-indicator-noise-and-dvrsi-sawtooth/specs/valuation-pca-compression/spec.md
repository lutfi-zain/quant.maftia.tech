## MODIFIED Requirements

### Requirement: Data Completeness Fallback Protocol

The system SHALL implement fallback imputation for indicator pipelines that consistently return >50% NaN values. For `dvrsi`, missing daily values SHALL be backfilled by forward-filling (`ffill()`) the weekly volume-weighted DVRSI value to avoid scale mismatch and sawtooth noise. For `fear_greed_cmc`, NaN SHALL be replaced with the concurrent `fear_greed_og` normalized score when available.

#### Scenario: DRSI Fallback Imputation

- **WHEN** the `dvrsi` pipeline runs (full or delta)
- **THEN** the system MUST reindex the weekly dataset to daily frequency and propagate the weekly volume-weighted values forward using `ffill()` to populate missing daily records.

#### Scenario: Fear & Greed CMC Fallback

- **WHEN** `fear_greed_cmc` normalized score is NaN for a date but `fear_greed_og` has a value
- **THEN** the system MUST use the `fear_greed_og` normalized score as the imputed `fear_greed_cmc` value, since the two metrics have Pearson r > 0.90.

## ADDED Requirements

### Requirement: LTH/STH SOPR Ratio Smoothing

The system SHALL apply a 14-day simple moving average to the raw `lth_sth_sopr_ratio` series to filter daily transaction noise and extract the macro cycle trend.

#### Scenario: LTH/STH SOPR Ratio Causal Smoothing

- **WHEN** the `lth_sth_sopr_ratio` pipeline calculates the raw indicator score for day $t$
- **THEN** the system MUST compute a 14-day rolling mean of the daily ratio (`value_lth / value_sth`) up to day $t$ (causal: uses data from $t-13$ to $t$) and normalize this smoothed raw value.
