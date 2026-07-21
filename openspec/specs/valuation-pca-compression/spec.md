# valuation-pca-compression Specification

## Purpose
TBD - created by archiving change fix-valuation-composite-integrity. Update Purpose after archive.
## Requirements
### Requirement: Williams %R Full-Range Threshold Correction

The threshold configuration for `williams_r` SHALL be recalibrated so that its native `[-100, 0]` oscillator range maps linearly to the full `[-2.0, +2.0]` normalization band instead of being truncated at `[0, +2.0]`.

#### Scenario: Corrected Williams %R Normalization

- **WHEN** the `williams_r` component pipeline runs (full or delta)
- **THEN** the `metric_config` thresholds for `williams_r` MUST be t_plus_2 = -80 (oversold ≡ deep discount → +2.0), t_plus_1 = -20 (mild oversold → +1.0), t_minus_1 = -20 (mild overbought → -1.0), t_minus_2 = -80 (overbought → -2.0), with `inverted = True` flag set in normalization.

### Requirement: Data Completeness Fallback Protocol

The system SHALL implement fallback imputation for indicator pipelines that consistently return >50% NaN values. For `dvrsi`, missing values SHALL be backfilled by computing a daily RSI-equivalent from daily OHLC using a simplified stochastic formula. For `fear_greed_cmc`, NaN SHALL be replaced with the concurrent `fear_greed_og` normalized score when available.

#### Scenario: DRSI Fallback Imputation

- **WHEN** the `dvrsi` pipeline fails to compute a value for a given date due to weekly data gaps
- **THEN** the system MUST compute a daily RSI over the available daily close series (window = 14) and impute that value through the `dvrsi` normalization thresholds.

#### Scenario: Fear & Greed CMC Fallback

- **WHEN** `fear_greed_cmc` normalized score is NaN for a date but `fear_greed_og` has a value
- **THEN** the system MUST use the `fear_greed_og` normalized score as the imputed `fear_greed_cmc` value, since the two metrics have Pearson r > 0.90.

