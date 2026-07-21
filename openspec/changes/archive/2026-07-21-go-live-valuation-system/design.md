## Context

To transition the Valuation System to a production-ready live investing tool, this design implements three technical changes:
1. **Causal Expanding Rescaling**: Prevents lookahead bias by computing percentile parameters dynamically using expanding window statistics up to $t-1$.
2. **Correlation-Based Indicator Grouping**: Groups indicators with Pearson correlation $|r| > 0.85$ into single cluster nodes to prevent duplicate weight attribution to the same physical dimensions (e.g. cost-basis ratios).
3. **Hysteresis Transition Banding**: Mitigates state whiplash in the SDCA allocation FSM by introducing transition offsets.

## Goals / Non-Goals

**Goals:**
* Eliminate lookahead bias in historical valuation composite scores.
* Stabilize transaction costs by reducing SDCA state transitions under minor threshold noise.
* Diversify risk attribution across indicator classes.

**Non-Goals:**
* Modifying LTTD HMM, MTTD consensus gates, or Ichimoku SuperSmoother filters.
* Changing visual layouts or charts.

## Decisions

### Decision 1: Causal Rescaling Parameters
Instead of loading static globally-fitted percentiles from `audit_composite_params`, the rescaling parameters (`p2_5`, `p50`, `p97_5`) for day $t$ will be computed dynamically:
$$\text{p2\_5}_t = \text{Percentile}(C_{0..t-1}, 2.5)$$
$$\text{p50}_t = \text{Percentile}(C_{0..t-1}, 50.0)$$
$$\text{p97\_5}_t = \text{Percentile}(C_{0..t-1}, 97.5)$$
* *Rationale*: Guarantees that no future data leaks into the backtest or live daily run.
* *Alternative Considered*: Yearly parameter re-fitting. Rejected because it still introduces step-wise lookahead bias within each year.

### Decision 2: Pearson Cluster Consolidation
Group indicators where $|r| > 0.85$. Grouped clusters:
* **Cost-Basis Cluster**: `aviv_nupl`, `aviv_ratio`, `mvrv_z` (Pearson correlation $>0.90$).
* **Trend/MA Cluster**: `cvdd_ratio`, `two_year_ma`, `terminal_price_ratio`, `unrealized_sell_risk` (Pearson correlation $>0.87$).
* **Sentiment Cluster**: `fear_greed_cmc`, `fear_greed_og` (Pearson correlation $>0.91$).

Indicators within these clusters are averaged first to create a single cluster score, which is then averaged with all other independent indicators to calculate the final composite.
* *Rationale*: Mitigates correlation overload and signal noise.

### Decision 3: Transition Hysteresis Buffer in SDCA FSM
Modify `sdca/engine.py` to check the active FSM state. If in `SELL_DCA` (score was $\le -1.0$) or `BUY_DCA` (score was $\ge 1.0$), require the composite to cross $-0.8$ or $+0.8$ respectively before returning to `NEUTRAL`:
```python
if current_state == "SELL_DCA":
    if current_composite > -0.8:
        current_state = "NEUTRAL"
```
* *Rationale*: Dramatically stabilizes transaction frequency, reducing commission and slippage drag.

## Risks / Trade-offs

* **[Risk] Slower exit/entry response due to Hysteresis** $\rightarrow$ Delayed action at trend pivot.
  * *Mitigation*: Hysteresis offset is set to $0.2$, which is small enough to not delay major cycle moves while robustly smoothing minor variance.
* **[Risk] High computational cost of daily expanding percentiles** $\rightarrow$ Slower backtesting.
  * *Mitigation*: Implement cached cumulative percentiles or pandas expanding functions to optimize execution.
