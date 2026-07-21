## Why

Exploratory Data Analysis (EDA) of the valuation composite scores and historical price returns demonstrates that the current SDCA/FSM strategy thresholds are sub-optimal. Under the sign convention of the database (where positive composite scores represent undervalued bottom zones and negative scores represent overvalued top zones), we need to recalibrate thresholds. Optimizing these thresholds improves the win-rate, reduces maximum drawdowns, and aligns the allocation FSM with historical statistical realities.

## What Changes

* **Recalibrate Accumulation Threshold (Start DCA)**: Modify the FSM buying state trigger to active at `valuation_composite >= 1.0` (where historical 365-day win-rate is 76.8% and average return is +102.6%).
* **Recalibrate All-In Threshold (Buy All)**: Set the FSM aggressive breakout buy trigger to `valuation_composite >= 1.8` (where historical 365-day win-rate reaches 94.5%–97.2%).
* **Recalibrate Distribution Exit Threshold (Sell All)**: Set the FSM exit trigger to `valuation_composite <= -1.0` (where the overvalued cycle peak starts and 365-day future returns decay sharply).
* **Recalibrate Partial Exit Threshold (Reduce Position)**: Set the FSM partial weekly sell trigger to `valuation_composite <= -0.5`.
* **Non-goals**:
  * No modification to causal filters or volatility threshold logic.
  * No modification to trend-following systems (LTTD/MTTD/Ichimoku).

## Capabilities

### New Capabilities
* `optimized-threshold-allocation`: Set optimal statistical bounds on SDCA FSM strategy execution.

### Modified Capabilities
* `sdca-strategy-engine`: Recalibrate the FSM logic bounds and triggers using the optimized threshold values.

## Impact

* **Affected Systems**: Valuation System (`quant-btc-valuation-system` under `engines/valuation/`).
* **Affected Code**: `engines/valuation/quant/sdca/engine.py` and `run_report_pipeline.py`.
* **Verification**: Verify that the backtest performance metrics (CAGR, Sharpe, Max Drawdown) show improved or stable risk-adjusted performance.
