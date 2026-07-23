## ADDED Requirements

### Requirement: Transaction Net PnL Calculation
The SDCA backtest engine SHALL calculate and return both net USD PnL and return percentage (`profit_pct`) for all executed trade log entries in the transaction ledger.

#### Scenario: Executing a trade exit or buy trade
- **WHEN** the SDCA backtest engine processes a buy or sell transaction
- **THEN** it SHALL attach non-null `profit_pct` and `net_pnl_usd` values to each `TradeLogEntry` and render them in the Causal Execution Log table.

### Requirement: Complete Backtest Performance Metrics Reporting
The SDCA backtest engine and Valuation Studio SHALL calculate and display complete performance metrics including Win Rate, Profit Factor, Total Trades, Strategy Sharpe Ratio, Benchmark Market Sharpe Ratio, CAGR, Annualized Volatility, Max Drawdown, Total Return, and Average Cost Basis.

#### Scenario: Rendering backtest summary cards
- **WHEN** Valuation Studio fetches or recalculates SDCA backtest results
- **THEN** all metric cards in the Backtest Config bar SHALL display valid non-zero statistical values without `NaN` or unhandled exceptions.

### Requirement: Synchronized Equity Curve Subplot Alignment
Valuation Studio SHALL format strategy equity (`cumStrat`) and buy & hold equity (`cumMarket`) data points to align 1-to-1 with daily dates on the main BTC price candlestick chart.

#### Scenario: Synchronizing crosshair and time ticks
- **WHEN** a user hovers or scrolls across the main price chart and equity curve subplots
- **THEN** both subplots SHALL align on identical date ticks without bar count mismatches or horizontal drift.
