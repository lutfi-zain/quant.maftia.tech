## ADDED Requirements

### Requirement: SDCA API Gateway Route
The Hono v4 API Gateway (`:8910`) SHALL expose an endpoint to serve the computed SDCA backtest results. It MUST return the data in a format immediately usable by the frontend Lightweight Charts without further complex data manipulation.

#### Scenario: Fetching Backtest Data
- **WHEN** a client requests the SDCA backtest endpoint
- **THEN** the API returns a JSON payload containing `dailyRecords`, `trades`, and `metrics` (CAGR, Sharpe, MaxDD).
