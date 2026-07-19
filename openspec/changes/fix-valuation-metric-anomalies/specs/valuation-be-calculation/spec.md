## MODIFIED Requirements

### Requirement: Valuation Backend Calculations

The `quant-btc-valuation-system` Python engine SHALL perform all core valuation calculations, including continuous SDCA (Dollar Cost Averaging) strategy ledgers and mathematically symmetrical piecewise linear interpolations for the 17 indicators. The interpolation thresholds MUST map fully to the `[-2.0, +2.0]` range without exhibiting *flatline* bias or unachievable poles due to empirical distribution mismatch.

#### Scenario: Server-Side Processing of Valuation Metrics

- **WHEN** the `run_report_pipeline.py` orchestration script triggers the valuation pipeline
- **THEN** the system MUST strictly compute the `ValuationComposite` score and the SDCA transaction ledger directly against `MasterOHLCV`, maintaining a $t-1$ causal filter, ignoring redundant or `NaN`-heavy indicators (e.g. `williams_r`) during missing windows, and persist the results to `maftia_quant.db` using SQLite WAL mode.
