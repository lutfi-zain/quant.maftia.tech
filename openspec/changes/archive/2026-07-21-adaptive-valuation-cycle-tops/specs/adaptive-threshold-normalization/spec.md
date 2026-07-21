## ADDED Requirements

### Requirement: Volatility-Adjusted Indicator Normalization
The `quant-btc-valuation-system` SHALL adjust the normalization thresholds ($t_{-1}$ and $t_{-2}$ overvalued bounds) for fundamental on-chain indicators (`mvrv_z`, `aviv_ratio`, and `aviv_nupl`) dynamically based on rolling 1-year (365-day) annualized price volatility relative to a historical volatility anchor (80.0%). The volatility adjustment ratio SHALL be clamped within `[0.4, 1.5]` to prevent extreme threshold degradation. All calculations MUST be causal (using price data up to $t-1$).

#### Scenario: Volatility scaling of MVRV-Z thresholds
- **WHEN** the valuation pipeline executes for timestamp $t$ and rolling 1-year volatility is 43.8%
- **THEN** it scales the overvalued thresholds by a ratio of $0.438 / 0.80 = 0.5475$, mapping static thresholds $t_{-1} = 4.60$ and $t_{-2} = 6.65$ to dynamic thresholds $t_{-1} = 2.52$ and $t_{-2} = 3.64$, and normalizes the raw indicator value against these adjusted bounds.
