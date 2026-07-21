## Context

Based on statistical Exploratory Data Analysis (EDA) of the historical valuation composite and price dataset (4517 daily rows), the optimal thresholds to maximize win rate and reduce drawdown are:
1. Buy DCA Accumulation starts at `valuation_composite >= 1.0` (76.8% 365-day win-rate).
2. Buy All (All-In) triggers at `valuation_composite >= 1.8` (94.5%–97.2% 365-day win-rate).
3. Sell DCA starts at `valuation_composite <= -0.5` (sharp reduction in future holding returns).
4. Sell All triggers at `valuation_composite <= -1.0` (cycle peak bubble).

This design applies these optimal bounds inside `sdca/engine.py` and updates the backtests.

## Goals / Non-Goals

**Goals:**
* Align the SDCA strategy engine with the optimal statistical bounds discovered in EDA.
* Maintain parity and check all historical tops and bottoms.

**Non-Goals:**
* Modifying indicators calculation or rescaling percentiles.

## Decisions

### Decision 1: Recalibrate Buying and Selling Triggers
Modify the conditional logic in `sdca/engine.py` to use:
* Buy state `BUY_DCA` / `BUY_ALL`: `comp_t1 >= 1.0` / `comp_t1 >= 1.8`
* Sell state `SELL_DCA` / `SELL_ALL`: `comp_t1 <= -0.5` / `comp_t1 <= -1.0`
* Hysteresis buffers are adjusted accordingly:
  * For buying states (entered at `1.0`), exit when composite falls below `0.8`.
  * For selling states (entered at `-0.5`), exit when composite rises above `-0.3`.

## Risks / Trade-offs

* **[Risk] Slower trigger frequency** $\rightarrow$ Fewer trading opportunities.
  * *Mitigation*: The win-rate increases dramatically (to >94% for Buy All), ensuring higher quality trades.
