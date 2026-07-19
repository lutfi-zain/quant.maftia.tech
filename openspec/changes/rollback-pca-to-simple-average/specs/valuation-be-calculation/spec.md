## MODIFIED Requirements

### Requirement: Valuation Backend Calculations

The `quant-btc-valuation-system` Python engine SHALL perform all core valuation calculations, including piecewise linear interpolations for the 17 indicators and continuous SDCA (Dollar Cost Averaging) strategy ledgers. The `ValuationComposite` SHALL be computed as a simple equal-weighted average of 14 indicator normalized scores (excluding `aviv_nupl`, `williams_r`, and `fear_greed_cmc` due to redundancy or data quality issues). PCA compression SHALL NOT be applied.

#### Scenario: Server-Side Processing of Valuation Metrics

- **WHEN** the `run_report_pipeline.py` orchestration script triggers the valuation pipeline
- **THEN** the system MUST compute the `ValuationComposite` score as `AVG(normalized_score)` across the 14 retained indicators, maintaining a $t-1$ causal filter, and persist the results to `maftia_quant.db` using SQLite WAL mode.
