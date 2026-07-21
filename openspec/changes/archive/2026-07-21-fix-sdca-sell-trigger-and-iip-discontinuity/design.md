## Context

The `ValuationComposite` score is adjusted by an Institutional Illiquidity Premium (IIP) penalty to correctly flag overvaluation in highly illiquid market regimes. This penalty is calculated in `run_report_pipeline.py` and is currently applied as a flat subtraction offset to the raw composite average (`raw_val`) if `raw_val < 0`:

```python
if raw_val < 0:
    raw_val = raw_val * multiplier - iip_penalty_val
```

Because `iip_penalty_val` can be large (e.g., > 4.0), this flat subtraction creates a major step-function discontinuity. A raw value of `-0.001` drops instantly to `-2.0000` (slammed by the clamp), while `+0.001` remains unmodified.

This cliff-discontinuity directly causes the SDCA strategy engine to trigger false exits. The `SELL_ALL` and `SELL_DCA` exit triggers in the FSM (`engine.py` in Python and `sdcaEngine.ts` in TypeScript) transition to exit states when `valuation_composite` is <= -1.5 (bubble) or <= -1.0 (expensive). Because of the IIP cliff, a minor fluctuation around 0.0 forces the composite to `-2.0`, immediately meeting the overvaluation criteria.

Additionally, `SELL_ALL` uses `drawdown_t1 >= 20.0` relative to the lifetime historical ATH. During a new cycle's recovery phase (e.g., late 2023 when price is climbing from $15,000 to $43,000, while the historical ATH was $69,000), the drawdown is naturally large (> 35%). When the composite drops to `-2.0` due to the IIP cliff, the system triggers `SELL_ALL` even though the price is actively rising.

## Goals / Non-Goals

**Goals:**

- Eliminate the cliff discontinuity at `raw_val = 0` by scaling the IIP penalty proportionally with the magnitude of the overvalued score: `penalty_term = iip_penalty_val * abs(raw_val)`.
- Patch the `SELL_ALL` and `SELL_DCA` FSM exit logic to verify that the short-term price trend is not positive (momentum decline) before executing an exit.
- Ensure exact parity between the Python engine (`engine.py` / `calculate_sdca_backtest.py`) and the TypeScript API/Backtest engine (`sdcaEngine.ts` / `sdcaBacktest.ts`).

**Non-Goals:**

- Altering the individual component threshold parameters.
- Changing LTTD, MTTD, or Ichimoku strategies.

## Decisions

### Decision 1: Proportional scaling for IIP penalty

- **Chosen:** Scale the IIP penalty by the absolute value of the raw composite: `raw_val = raw_val * multiplier - (iip_penalty_val * abs(raw_val))` when `raw_val < 0`.
- **Alternative considered:** Apply a threshold gate (e.g. only apply IIP if `raw_val < -0.3`). Rejected because it still creates a minor discontinuity at the threshold boundary.
- **Rationale:** Proportional scaling guarantees that as `raw_val` approaches `0.0` (fair value), the penalty naturally approaches `0.0`, creating a smooth, differentiable transition curve.

### Decision 2: Add short-term price trend confirmation to exits

- **Chosen:** Define the short-term trend gate using a 30-day moving average crossover. An exit is only triggered if the current price is NOT above its 30-day simple moving average (SMA) or has a non-positive short-term trend:
  - Python FSM: `price_t1 < sma30_t1` (price is below/not above its 30-day SMA).
  - TypeScript FSM: implement a causal 30-day rolling price average check.
- **Alternative considered:** Use the 200-day ratio (`ratio_t1 < 1.0`). Rejected because the 200-day ratio is too slow and remains > 1.0 during intermediate pullbacks of a bull run.
- **Rationale:** A 30-day SMA is a standard medium-term momentum tracker. If the price is above its 30-day SMA, it is climbing strongly, so exiting all positions is premature. Exiting is deferred until price drops below the 30-day SMA, confirming a rollover.

## Risks / Trade-offs

- **[Risk]** The 30-day SMA check might delay exit signal timing during a very fast vertical collapse.
  - **Mitigation:** The FSM already contains a `SELL_DCA` phase that scales out gradually, reducing exposure before the final `SELL_ALL` fires. The 30-day SMA check only prevents *early* liquidations during strong upward momentum.
- **[Risk]** Mismatch between Python backtest and TypeScript API.
  - **Mitigation:** Both engines must be updated with identical mathematical logic and verified to produce matching signals.
