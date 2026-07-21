## MODIFIED Requirements

### Requirement: Valuation Backend Calculations

The `quant-btc-valuation-system` Python engine SHALL perform all core valuation calculations, including continuous SDCA (Dollar Cost Averaging) strategy ledgers, mathematically symmetrical piecewise linear interpolations for the 14 active indicators, and data imputation for failing components.

#### Scenario: Server-Side Processing of Valuation Metrics

- **WHEN** the `run_report_pipeline.py` orchestration script triggers the valuation pipeline
- **THEN** the system MUST strictly compute the `ValuationComposite` score via the equal-weighted average of the active indicators (excluding `aviv_nupl`, `williams_r`, and `fear_greed_cmc`), apply the SDCA transaction ledger calculation directly against `MasterOHLCV`, maintain a $t-1$ causal filter, impute missing components using the fallback protocol, and persist the results to `maftia_quant.db` using SQLite WAL mode.

### Requirement: Valuation API Delivery

The unified API Gateway (`api.quant.maftia.tech` on port `:8910`) SHALL provide endpoints to serve the pre-computed `ValuationComposite` and SDCA ledger data directly to the frontend clients.

#### Scenario: Fetching Pre-calculated Data via API Gateway

- **WHEN** a client requests the valuation endpoints (e.g., `/api/v1/sdca/signal`, `/api/v1/sdca/backtest`, `/api/valuation/metrics`)
- **THEN** the API Gateway MUST read the finalized arrays from `maftia_quant.db` (via SQLite WAL connections) and return them as JSON without requiring the API layer to recompute the indicators or transaction math.
