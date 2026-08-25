# composite-dr-correction Specification

## Purpose

Define the DR-immune composite aggregation engine that averages cointime-adjusted indicators through the existing expanding-window percentile rescaling pipeline with an updated indicator set and validation thresholds.

## Requirements

### Requirement: DR-Immune Composite Aggregation

The system SHALL compute the `ValuationComposite` by taking the arithmetic mean of normalized scores from only the DR-immune indicator set (9 active indicators), then applying the existing expanding-window percentile rescaling. The minimum valid indicator count SHALL be 6 (reduced from 10).

#### Scenario: Daily DR-immune aggregation

- **WHEN** the daily valuation pipeline aggregates indicators
- **THEN** the system SHALL average only the 9 active indicators: `aviv_ratio`, `mvrv_z_cvsc`, `pi_cycle_top_cvsc`, `risk_metrics_cvsc`, `two_year_ma_rcap`, `ahr999_cvsc`, `vpli_cvsc`, `terminal_price_ratio`, `seller_exhaustion`
- **AND** require at least 6 valid (non-NULL) normalized values to produce the composite
- **AND** pass the raw average through the expanding-window percentile rescaling to [-2, +2]

#### Scenario: Cycle top detection

- **WHEN** BTC enters a cycle top zone (price within 10% of all-time high)
- **THEN** the DR-immune composite SHALL reach at least -1.0 (strong overvaluation signal)
- **AND** ideally trend toward -2.0 within a 30-day window around the peak

### Requirement: Dynamic Indicator Expulsion

The system SHALL automatically expel any indicator whose normalized score has been NULL for more than 60 consecutive days from the active composite set, preventing silent signal decay.

#### Scenario: Indicator time-out

- **WHEN** an indicator returns NULL results for 60+ consecutive days
- **THEN** the system SHALL exclude it from the composite average
- **AND** log a warning with the indicator name and date range
- **AND** continue using remaining indicators

### Requirement: Composite Validation

The resulting composite SHALL be validated against historical cycle extremes. At every known cycle top (2013, 2017, 2021A, 2021B, 2024, 2025), the composite SHALL be <= -1.0. At every known cycle bottom (2015, 2018, 2022), the composite SHALL be >= +1.0.

#### Scenario: Historical validation

- **WHEN** the composite is computed for a known historical cycle extreme
- **THEN** the score SHALL satisfy the cycle top/bottom thresholds defined above
- **AND** a validation report SHALL be output showing pass/fail for each cycle
