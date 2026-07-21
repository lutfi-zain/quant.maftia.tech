## Why

Bitcoin cycle tops are structurally evolving due to institutional adoption (ETFs, corporate treasuries, nation-states) and volatility dampening. The October-November 2025 top cycle (peaking at $124,672.41) failed to register as extreme in the Valuation System because the traditional rolling 4-year mean for the Institutional Illiquidity Premium (IIP) Penalty adapted to high illiquidity as the new normal, while static indicator thresholds (like MVRV-Z) failed to adjust to volatility dampening and rapid realized price appreciation. 

This change introduces adaptive, volatility-adjusted normalization thresholds and a cumulative IIP baseline to restore the Valuation System's sensitivity to structural cycle peaks without introducing lookahead bias.

## What Changes

* **Cumulative IIP Baseline (Regime-Lag Prevention)**: Modify the Institutional Illiquidity Premium (IIP) calculation to use a cumulative average (expanding window) of the Illiquidity Factor instead of a 1460-day (4-year) rolling mean, preventing the baseline from rising to meet permanent institutional holding shifts.
* **Volatility-Adjusted Thresholds (Dynamic Calibration)**: Implement dynamic normalization thresholds for fundamental indicators (MVRV-Z, AVIV Ratio, and AVIV NUPL) in the Valuation Studio. These thresholds scale based on rolling 1-year annualized volatility relative to a historical baseline (80.0%).
* **Verification & Audit Alignment**: Update the quantitative statistical audit runner (`quant/audit/runner.py` and `quant/audit/composite.py`) to incorporate the dynamic thresholds and cumulative IIP modifiers, ensuring correct parameter fitting and validation.
* **Non-goals**:
  * No modification to LTTD, MTTD, or Ichimoku system core logic (only Valuation is affected).
  * No removal of existing historic peaks or changes to historical raw datasets.
  * No re-introduction of the deprecated `quant-technical-indicator-bank`.

## Capabilities

### New Capabilities
* `adaptive-threshold-normalization`: Dynamic calibration of normalization bounds for fundamental indicators based on market volatility and structural illiquidity shifts.

### Modified Capabilities
* `quant-engines-unification`: Update the requirement for compiling and scaling the `valuation_composite` to incorporate cumulative IIP Penalty adjustments and volatility-adjusted indicator inputs.

## Impact

* **Affected Systems**: Valuation System (`quant-btc-valuation-system` under `engines/valuation/`).
* **Affected Code**: `normalization.py`, `run_peaks_analysis.py`, `run_regime_analysis.py`, `run_report_pipeline.py`, `audit/composite.py`, and `audit/runner.py`.
* **Lookahead Bias Guard**: All calculations (rolling volatility, cumulative mean, and indicators) will be calculated causally using $t-1$ historical data, preserving strict causal filtering.
