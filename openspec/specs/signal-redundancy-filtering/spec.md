# signal-redundancy-filtering Specification

## Purpose
TBD - created by archiving change go-live-valuation-system. Update Purpose after archive.
## Requirements
### Requirement: Correlation-Based Indicator Grouping and Pruning
The Valuation System SHALL group raw indicators into orthagonal classes based on a Pearson correlation threshold of $|r| > 0.85$. Indicators grouped within the same high-correlation cluster (such as `aviv_nupl`, `aviv_ratio`, and `mvrv_z`) SHALL be aggregated or filtered using component weightings (e.g. 1/N weight per cluster instead of per indicator) to prevent over-weighting a single market dimension.

#### Scenario: Aggregation of correlated cost-basis indicators
- **WHEN** the composite score is calculated from the active indicators
- **THEN** it identifies clusters with $|r| > 0.85$ and aggregates the normalized scores of indicators within each cluster (taking their average) to produce a single representative score for that cluster before averaging across all independent dimensions.

