# causal-expanding-rescaling Specification

## Purpose
TBD - created by archiving change go-live-valuation-system. Update Purpose after archive.
## Requirements
### Requirement: Causal Composite Rescaling
The Valuation System SHALL compute rescaling parameters (`p2_5`, `p50`, and `p97_5`) for the composite score at any day $t$ using only historical raw composite values up to day $t-1$. The system MUST NOT use future data points or global parameters fitted across the entire timeseries, preventing lookahead bias.

#### Scenario: Causal rescaling execution
- **WHEN** the daily valuation pipeline rescales the composite score for date $t$
- **THEN** it fits the persentile bounds (`p2_5`, `p50`, `p97_5`) using strictly historical composite values up to day $t-1$ and maps the raw composite h-1 score using these expanding window parameters.

