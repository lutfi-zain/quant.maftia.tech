## Why

While `IchimokuTerminal.tsx` (`Ichimoku Studio`) displays comprehensive performance summary cards (Win Rate, Profit Factor, Total Trades, Sharpe Ratio, Annualized Return, Annualized Volatility, Max Drawdown, Total Return) alongside 4 synchronized subplots (`btcChart`, `imoChart`, `scompChart`, `eqChart`) and a granular trade execution log, every single displayed metric value must be strictly audited to guarantee 100% mathematical and visual 1:1 parity with the authoritative Python system (`@../quant-lttd-ichimoku/`). Even minor rounding differences, date boundary mismatches, or return aggregation discrepancies in `studioBacktest.ts` versus `backtest.py` (`src/ichimoku_quant/backtest.py`) would undermine institutional confidence in the financial terminal.

## What Changes

- **Audited Performance Metrics Engine (`studioBacktest.ts`)**: Audit and align every formula in `studioBacktest.ts` against `run_backtest()` in `quant-lttd-ichimoku/src/ichimoku_quant/backtest.py` so that Win Rate, Profit Factor, Total Trades, Sharpe Ratio, Annualized Return, Annualized Volatility, Max Drawdown, and Total Return match exactly ($1:1$) across both Strategy and BTC Hold reference curves.
- **Audited Subplot & Indicator Series Values (`IchimokuTerminal.tsx`)**: Ensure all time series arrays (candlesticks, Tenkan/Kijun/Span A/Span B/Chikou lines, S-components `S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`, momentum oscillator `ichimoku_imo`, Shannon Entropy, Efficiency Ratio, and `0.40*IMO_Std`) are directly sourced from API/DB without synthetic manipulation or rounding drift, matching the prior system 1:1 for every bar in the selected window (`2018-01-01` to `NOW()`).
- **Audited Trade Execution Log Parity**: Verify that the generated trade log array in `studioBacktest.ts` (Entry Date, Exit Date, Entry Price, Exit Price, Return %, and active causal $t-1$ position) mirrors the exact trade history produced by `backtest.py`.
- **Automated Verification Suite Expansion**: Extend `verify_pipeline_api_parity.py` and create dedicated automated tests asserting zero tolerance ($|a - b| < 10^{-6}$ or exact string match) between the frontend metric calculations and the Python canonical output across the full dataset.

## Capabilities

### New Capabilities
- `ichimoku-studio-metrics-audit`: Automated and visual audit framework enforcing 1:1 numerical and visual parity between all Ichimoku Studio performance cards, subplots, and trade tables and the original `quant-lttd-ichimoku` system.

### Modified Capabilities
- `ichimoku-chart-rebuild`: Require strict 1:1 mathematical parity for every displayed metric card, S-component curve, and reference equity line against `quant-lttd-ichimoku`.
- `pipeline-metrics-parity-verification`: Expand verification harness to validate exact 1:1 parity for all 11 summary performance card metrics and individual trade log entries.

## Impact

- **System 4 (`quant-lttd-ichimoku`)**: Acts as the immutable canonical benchmark for all verification checks (`backtest.py`).
- **Frontend Core (`studioBacktest.ts` & `IchimokuTerminal.tsx`)**: Modifies metric aggregation, fee calculation, annualized factor scaling (`365.25` days), and date filtering to guarantee 1:1 numerical identity.
- **Orchestration & Verification (`verify_pipeline_api_parity.py` & `run_report_pipeline.py`)**: Adds strict assertion checks comparing frontend-calculated values directly against Python `run_backtest()` outputs.

## Non-goals

- Modifying or altering the underlying mathematical formulas or Ehlers SuperSmoother IIR parameters inside `quant-lttd-ichimoku` (the goal is strictly to make the studio match the existing engine 1:1).
- Modifying `quant-btc-valuation-system`, `quant-btc-lttd-system`, or `quant-btc-mttd-system` unless required for cross-system database alignment.
- Re-introducing or referencing any deprecated system such as `quant-technical-indicator-bank`.
