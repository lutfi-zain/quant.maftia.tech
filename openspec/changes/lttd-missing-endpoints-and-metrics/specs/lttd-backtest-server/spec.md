## ADDED Requirements

### Requirement: Backend shall provide /api/v1/lttd/backtest endpoint

The system SHALL expose a `GET /api/v1/lttd/backtest` endpoint that computes performance metrics server-side from `unified_daily_analytics` data within the requested date range. Query parameters: `start` (YYYY-MM-DD), `end` (YYYY-MM-DD), `fee_bps` (integer, default 10).

#### Scenario: Returns backtest metrics

- **WHEN** client sends `GET /api/v1/lttd/backtest?start=2023-01-01&end=2025-12-31&fee_bps=10`
- **THEN** response status is `200` with body containing:
  - `date_range`: `{ start, end }`
  - `config`: `{ fee_bps }`
  - `metrics`: `{ winRate, profitFactor, totalTrades, sharpeRatio, sharpeRatioMarket, annReturnStrat, annReturnMarket, annVolatilityStrat, annVolatilityMarket, maxDrawdown, maxDrawdownMarket, totalReturnStrat, totalReturnMarket, sortinoRatio, cagrStrat, cagrMarket }`
  - `trade_log`: array of `{ id, entryDate, entryPrice, exitDate, exitPrice, holdDays, exitReason, returnPct }`
  - `equity_curve`: array of `{ date, strat, market }`

#### Scenario: Backtest algorithm

- **WHEN** computing backtest metrics
- **THEN** position is determined by `lttd_regime`: BULL → 1.0, BEAR → 0.0, SIDEWAYS → 0.0
- **THEN** daily return = position.shift(1) × btc_simple_return − fee_bps/10000 per trade (entry + exit)
- **THEN** trade entries occur when position goes from 0 to >0; exits when position goes from >0 to 0
- **THEN** equity curve is cumulative product of (1 + strat_return), starting at 1.0
- **THEN** Sharpe ratio = sqrt(365) × mean(excess_return) / std(excess_return)
- **THEN** Max drawdown = max((peak - equity) / peak)
- **THEN** Win rate = winning trades / total trades × 100

#### Scenario: Missing data returns empty result

- **WHEN** no data exists in the requested date range
- **THEN** response status is `200` with `metrics` containing zeros and empty `trade_log`
