## MODIFIED Requirements

### Requirement: Specialized Studio Deep-Dive Telemetry

Each of the 4 quantitative studios (`Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) SHALL provide dedicated telemetry views querying `/api/v1/analytics/components` and `/api/v1/analytics/daily` to visualize underlying component metrics, exact performance metric summary cards (`Win Rate`, `Profit Factor`, `Total Trades`, `Sharpe Ratio`, `Max Drawdown`, `Ann Return`, `Ann Volatility`) verified $1:1$ against canonical Python engines, complete trade execution logs (`trades` table), exact strategy vs market equity curves (`cumStrat` & `cumMarket`), and vertically synchronized multi-pane subplots with locked $85\text{px}$ right Y-axis widths.

#### Scenario: Studio-specific component rendering

- **WHEN** a researcher selects a specific studio from the sidebar
- **THEN** that studio MUST render its domain-specific visualization, $1:1$ verified performance cards, trade execution history table, equity curves, and strictly synchronized $85\text{px}$-locked chart subplots:
  - `Valuation Pillar Studio`: 17-indicator piecewise breakdown matrix and score timeline, PLUS individual metric drill-down with 3-panel chart view (BTC OHLC + Raw Metric + Oscillator), inline threshold editor with save-to-backend, 90-day sparkline mini-charts in each matrix row, $1:1$ verified valuation backtest metrics, exact trade execution log, and PNG export capability
  - `LTTD Lab`: 3-state Gaussian HMM stacked probability bar chart (`P_Bull`, `P_Bear`, `P_Sideways`), Log Returns, 20-day Volatility, PCA/VIF pruning verification, $1:1$ verified LTTD regime strategy performance cards, exact trade execution history log (`BULL -> SIDEWAYS/BEAR` transitions), and exact equity curve comparison
  - `MTTD Console`: 10 Statistical Families consensus matrix (`Smoothing`, `Filtering`, `Regression`, `Spectral`, `Fractal`, `GARCH`, `Entropy`, `Chaos`, `Bayesian`, `ML-Hybrid`), ER/Entropy gate threshold charts, $1:1$ verified multi-principle consensus strategy performance cards, exact trade execution history log (`Entry/Exit` driven by gates & Chikou momentum), and exact equity curve comparison
  - `Ichimoku Terminal`: Denoised $\tanh$ oscillator chart alongside raw and Ehlers 2-pole SuperSmoother IIR cloud curves (`S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`), $1:1$ verified performance cards ($22/22$ assertions), exact trade execution log (`13 trades`), and exact reference equity curves (`ichi_cum_strat` vs `ichi_cum_market`)
