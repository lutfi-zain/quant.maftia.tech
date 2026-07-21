## Why

During the early stages of a new market cycle, the SDCA (Strategic Dollar Cost Averaging) engine can trigger premature `SELL_ALL` actions (such as on 2023-12-06 at $43,762.69) even as the price is actively rising. This is caused by two compounding issues:

1. **The IIP Penalty Cliff Discontinuity**: The Institutional Illiquidity Premium (IIP) penalty is subtracted as a flat offset (often > 4.0) from the `ValuationComposite` score whenever the raw average is slightly below zero (`raw_val < 0`), causing a massive discontinuity where a change of `0.002` around neutral drops the final score instantly from `0.0` to `-2.0` (maximum overvalued).
2. **Unconditional Drawdown Gate**: The `SELL_ALL` trigger relies on `drawdown_t1 >= 20.0` relative to the *lifetime* historical ATH. During a new cycle recovery phase, the drawdown is naturally large (> 20%), which triggers a false exit when combined with the IIP-distorted score, even if price momentum is positive and climbing.

## What Changes

- Modify `run_report_pipeline.py` to calculate the IIP penalty as a proportional factor scaled by the magnitude of the overvalued score: `penalty_term = iip_penalty_val * abs(raw_val)`. This guarantees a smooth, continuous transition without a step-function cliff at `0.0`.
- Update the FSM `SELL_ALL` and `SELL_DCA` logic in `engines/valuation/quant/sdca/engine.py` (Python) and `src/lib/sdcaEngine.ts` (TypeScript) to require that the short-term price trend is not positive (e.g. check that the price is not above its 30-day moving average or has negative momentum) before executing a complete exit, ensuring we do not sell during strong upward price breakouts.
- Enforce strict $t-1$ causal filtering on the new trend gates to avoid lookahead bias.

## Non-goals

- Altering the raw underlying 17 indicator calculations.
- Changing LTTD, MTTD, or Ichimoku engine logic.
- Interacting with the deprecated `quant-technical-indicator-bank`.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities

- `sdca-strategy-engine`: Recalibrate the FSM exit conditions to require short-term price trend confirmation (non-positive momentum) before triggering `SELL_ALL` or `SELL_DCA` exits.
- `volatility-regime-multiplier`: Modify the IIP penalty integration to scale proportionally with `abs(raw_val)` to eliminate the step-discontinuity at neutral composite values.

## Impact

- **Valuation System (`engines/valuation/quant/sdca/engine.py`)**: SDCA exit triggers modified.
- **Orchestration & Data Sync Pipeline (`run_report_pipeline.py`)**: IIP penalty scaling patched.
- **API Gateway & Backtest (`src/lib/sdcaEngine.ts` & `src/lib/sdcaBacktest.ts`)**: Parity updates to match FSM trend logic and IIP scaling.
- **Database (`maftia_quant.db`)**: Corrected historical FSM signals will be persisted.
