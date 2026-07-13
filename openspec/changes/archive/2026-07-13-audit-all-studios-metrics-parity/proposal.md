## Why

While `IchimokuTerminal.tsx` (`quant-lttd-ichimoku`) now achieves strict $1:1$ mathematical parity with `backtest.py` across all 11 performance metric cards, trade execution logs (`trades` array), exact equity curves (`cumStrat` and `cumMarket`), and vertical crosshair synchronization with an exact $85\text{px}$ right Y-axis width lock, the remaining three deep-dive sandboxes (`ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx`) must be audited and standardized to guarantee the exact same level of mathematical rigor, causal position friction (`Position[t-1]`), exact trade execution tracking, and UI vertical chart alignment. This ensures a unified, zero-drift, professional-grade quantitative intelligence terminal across all 4 defense layers.

## What Changes

- **System-Wide Metric Formula Parity ($1:1$)**: Audit and update front-end simulation logic (`studioBacktest.ts` or studio-specific simulation engines) for `ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx` to enforce strict causal friction ($R_{\text{strat}, t} = R_{\text{market}, t} \times \text{Position}_{t-1}$), exact transaction cost deduction upon state transition, compound annualized returns ($E_N^{(365.25 / N)} - 1$), annualized volatility ($\sigma_{\text{daily}} \times \sqrt{365.25}$), Sharpe ratio ($0\%$ risk-free assumption), and peak-to-trough Max Drawdown matching canonical Python engines exactly ($|a - b| < 10^{-6}$).
- **Exact Trade Execution Logs (`trades`) across All Studios**: Audit and verify state transition tracking (`0 -> 1` and `1 -> 0` or multi-state allocations) so that every studio's trade history table accurately logs `entryDate`, `exitDate`, `entryPrice`, `exitPrice`, and `returnPct` with exact integer trade counts and win rates matching backend simulation outputs $1:1$.
- **Exact Equity Curves & Benchmark Comparisons**: Ensure each studio (`Valuation`, `LTTD`, and `MTTD`) accurately calculates and displays exact cumulative strategy returns (`cumStrat`) versus market buy-and-hold (`cumMarket`), plotting them on dedicated equity subplots without initial window distortion or re-basing drift.
- **Vertical Crosshair Synchronization & $85\text{px}$ Y-Axis Lock**: Enforce strict vertical crosshair alignment (`syncYAxisWidth(containerRef, [rightPriceScale, ...])`) across every chart subplot in `ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx`, locking the right price/oscillator Y-axis width strictly to $85\text{px}$ to prevent time-tick horizontal drift.
- **Automated $1:1$ Verification Harnesses**: Expand or create automated verification scripts (similar to `verify_ichimoku_studio_metrics_1to1.py` and `verify_pipeline_api_parity.py`) to validate $100\%$ identity across all 4 defense layers before any change is finalized.

## Capabilities

### New Capabilities
- `multi-studio-metrics-and-chart-parity`: Standardizes performance metric cards ($1:1$ causal parity with Python backend), exact trade execution logs (`trades` array), exact equity curves (`cumStrat` & `cumMarket`), vertical crosshair synchronization across all subplots, and exact $85\text{px}$ locked Y-axis width across ALL remaining deep-dive studio components (`ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx`).

### Modified Capabilities
- `executive-terminal-and-sandboxes`: Enforces that all four deep-dive studios (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) must display identical $1:1$ causal backtest metrics (`Win Rate`, `Profit Factor`, `Sharpe Ratio`, `Max Drawdown`, `Ann Return`, `Ann Volatility`), exact trade history logs (`trades` execution log), canonical reference equity curves (`cumStrat` vs `cumMarket`), and strictly synchronized crosshairs with $85\text{px}$ right Y-axis width locks.
- `pipeline-metrics-parity-verification`: Expands the automated parity verification framework (`verify_pipeline_api_parity.py` and dedicated studio verification harnesses) to assert exact $1:1$ mathematical identity ($|a - b| < 10^{-6}$) across all studio calculations (`Valuation`, `LTTD`, `MTTD`, and `Ichimoku`) against their canonical Python engines (`run_report_pipeline.py`).

## Impact

- **Affected Systems**: All 4 Unified Quantitative Defense Systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`).
- **Affected Code**:
  - Frontend studios: `web/src/components/studios/ValuationStudio.tsx`, `web/src/components/studios/LttdLab.tsx`, `web/src/components/studios/MttdConsole.tsx`, and shared simulation utilities (`web/src/lib/studioBacktest.ts`).
  - Backend integration & verification: `run_report_pipeline.py`, `verify_pipeline_api_parity.py`, and domain verification scripts (`verify_*_studio_metrics_1to1.py`).
- **Zero Lookahead Guarantee**: All strategy and equity calculations strictly maintain causal filtering at $t-1$ stamp verification without leaking future data.

## Non-goals

- Out of scope: Any modification or re-introduction of the deprecated `quant-technical-indicator-bank` (`05. Indicator Bank`).
- Out of scope: Changing canonical daily calculations inside `MasterOHLCV` (`master_ohlcv`) unless required to fix division-by-zero or timestamp alignment errors.
