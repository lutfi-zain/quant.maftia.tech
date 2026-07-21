## MODIFIED Requirements

### Requirement: Valuation Engine Score Output Standardization
The `quant-btc-valuation-system` SHALL compute and output a daily canonical piecewise linear interpolated score (`ValuationComposite` / `valuation_composite`) strictly bounded within the range `[-2.0, +2.0]`. The score computation MUST enforce zero lookahead bias by validating timestamp causality ($t-1$ stamp verification) against `MasterOHLCV` (`master_ohlcv`) records.
Furthermore, the calculation SHALL incorporate:
1. Volatility-adjusted indicator normalized scores (for `mvrv_z`, `aviv_ratio`, and `aviv_nupl`).
2. An Institutional Illiquidity Premium (IIP) Penalty calculated using a cumulative average (expanding window) of the Illiquidity Factor (defined as $\text{LTH\_Ratio} / (1 - \text{LTH\_Ratio})$) instead of a 1460-day rolling mean.
The IIP Penalty SHALL be subtracted from the raw composite score on the overvalued (negative) side to push it closer to the extreme bubble boundary of `-2.0` in high-illiquidity regimes.

#### Scenario: Valuation composite bounded calculation
- **WHEN** the daily valuation pipeline executes for timestamp $t$
- **THEN** it computes the 17-indicator piecewise linear interpolated composite score using strictly causal historical data up to timestamp $t-1$ and guarantees the final output is bounded within `[-2.0, +2.0]`

#### Scenario: 2025 top cycle extreme valuation composite detection
- **WHEN** the daily valuation pipeline runs for 2025-10-06 (where spot price peaked at $124,672.41)
- **THEN** the calculated `valuation_composite` registers as overvalued ($\le -1.0$) due to the subtraction of the cumulative IIP Penalty and volatility-adjusted metric inputs.
