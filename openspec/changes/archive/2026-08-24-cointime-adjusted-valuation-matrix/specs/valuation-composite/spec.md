# valuation-composite Specification

## MODIFIED Requirements

### Requirement: Valuation Composite Aggregation

The `quant-btc-valuation-system` SHALL calculate the `ValuationComposite` by taking the arithmetic mean of the normalized scores from the **DR-immune indicator set** (9 cointime-adjusted + retained indicators), then applying the existing volatility regime multiplier and expanding-window percentile rescaling. The minimum valid indicator count SHALL be **6** (reduced from 10).

#### Scenario: Normal market conditions with DR-immune indicators

- **WHEN** the daily metrics are aggregated
- **THEN** the system SHALL use only the 9 active indicators:
  - `aviv_ratio` (AVIV Ratio)
  - `mvrv_z_cvsc` (MVRV Z / CVSC)
  - `pi_cycle_top_cvsc` (Pi Cycle / CVSC)
  - `risk_metrics_cvsc` (Risk Metrics / CVSC)
  - `two_year_ma_rcap` (2Yr MA / Realized Cap)
  - `ahr999_cvsc` (AHR999 / CVSC)
  - `vpli_cvsc` (VPLI / CVSC)
  - `terminal_price_ratio` (Terminal Price Ratio, retained)
  - `seller_exhaustion` (Seller Exhaustion, newly added from bitview.space)
- **AND** require at least 6 valid (non-NULL) normalized values
- **AND** apply the CVSC multiplier and IIP penalty on the negative/overvalued side
- **AND** clamp the result between -2.0 and +2.0

#### Scenario: Extreme mature market top with DR-immune indicators

- **WHEN** BTC price reaches a new all-time high in a mature market phase
- **THEN** the cointime-adjusted indicators SHALL reach normalized values near -2.0 due to the dynamically scaled denominators
- **AND** the composite SHALL cross the `<-1.5` boundary, accurately reflecting extreme macro risk

### REMOVED Requirements

### Requirement: Legacy static-threshold indicators from active composite set

**Reason**: Indicators `lth_sth_sopr_ratio`, `sharpe_ratio_52w`, `fear_greed_og`, `dvrsi`, `cvdd_ratio`, and `unrealized_sell_risk` have been removed from the active composite set due to irreversible Diminishing Returns. They remain in `timeseries_metrics` for backward reference but are excluded from composite calculation.

**Migration**: The SQL query in `run_report_pipeline.py` that excludes `('aviv_nupl', 'williams_r', 'fear_greed_cmc')` SHALL be updated to additionally exclude these 6 indicators.
