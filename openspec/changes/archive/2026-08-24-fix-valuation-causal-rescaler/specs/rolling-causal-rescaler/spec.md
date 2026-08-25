## ADDED Requirements

### Requirement: Rolling Causal Percentile Rescaling

The Valuation System SHALL compute rescaling parameters (`p2_5`, `p50`, and `p97_5`) for the `ValuationComposite` score at any day $t$ using a rolling window of historical raw composite values up to day $t-1$, with a maximum window size of 1460 days (4 years). This guarantees zero lookahead bias while ensuring the distribution adapts to modern market structures. The historical raw composite values used for fitting these parameters MUST be gathered from dates with at least 10 valid normalized component signals, and the database storage/retrieval query MUST normalize all date strings to prevent duplicate calendar day entries from corrupting the rolling window distribution.

#### Scenario: Causal rescaling execution with rolling window
- **WHEN** the daily valuation pipeline rescales the raw composite score for date $t$
- **THEN** it fits the percentile bounds (`p2_5`, `p50`, `p97_5`) using strictly historical composite values up to day $t-1$ limited to the last 1460 days that contain $\ge 10$ non-null components, mapping the raw composite score for day $t$ using these rolling window parameters.
