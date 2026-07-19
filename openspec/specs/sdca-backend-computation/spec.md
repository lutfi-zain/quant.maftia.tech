# sdca-backend-computation Specification

## Purpose

TBD - created by archiving change fix-price-source-and-audit-backend. Update Purpose after archive.

## Requirements

### Requirement: SDCA Signal Computation Endpoint

The API gateway SHALL expose `POST /api/v1/sdca/signal` that computes SDCA signals server-side using the same algorithm as `web/src/lib/sdcaEngine.ts`.

#### Scenario: Signal computation for date range

- **WHEN** a client calls `POST /api/v1/sdca/signal` with body `{"start_date": "2020-01-01", "end_date": "2024-12-31"}`
- **THEN** the response SHALL contain an array of `SdcaSignal` objects with fields: `date`, `multiplier`, `phase`, `action`, `confidence`, `pricePercentile`, `trendPositive`

#### Scenario: Single date signal lookup

- **WHEN** a client calls `POST /api/v1/sdca/signal` with body `{"date": "2024-06-15"}`
- **THEN** the response SHALL contain a single `SdcaSignal` object for that date

#### Scenario: Causal enforcement

- **WHEN** the endpoint computes a signal for date `D`
- **THEN** it SHALL only use data from dates `< D` (strict t-1 causal boundary)

#### Scenario: Invalid date range

- **WHEN** a client calls `POST /api/v1/sdca/signal` with `start_date > end_date`
- **THEN** the endpoint SHALL return HTTP 400 with `{"error": "start_date must be <= end_date"}`

### Requirement: SDCA Backtest Endpoint

The API gateway SHALL expose `POST /api/v1/sdca/backtest` that runs a full SDCA backtest server-side.

#### Scenario: Backtest with default parameters

- **WHEN** a client calls `POST /api/v1/sdca/backtest` with body `{"start_date": "2020-01-01", "end_date": "2024-12-31"}`
- **THEN** the response SHALL contain `metrics` (sharpeRatio, totalReturn, maxDrawdown, etc.), `equity_curve` (array of `{date, sdca, simpleDca, buyHold}`), `trade_log`, and `signals`

#### Scenario: Custom parameters

- **WHEN** a client provides `fee_bps`, `base_dca_amount`, or `initial_cash` in the request body
- **THEN** the backtest SHALL use those values instead of defaults (10 bps, $100, $10,000)

#### Scenario: Backtest with preset

- **WHEN** a client calls `POST /api/v1/sdca/backtest` with `preset: "conservative"`
- **THEN** the backtest SHALL use optimized thresholds: buy=-0.5, sell=+1.5

#### Scenario: Backtest with custom thresholds

- **WHEN** a client provides `buy_threshold: -0.8` and `sell_threshold: +1.2`
- **THEN** the backtest SHALL use those thresholds instead of defaults
- **AND** the response SHALL include the resolved `thresholds` object

### Requirement: Shared SDCA Engine Module

The SDCA engine logic SHALL be extracted from `web/src/lib/sdcaEngine.ts` into a shared module at `src/lib/sdcaEngine.ts` that both the API gateway and frontend import.

#### Scenario: Backend imports shared module

- **WHEN** the API gateway needs to compute SDCA signals
- **THEN** it SHALL import from `src/lib/sdcaEngine.ts` (same module used by frontend)

#### Scenario: Frontend imports shared module

- **WHEN** the frontend needs to compute SDCA signals for interactive exploration
- **THEN** it SHALL import from the same `src/lib/sdcaEngine.ts` module

### Requirement: SDCA Portfolio Server-Side State

The system SHALL store SDCA portfolio state in a server-side SQLite table `sdca_portfolios` with columns: `id`, `user_key`, `btc_balance`, `cash_balance`, `avg_cost_basis`, `total_invested`, `total_fees_paid`, `updated_at`. Portfolio operations SHALL require an `X-API-Key` header for authentication.

#### Scenario: Portfolio persistence

- **WHEN** a portfolio state is saved via `POST /api/v1/portfolio/save` with valid `X-API-Key`
- **THEN** the state SHALL be persisted in `sdca_portfolios` table with WAL mode

#### Scenario: Portfolio retrieval

- **WHEN** a client calls `GET /api/v1/portfolio/{user_key}` with valid `X-API-Key`
- **THEN** the response SHALL contain the current portfolio state or a default initial state if none exists

#### Scenario: Authentication failure

- **WHEN** a client calls a portfolio endpoint without or with invalid `X-API-Key`
- **THEN** the endpoint SHALL return HTTP 401 with `{"error": "Invalid or missing API key"}`

### Requirement: SDCA Transaction Audit Log

The system SHALL store all SDCA portfolio transactions in a server-side SQLite table `sdca_transactions` with columns: `id`, `user_key`, `timestamp`, `action` (BUY/SELL/SELL_ALL), `multiplier`, `phase`, `amount_usd`, `fee_usd`, `btc_amount`, `price`, `btc_balance_after`, `cash_balance_after`.

#### Scenario: Transaction logged on buy

- **WHEN** a portfolio buy is executed via `POST /api/v1/portfolio/buy`
- **THEN** a new row SHALL be inserted into `sdca_transactions` with all transaction details

#### Scenario: Transaction audit query

- **WHEN** a client calls `GET /api/v1/portfolio/{user_key}/transactions`
- **THEN** the response SHALL contain all transactions for that user ordered by timestamp DESC
