## Context

See `proposal.md` for background.

Currently, `DailyRecord` in `engines/valuation/quant/sdca/engine.py` only passes `price_ma200_ratio` and `ath_drawdown`. The `BUY_ALL` trigger in `engine.py:246` uses `cross_above_ma200 = ratio_t2 < 1.0 and ratio_t1 >= 1.0`.

## Goals / Non-Goals

**Goals:**
- Enrich `DailyRecord` across Python and TypeScript SDCA engines to include `lttd_regime`, `lttd_prob_bull`, and `mttd_er`.
- Replace `cross_above_ma200` in the `BUY_ALL` condition with `(lttd_prob_bull >= 0.60 or lttd_regime == 'BULL') and mttd_er >= 0.20`.
- Maintain $t-1$ strict causal filtering on all input features.

**Non-Goals:**
- No changes to Gaussian HMM training parameters or Ehlers SuperSmoother constants.

## Decisions

### Decision 1: Extend `DailyRecord` Schema
Update `DailyRecord` in Python and TypeScript:
```python
class DailyRecord:
    def __init__(self, date: str, close: float, valuation_composite: float = 0.0, 
                 lttd_regime: str = "SIDEWAYS", lttd_prob_bull: float = 0.0, 
                 mttd_er: float = 0.0, price_ma200_ratio: float = 1.0, ath_drawdown: float = 0.0):
        ...
```

### Decision 2: Update BUY_ALL Confluence Condition
```python
# BUY_ALL Condition (Breakout bottom confirmed by LTTD Bull + MTTD ER Gate)
is_regime_bull = (lttd_prob_bull_t1 >= 0.60) or (lttd_regime_t1 == "BULL")
is_er_confirmed = mttd_er_t1 >= 0.20
if comp_t1 >= t["buy_all"] and is_regime_bull and is_er_confirmed and not buy_all_fired:
    state = "BUY_ALL"
```

## Risks / Trade-offs

- **Cold-Start Data**: For early historical dates where LTTD HMM or MTTD ER may not have 30 days of data, fallback to gradual `BUY_DCA` instead of failing.
