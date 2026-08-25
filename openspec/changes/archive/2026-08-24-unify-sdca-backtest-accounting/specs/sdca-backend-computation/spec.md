## MODIFIED Requirements

### Requirement: SDCA Backtest Endpoint

The API gateway and Python reporting pipeline SHALL compute identical SDCA backtests using standardized fixed capital pool accounting, causal t-1 signal execution, fee deductions (10 bps default), and identical performance metrics calculation (CAGR, totalReturn, sharpeRatio, sortinoRatio, maxDrawdown, winRate, profitFactor).

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

#### Scenario: Parity between Python batch script and TypeScript API

- **WHEN** `python3 scripts/calculate_sdca_backtest.py` and `POST /api/v1/sdca/backtest` run on the same dataset and thresholds
- **THEN** both SHALL produce identical equity curve trajectories, trade counts, and performance metrics within 0.01% floating precision
