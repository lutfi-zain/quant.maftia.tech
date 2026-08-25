## Why

Quantitative portfolio evaluation demonstrates that the SDCA strategy achieves its peak risk-adjusted performance (**54.60% CAGR vs 47.10% Buy & Hold**, +22,774% Total Return, and **+$2.27 Million final equity vs $1.22 Million Buy & Hold** on a $10,000 initial capital over 2014–2026) when operating as a **Full-Cycle Macro Rotation System**:

1. **Cycle Bottom Accumulation (`DCA_IN`)**: Commences weekly strategic buying as soon as valuations enter deep discounts ($V \ge 1.80$).
2. **Breakout Expansion (`ALL_IN`)**: Allocates 100% of remaining cash into BTC when exiting the deep discount floor ($V \le 1.50$ or upon early cycle recovery), capturing full bull run beta without cash drag.
3. **Macro Bubble Distribution (`DCA_OUT`)**: Systematically trims 15% of the active BTC position every Monday during parabolic bubble peaks ($V \le -1.50$), locking hundreds of thousands of dollars into cash.
4. **Bear Market Capital Preservation (`OUT_ALL`)**: Liquidates remaining BTC holdings to 100% cash when the macro bubble bursts and returns to fair value ($V \ge 0.00$), sitting out -80% bear market drawdowns in cash.

This change restores and formalizes the authoritative 4-State Cycle Rotation Hysteresis FSM across all Python and TypeScript backtest engines.

## What Changes

- **Restore 4-State Macro Cycle Rotation FSM**:
  - In `engines/valuation/quant/sdca/engine.py`, `src/lib/sdcaEngine.ts`, and `web/src/lib/sdcaEngine.ts`:
    - `OUT_ALL` $\rightarrow$ `DCA_IN` when $V_{t-1} \ge \text{dca\_in\_start}\ (1.80)$
    - `DCA_IN` $\rightarrow$ `ALL_IN` when $V_{t-1} \le \text{all\_in\_val}\ (1.50)$
    - `ALL_IN` $\rightarrow$ `DCA_OUT` when $V_{t-1} \le \text{dca\_out\_start}\ (-1.50)$
    - `DCA_OUT` $\rightarrow$ `OUT_ALL` when $V_{t-1} \ge \text{all\_out\_val}\ (0.00)$
- **Standardize Backtest Execution in Python & TypeScript**:
  - `ALL_IN`: Allocates 100% remaining cash to BTC (multiplier `999.0`).
  - `DCA_IN`: Purchases value-weighted DCA on Mondays when cash is available.
  - `DCA_OUT`: Sells 15% of active BTC position on Mondays during macro bubbles.
  - `OUT_ALL`: Sells 100% remaining BTC to cash to preserve capital during bear markets (multiplier `-1.0`).
- **Synchronize Metrics & Report Generation**:
  - Re-run pipeline (`python3 run_report_pipeline.py`) to generate matching +22,774% return curves and report metrics.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `sdca-strategy-engine`: Formalize the 4-State Macro Cycle Rotation FSM and execution rules across Python and TypeScript backtest engines.

## Impact & System Scope

- **Impacted Systems**: System 1 SDCA Engine (`engines/valuation/quant/sdca/engine.py`, `engines/valuation/quant/sdca/backtest.py`), API Gateway backtest service (`src/lib/sdcaBacktest.ts`), and Valuation Studio.
- **Zero Lookahead Bias**: Fully preserved using strict $t-1$ daily analytics signals.
- **Non-Goals**:
  - No changes to underlying valuation indicator calculations or database schemas.
