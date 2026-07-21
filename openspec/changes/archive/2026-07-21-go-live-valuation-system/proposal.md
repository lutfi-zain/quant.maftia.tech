## Why

Transitioning the Valuation Studio from a historical research tool to a production-grade live investment system requires mitigating lookahead bias in composite rescaling, addressing extreme indicator redundancies (double-counting), and stabilizing transactional allocation whiplash. This proposal introduces causal expanding window rescaling, indicator redundancy filtering (or principal factor pruning), and a hysteresis-based finite state machine (FSM) filter to prepare the Valuation System for robust, low-noise live execution.

## What Changes

* **Causal Expanding Rescaling**: Shift composite score rescaling from global parameter fitting (which leaks future data points into historical values) to a strictly causal, expanding window percentile lookup using data up to $t-1$.
* **Indicator Redundancy Pruning**: Modify the composite score calculation to group and prune highly correlated indicator clusters (correlation $|r| > 0.85$ like MVRV-Z vs AVIV), ensuring cost-basis indicators do not distort the composite's signal diversity.
* **Hysteresis Banding in FSM**: Update the Systematic DCA (SDCA) FSM allocation engine (`sdca/engine.py`) to implement a transition buffer (hysteresis), preventing rapid state whiplash and excessive transactional friction near threshold boundaries.
* **Non-goals**:
  * No modification to LTTD, MTTD, or Ichimoku core forecasting logic.
  * No removal of underlying raw indicators or their baseline ingestion pipelines.
  * No re-introduction of the deprecated `quant-technical-indicator-bank`.

## Capabilities

### New Capabilities
* `causal-expanding-rescaling`: Strictly causal expanding window percentile fitting for scaling composites without lookahead bias.
* `signal-redundancy-filtering`: Clustering and pruning/weighting of highly correlated indicators.
* `hysteresis-allocation-gate`: Multiplier state stabilization via transition banding in the SDCA allocation FSM.

### Modified Capabilities
* `sdca-strategy-engine`: Incorporate hysteresis filters and causality updates into the strategy FSM.

## Impact

* **Affected Systems**: Valuation System (`quant-btc-valuation-system` under `engines/valuation/`).
* **Affected Code**: `run_report_pipeline.py`, `normalization.py`, `sdca/engine.py`, `sdca/backtest.py`, `audit/composite.py`, and `audit/runner.py`.
* **Causality Guard**: All indicators, scaling parameters, and trend signals MUST be evaluated using strictly causal $t-1$ metrics.
