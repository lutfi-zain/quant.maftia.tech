## Context

See `proposal.md` for background.

Currently, `scripts/calculate_sdca_backtest.py` contains legacy standalone backtest code that diverges from `engines/valuation/quant/sdca/backtest.py` and `src/lib/sdcaBacktest.ts`. Specifically, it was injecting `$100` daily into cash, causing equity normalization to measure cashflow savings instead of portfolio strategy return.

## Goals / Non-Goals

**Goals:**
- Refactor `scripts/calculate_sdca_backtest.py` to invoke `engines/valuation/quant/sdca/backtest.py:compute_sdca_backtest()` directly.
- Ensure the JSON output schema (`metrics`, `equity_curve`, `trade_log`, `signals`) is 100% structurally identical between Python and TypeScript implementations.
- Add an automated 1-to-1 parity audit test (`verify_sdca_metrics_1to1.py`) that compares Python vs TypeScript backtest outputs.

**Non-Goals:**
- No changes to UI visualization components.

## Decisions

### Decision 1: Python Script Refactor
In `scripts/calculate_sdca_backtest.py`, load `DailyRecord` list from `maftia_quant.db` and call:
```python
from engines.valuation.quant.sdca.backtest import compute_sdca_backtest

result = compute_sdca_backtest(records, {
    "fee_bps": 10,
    "base_dca_amount": 100.0,
    "initial_cash": 10000.0,
    "thresholds": DEFAULT_SDCA_THRESHOLDS
})
```
Save `result` directly to `data/sdca_backtest.json`.

### Decision 2: Automated Parity Test
Ensure `verify_sdca_metrics_1to1.py` executes and confirms that total return, CAGR, Sharpe ratio, and trade counts match between Python and TS.

## Risks / Trade-offs

- **Static Report Numbers Update**: `latest_week_scores_report.md` will display the updated, mathematically rigorous rotation metrics instead of the old cash-injection numbers.
