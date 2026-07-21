# causal-expanding-rescaling Specification

## Purpose
TBD - created by archiving change go-live-valuation-system. Update Purpose after archive.
## Requirements
### Requirement: Causal Composite Rescaling

The Valuation System SHALL compute rescaling parameters (`p2_5`, `p50`, and `p97_5`) for the `ValuationComposite` score at any day $t$ using only historical raw composite values up to day $t-1$, avoiding lookahead bias. The historical raw composite values used for fitting these parameters MUST be gathered from dates with at least 10 valid normalized component signals, and the database storage/retrieval query MUST normalize all date strings to prevent duplicate calendar day entries from corrupting the expanding window distribution.

#### Scenario: Causal rescaling execution with data quality safeguards

- **WHEN** the daily valuation pipeline rescales the raw composite score for date $t$
- **THEN** it fits the percentile bounds (`p2_5`, `p50`, `p97_5`) using strictly historical composite values up to day $t-1$ that contain $\ge 10$ non-null components and have unique formatted date strings, mapping the raw composite score for day $t$ using these expanding window parameters.

