# valuation-feature-pruning Specification

## Purpose
TBD - created by archiving change fix-valuation-metric-anomalies. Update Purpose after archive.
## Requirements
### Requirement: Valuation Component Multicollinearity Reduction

The `quant-btc-valuation-system` Python engine SHALL enforce feature pruning across the 17 core indicators to remove severe multicollinearity (Pearson correlation > 0.90) that artificially inflates standard weighting in the `ValuationComposite`.

#### Scenario: Dropping Redundant AVIV NUPL

- **WHEN** the `run_report_pipeline.py` orchestration script or metric generation pipeline triggers the `ValuationComposite` calculation
- **THEN** the system MUST strictly exclude `aviv_nupl` from the composite mean aggregation to prevent double-counting the AVIV structural signal (which is already represented by `aviv_ratio`).

