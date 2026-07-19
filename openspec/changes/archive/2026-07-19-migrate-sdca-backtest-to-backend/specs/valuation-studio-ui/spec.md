## ADDED Requirements

### Requirement: SDCA Chart Consumption
The Valuation Studio UI SHALL fetch SDCA backtest data from the backend API instead of using the local `useSdcaBacktest` client-side engine.

#### Scenario: Rendering SDCA Equity Curve
- **WHEN** the Valuation Studio loads
- **THEN** it fetches the pre-calculated SDCA results from the Hono API Gateway and binds the data to the Lightweight Charts, ensuring 85px Y-axis width lock is maintained.
