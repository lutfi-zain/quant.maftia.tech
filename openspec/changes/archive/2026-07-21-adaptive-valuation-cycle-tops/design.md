## Context

The Valuation Studio calculates a daily `valuation_composite` as the average of 14-17 normalized indicators. These indicators are normalized using a piecewise linear function based on static thresholds stored in `metric_config`. During the October-November 2025 cycle top, the composite remained near neutral because:
1. Volatility dampening and institutional inflows compressed fundamental ratios (like MVRV-Z).
2. The rolling 4-year mean used for the Institutional Illiquidity Premium (IIP) Penalty caught up to the long-term holding ratio, neutralizing the premium penalty modifier.

This design introduces a two-pronged solution: a cumulative average baseline for the IIP Penalty calculation to preserve historical sensitivity, and volatility-adjusted normalization thresholds to dynamically scale target boundaries as the market matures.

## Goals / Non-Goals

**Goals:**
* Correctly adjust the valuation composite at the 2025 cycle top to register as overvalued ($\le -1.0$).
* Maintain backward-compatibility and parity with all historical peaks (2013, 2017, and 2021).
* Preserve zero lookahead bias by using strictly causal ($t-1$) data for volatility and cumulative averages.

**Non-Goals:**
* Changing the core classification models of LTTD, MTTD, or Ichimoku engines.
* Modifying chart rendering or adding new visual components.
* Modifying database schemas beyond normal parameters.

## Decisions

### Decision 1: Cumulative IIP Baseline Calculation
Instead of using a rolling 1460-day mean of the `Illiquidity_Factor`, the IIP Penalty will be calculated against an expanding cumulative window of the factor:
$$\text{Illiquidity\_Cum\_Mean}_t = \frac{1}{t} \sum_{i=1}^t \text{Illiquidity\_Factor}_i$$
$$\text{IIP\_Multiplier}_t = \frac{\text{Illiquidity\_Factor}_t}{\text{Illiquidity\_Cum\_Mean}_{t-1}}$$
$$\text{IIP\_Penalty}_t = \max(0, \text{IIP\_Multiplier}_t^2 - 1.0)$$

* **Rationale**: Using an expanding cumulative mean ensures that structural baseline shifts (such as the permanent holding regimes of ETFs/treasuries) do not wash out the penalty over a 4-year period.
* **Alternative Considered**: Fixed historical baseline of 2.08. Rejected because a fixed baseline is too sensitive and doesn't allow for long-term organic growth of the network's liquidity sink.

### Decision 2: Volatility-Adjusted Thresholds
We will introduce a dynamic volatility-adjusted threshold scaling function inside `normalization.py`:
$$\text{Vol\_Ratio}_t = \text{clamp}\left(\frac{\sigma_{\text{1Y, } t-1}}{0.80}, 0.4, 1.5\right)$$
$$\text{t\_minus\_1}_{\text{adj}} = \text{t\_minus\_1}_{\text{static}} \times \text{Vol\_Ratio}_t$$
$$\text{t\_minus\_2}_{\text{adj}} = \text{t\_minus\_2}_{\text{static}} \times \text{Vol\_Ratio}_t$$

Here, $\sigma_{\text{1Y, } t-1}$ represents the rolling 1-year annualized volatility calculated using price returns up to day $t-1$, and $0.80$ is the baseline historic cycle top volatility. This scaling is only applied to the overvalued ($t_{-1}$ and $t_{-2}$) thresholds for fundamental indicators (`mvrv_z`, `aviv_ratio`, and `aviv_nupl`).
* **Rationale**: Assets maturing over time undergo structural volatility dampening. Scaling thresholds down in lower volatility regimes allows smaller deviations to be correctly identified as extreme.
* **Alternative Considered**: Re-fitting thresholds on every cycle. Rejected due to high lookahead bias risk and lack of causal execution capability.

### Decision 3: Integration into Pipeline and Reporting
These changes will be integrated directly into `normalization.py`, `run_report_pipeline.py`, and the statistical audit fitting scripts. 
* **Rationale**: Ensures that both the daily reporting scripts, backtests, and frontend endpoints reflect the updated model.

## Risks / Trade-offs

* **[Risk] High Sensitivity in Low-Vol Regimes** $\rightarrow$ Scaling thresholds down might trigger overvaluation warnings prematurely during periods of low-volatility accumulation.
  * *Mitigation*: The adjustment multiplier is clamped to a minimum of `0.4` to prevent thresholds from collapsing too far, and is restricted only to fundamental on-chain ratios (`mvrv_z`, `aviv_ratio`, `aviv_nupl`).
* **[Risk] Sync Inconsistencies** $\rightarrow$ Differences in how volatility is computed between components could lead to score discrepancies.
  * *Mitigation*: Define a centralized helper function for computing rolling 1Y volatility in `normalization.py` or a shared utility.
