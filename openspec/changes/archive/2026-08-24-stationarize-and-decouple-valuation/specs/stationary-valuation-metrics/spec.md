## ADDED Requirements

### Requirement: Stationarized Two-Year Moving Average Metric
The `quant-btc-valuation-system` SHALL calculate `two_year_ma_rcap` as a dimensionless percentage deviation: `(close - two_year_ma) / two_year_ma`, ensuring the raw metric range is stationary across historical Bitcoin halving cycles.

#### Scenario: Cycle bottom evaluation
- **WHEN** Bitcoin price drops below the 2-Year Moving Average (e.g. November 2022 FTX crash at $15.5k)
- **THEN** `two_year_ma_rcap` produces a negative raw deviation (e.g. -0.45) that maps to a positive valuation score (`+2.0`), correctly signaling deep cycle bottom undervaluation.

### Requirement: Stationarized Terminal Price Ratio Metric
The `quant-btc-valuation-system` SHALL calculate `terminal_price_ratio` as a dimensionless percentage deviation: `(close - terminal_price) / terminal_price`.

#### Scenario: Cycle bottom valuation
- **WHEN** Bitcoin price approaches or dips below Terminal Price
- **THEN** `terminal_price_ratio` maps to a positive valuation score (`+2.0`) without scale drift.
