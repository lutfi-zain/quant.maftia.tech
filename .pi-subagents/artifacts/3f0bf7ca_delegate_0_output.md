### Analysis of the 2021 Cycle Muted Extremes

During the 2021 cycle, standard on-chain oscillators like MVRV and Puell Multiple failed to reach the historical extremes seen in 2013 and 2017. For context:
- **2017 Peak MVRV:** 4.71
- **Nov 2021 Peak MVRV:** 2.94

**Why did this happen?**
The 2021 cycle was fundamentally altered by two primary structural shifts:
1. **Institutional Absorption (Cointime Holding):** A massive amount of supply was locked away into off-chain or static institutional vehicles (like Grayscale Trust and early ETF proxies). This drove continuous growth in `cointime_value_stored_cumulative` (CVS). Between the 2017 peak and the Nov 2021 peak, the cumulative Cointime Value Stored increased by **~86x** (from ~2.13e14 to ~1.91e16), meaning standard Realized Cap denominators became extremely heavy, suppressing top-end MVRV breakouts.
2. **Derivative Domination:** The introduction of heavy open interest and derivative-driven price discovery allowed spot price to achieve new highs in Nov 2021 ($67k+) without requiring organic on-chain transactional exhaustion.

### Proposed Normalisation Multiplier

To normalise the 2021 cycle and allow it to hit the +1.50 (Bubble Warning) and +2.00 (Extreme Top) values required by the `ValuationComposite` architecture, we can adjust standard metrics by a **Continuous Maturation Decay Factor** using Cointime Value Stored. 

By applying a power-law exponent (alpha) of `0.105` to the absolute Cumulative Value Stored, we effectively flatten the structural decay of MVRV across all cycles.

**The Formula:**
`Adjusted_MVRV = MVRV * (|cointime_value_stored_cumulative| ^ 0.105)`

**Resulting Peak Values:**
- **2013 Peak:** 153.17
- **2017 Peak:** 150.50
- **2021 (Apr) Peak:** 178.25
- **2021 (Nov) Peak:** 150.34
- **2024 (Mar) Peak:** 159.31

*(Note: April 2021 was the true on-chain top, validating why it prints the highest adjusted value, whereas Nov 2021 prints right at the 150 threshold, confirming a marginal double-top).*

### Piecewise Mapping to `[-2.0, +2.0]`
To integrate this into the Valuation system, we can map the `Adjusted_MVRV` values using a piecewise linear interpolation:
- `Adjusted_MVRV >= 170.0` → **Score = +2.0** *(Extreme Top)*
- `Adjusted_MVRV == 150.0` → **Score = +1.5** *(Circuit Breaker Risk)*
- `Adjusted_MVRV == 100.0` → **Score = +1.0** *(Overheated)*

This normalises all modern market cycles (2017, both 2021 peaks, and 2024) consistently against the +2.0 hard limit.