## ADDED Requirements

### Requirement: Python SDCA Backtest Engine
The backend SHALL implement a Python engine to calculate SDCA portfolio metrics (equity, cash, btc balances) and trade logs based on `UnifiedDailyAnalytics`. It MUST enforce strict causal filtering (t-1) and use the true backend convention where Positive = Undervalued and Negative = Overvalued.

#### Scenario: Backtest Execution
- **WHEN** the engine processes historical daily data
- **THEN** it generates a complete array of portfolio values, cumulative returns, max drawdown, and a list of all executed trades without lookahead bias.
