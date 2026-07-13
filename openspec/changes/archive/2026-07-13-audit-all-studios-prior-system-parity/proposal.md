## Why

To guarantee complete trust and auditability across all 4 quantitative defense studios (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, and `Ichimoku Terminal`), every performance metric (`Win Rate`, `Profit Factor`, `Total Trades`, `Sharpe Ratio`, `Annualized Return/Volatility`, `Max Drawdown`, `Total Return`), trade execution history (`trades` log), equity curves (`stratEquity` and `marketEquity`), and interactive frontend What-If/sub-component visualization features must match $1:1$ strictly with each prior reference backtest and feature specification across `../quant-btc-valuation-system`, `../quant-btc-lttd-system`, `../quant-btc-mttd-system`, and `../quant-lttd-ichimoku`. Achieving $1:1$ parity across every single studio and feature eliminates drift between backtest research engines and the institutional frontend terminal.

## What Changes

- **1:1 Metric & Equity Parity Verification across All 4 Studios**: Verify and enforce exact $1:1$ parity ($|a-b| < 10^{-6}$) between frontend studio calculations (`ValuationStudio.tsx`, `LttdLab.tsx`, `MttdConsole.tsx`, `IchimokuTerminal.tsx`) and prior system engines across all historical windows and default window spans (`2018-01-01` to `NOW()`).
- **Exact Trade Log Verification**: Ensure every trade entry/exit date, execution price, and return percentage (`returnPct`) logged in the frontend `trades` table perfectly mirrors the canonical prior system backtest trade execution logs with zero lookahead bias (strictly causal $T-1$ position enforcement where $Active\_Pos[t] = Pos[t-1]$).
- **Comprehensive FE Feature Audit & Parity**: Audit and align all interactive studio features against each prior system's feature set:
  - **Valuation Studio**: 9-card institutional metric grid, causal position extraction (`valuation_composite >= 1.50` vs `<= -1.00`), interactive component weighting/threshold simulation, and synchronized 85px Y-axis locked multi-pane charts.
  - **LTTD Lab**: 9-card institutional metric grid, causal HMM regime shifting (`BULL` vs `SIDEWAYS` override with $P_{\text{Sideways}} > 0.60$), and synchronized HMM probability/volatility subplots.
  - **MTTD Console**: 9-card institutional metric grid, causal position extraction (`mttd_imo > 0.15` gated by `mttd_er >= 0.20` and `mttd_entropy <= 2.30`), and synchronized gate indicator subplots.
  - **Ichimoku Terminal**: 9-card institutional metric grid, causal reference vs strategy equity curve overlays (`ichi_cum_strat` vs `ichi_cum_market`), interactive What-If scenario overlays, lagging/leading momentum indicators, and synchronized 85px Y-axis locked multi-pane charts.
- **Automated Verification Harness Suite**: Maintain and execute comprehensive Python verification scripts (`verify_valuation_studio_metrics_1to1.py`, `verify_lttd_studio_metrics_1to1.py`, `verify_mttd_studio_metrics_1to1.py`, `verify_ichimoku_studio_metrics_1to1.py`) validating $100\%$ parity across all metrics and equity data points against `maftia_quant.db` and canonical engine outputs.

## Capabilities

### New Capabilities
- `studio-fe-features-and-metrics-parity`: Comprehensive capability enforcing $1:1$ performance metric parity, trade execution log parity, causal $T-1$ position shifting, 85px Y-axis width locking, vertical crosshair synchronization, and interactive FE feature parity across all 4 quantitative defense studios against their prior canonical engines under `/home/ubuntu/projects/quant*`.

### Modified Capabilities
- `ichimoku-chart-rebuild`: Enforcing $1:1$ metric parity, trade execution parity, lagging/leading momentum visualization, and interactive What-If feature parity against prior system `../quant-lttd-ichimoku`.
- `pipeline-metrics-parity-verification`: Extending $1:1$ metric verification assertions across all 4 defense systems and their frontend studio representations.

## Impact

- **Affected Systems**: All 4 quantitative defense studios (`ValuationStudio.tsx`, `LttdLab.tsx`, `MttdConsole.tsx`, `IchimokuTerminal.tsx`) and the shared simulation library (`studioBacktest.ts`).
- **Verification Harnesses**: Python verification scripts (`verify_*_studio_metrics_1to1.py` and `verify_pipeline_api_parity.py`).
- **Database & API**: `maftia_quant.db` and Hono/Bun API Gateway (`:8765`).

## Non-goals

- Out of scope: Any modification or re-introduction of the deprecated `quant-technical-indicator-bank` (`05. Indicator Bank`).
- Out of scope: Modifying core underlying exchange ingestion sources or altering fundamental historical BTC price feeds from BitView/Checkonchain.
