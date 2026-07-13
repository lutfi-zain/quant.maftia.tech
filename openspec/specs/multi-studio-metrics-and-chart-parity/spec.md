# multi-studio-metrics-and-chart-parity Specification

## Purpose
TBD - created by archiving change audit-all-studios-metrics-parity. Update Purpose after archive.
## Requirements
### Requirement: System-Wide Studio Metric Parity Against Python Engines
The frontend quantitative studios (`ValuationStudio.tsx`, `LttdLab.tsx`, and `MttdConsole.tsx`) SHALL strictly implement causal position friction ($R_{\text{strat}, t} = R_{\text{market}, t} \times \text{Position}_{t-1}$), exact state transition transaction cost deduction (`tc = abs(ActivePos[t] - ActivePos[t-1]) * feeRate`), compound annualized returns ($E_N^{(365.25 / N)} - 1$), annualized volatility ($\sigma_{\text{daily}} \times \sqrt{365.25}$), Sharpe ratio ($0\%$ risk-free assumption), and peak-to-trough Max Drawdown (`(peak - current) / peak`) matching canonical Python backend calculations exactly ($|a - b| < 10^{-6}$).

#### Scenario: Performance metric card calculation across Valuation, LTTD, and MTTD studios
- **WHEN** any quantitative studio (`Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`) loads historical daily data (`DailyAnalyticsPoint[]`) from `/api/v1/analytics/daily`
- **THEN** every calculated performance summary card (`Win Rate`, `Profit Factor`, `Total Trades`, `Sharpe Ratio`, `Max Drawdown`, `Ann Return Strat`, `Ann Volatility Strat`, `Ann Return Market`, `Ann Volatility Market`) SHALL match the corresponding Python backtest verification engine exact to within $|a - b| < 10^{-6}$ tolerance

### Requirement: Exact Trade Execution Logs (`trades`) across All Studios
Every quantitative studio (`Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) SHALL maintain and render an execution log of closed and open trades (`trades` array) that logs exact `entryDate`, `exitDate`, `entryPrice`, `exitPrice`, and `returnPct` corresponding strictly to state transitions (`0 -> 1` and `1 -> 0` or multi-state allocation changes).

#### Scenario: Trade log parity check
- **WHEN** a user opens the trade history execution table inside any studio
- **THEN** the total count of completed trades (`totalTrades`), win rate (`winRate`), profit factor (`profitFactor`), and individual trade records (`entryDate`, `exitDate`, `entryPrice`, `exitPrice`, `returnPct`) SHALL mirror the backend Python simulation exact integer counts and return ratios $1:1$

### Requirement: Exact Studio Equity Curves (`cumStrat` vs `cumMarket`)
Every quantitative studio (`Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`) SHALL render exact cumulative strategy equity curves (`cumStrat`) and market benchmark equity curves (`cumMarket`) on dedicated subplots or multi-line comparison charts without re-basing drift or lookahead bias ($t-1$ stamp verification).

#### Scenario: Equity curve calculation and alignment
- **WHEN** `cumStrat` and `cumMarket` series are calculated dynamically or loaded from `unified_daily_analytics` canonical fields
- **THEN** each daily equity point SHALL exactly equal $(1 + R_{\text{net}, t}) \times \text{Equity}_{t-1}$ across the entire selected date window, matching backend verification outputs with $|a - b| < 10^{-6}$

### Requirement: Vertical Crosshair Synchronization and $85\text{px}$ Y-Axis Width Lock across All Studios
Every Lightweight Charts (`v5.2`) subplot container across `ValuationStudio.tsx`, `LttdLab.tsx`, `MttdConsole.tsx`, and `IchimokuTerminal.tsx` SHALL explicitly enforce `rightPriceScale: { minimumWidth: 85 }` on desktop viewports (`≥768px`) and implement bidirectional real-time Vertical Crosshair Synchronization across all vertically stacked panes (`subscribeCrosshairMove` and `setCrosshairPosition`).

#### Scenario: Crosshair dragging across Valuation, LTTD, and MTTD studio subplots
- **WHEN** a user hovers or drags the crosshair over any subplot within `Valuation Pillar Studio`, `LTTD Lab`, or `MTTD Console`
- **THEN** all accompanying subplots within that studio (`MasterOHLCV`, `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `Equity Curve`) MUST simultaneously align their vertical crosshair line and tooltips at the exact date index while keeping the right Y-axis width locked strictly to $85\text{px}$ without horizontal tick drift

