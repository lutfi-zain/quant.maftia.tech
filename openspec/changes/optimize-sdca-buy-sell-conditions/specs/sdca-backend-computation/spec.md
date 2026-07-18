# SDCA Backend Computation — Delta Spec

## MODIFIED Requirements

### Requirement: SDCA Backtest Configuration

The system SHALL support configurable SDCA backtest parameters with optimized defaults based on grid search analysis.

**Correct Sign Convention:**

- **Positive composite (+1.0 to +2.0)**: Overvalued → SELL zone
- **Negative composite (-1.0 to -2.0)**: Undervalued → BUY zone

**Phase A: Corrected Defaults**

| Parameter | Current (WRONG) | Corrected | Rationale |
|-----------|-----------------|-----------|-----------|
| `buy_threshold` | +1.0 | -1.0 | Buy when entering undervaluation |
| `sell_threshold` | -1.0 | +1.0 | Sell when entering overvaluation |
| `price_pct_buy` | 25% | 25% | Unchanged |
| `price_pct_sell` | 80% | 80% | Unchanged |
| `extended_euphoria_days` | 30 | 30 | Unchanged |

**Phase B: Optimized Defaults**

| Parameter | Phase A | Phase B | Rationale |
|-----------|---------|---------|-----------|
| `buy_threshold` | -1.0 | -0.5 | Earlier accumulation |
| `sell_threshold` | +1.0 | +1.5 | Earlier profit-taking |
| `price_pct_buy` | 25% | 30% | More buying opportunities |
| `price_pct_sell` | 80% | 75% | Earlier exits |
| `extended_euphoria_days` | 30 | 25 | Faster response |

#### Scenario: Default backtest configuration (Phase A)

- **WHEN** running backtest with corrected parameters
- **THEN** system SHALL use:
  - `buy_threshold`: -1.0 (buy when composite ≤ -1.0)
  - `sell_threshold`: +1.0 (sell when composite ≥ +1.0)
  - `fee_bps`: 10
  - `base_dca_amount`: 100
  - `initial_cash`: 10000

#### Scenario: Default backtest configuration (Phase B)

- **WHEN** running backtest with optimized parameters
- **THEN** system SHALL use:
  - `buy_threshold`: -0.5 (earlier accumulation)
  - `sell_threshold`: +1.5 (earlier profit-taking)

#### Scenario: Custom backtest configuration

- **WHEN** user specifies custom parameters
- **THEN** system SHALL use provided values
- **AND** system SHALL validate parameters are within acceptable ranges:
  - `buy_threshold`: [-2.0, 0.0] (negative = buy zone)
  - `sell_threshold`: [0.0, +2.0] (positive = sell zone)
  - `fee_bps`: [0, 100]
  - `base_dca_amount`: [10, 10000]
  - `initial_cash`: [100, 1000000]

### Requirement: SDCA API Endpoints

The system SHALL provide RESTful API endpoints for SDCA signal computation and backtesting with parameter presets.

**Endpoints:**

1. `POST /api/v1/sdca/signal` — Compute SDCA signal for a specific date or date range
2. `POST /api/v1/sdca/backtest` — Run SDCA backtest with configurable parameters

**Parameter Presets (Phase B):**

| Preset Name | buy_threshold | sell_threshold | Description |
|-------------|---------------|----------------|-------------|
| `conservative` | -0.5 | +1.5 | Optimized for lower drawdown |
| `moderate` | -1.0 | +1.0 | Balanced risk/return |
| `aggressive` | -1.5 | +0.5 | Higher risk, higher potential return |

#### Scenario: Backtest with corrected parameters (Phase A)

- **WHEN** calling `POST /api/v1/sdca/backtest` without specifying thresholds
- **THEN** system SHALL use corrected parameters:
  - `buy_threshold`: -1.0 (buy when composite ≤ -1.0)
  - `sell_threshold`: +1.0 (sell when composite ≥ +1.0)

#### Scenario: Backtest with optimized parameters (Phase B)

- **WHEN** calling `POST /api/v1/sdca/backtest` with `preset: "conservative"`
- **THEN** system SHALL use:
  - `buy_threshold`: -0.5
  - `sell_threshold`: +1.5

#### Scenario: Backtest with custom parameters

- **WHEN** calling `POST /api/v1/sdca/backtest` with `buy_threshold: -0.8` and `sell_threshold: +1.2`
- **THEN** system SHALL use provided values instead of defaults

#### Scenario: Signal computation with corrected thresholds

- **WHEN** calling `POST /api/v1/sdca/signal` for date "2024-06-15"
- **THEN** system SHALL compute signal using corrected thresholds:
  - Buy trigger: composite ≤ -1.0
  - Sell trigger: composite ≥ +1.0

### Requirement: SDCA Metrics Computation

The system SHALL compute comprehensive SDCA backtest metrics including risk-adjusted returns, drawdown analysis, and trade statistics.

**Required Metrics:**

| Metric | Description | Formula |
|--------|-------------|---------|
| `sharpeRatio` | Annualized risk-adjusted return | `(mean_return × 365) / (std_return × √365)` |
| `sortinoRatio` | Downside risk-adjusted return | `(mean_return × 365) / (downside_std × √365)` |
| `totalReturn` | Total percentage return | `((final_equity / initial_cash) - 1) × 100` |
| `cagr` | Compound annual growth rate | `((final_equity / initial_cash)^(1/years) - 1) × 100` |
| `maxDrawdown` | Maximum peak-to-trough decline | `max((peak - equity) / peak)` |
| `winRate` | Percentage of profitable sells | `(profitable_sells / total_sells) × 100` |
| `profitFactor` | Ratio of gross profit to gross loss | `gross_profit / gross_loss` |
| `totalTrades` | Total number of trades | Count of BUY + SELL actions |

#### Scenario: Metrics computation with corrected strategy

- **WHEN** running backtest on 2015-2026 data
- **AND** using corrected thresholds (buy: -1.0, sell: +1.0)
- **THEN** system SHALL compute all required metrics
- **AND** metrics SHALL reflect correct DCA behavior (buying at bottoms, selling at tops)

#### Scenario: Trade log with profit tracking

- **WHEN** backtest completes
- **THEN** system SHALL generate trade log with:
  - Date, action (BUY/SELL), amount, price, multiplier
  - For SELL actions: profit percentage per trade

#### Scenario: Equity curve with comparison

- **WHEN** backtest completes
- **THEN** system SHALL generate equity curve with:
  - `sdca`: SDCA strategy equity
  - `simpleDca`: Simple DCA baseline equity
  - `buyHold`: Buy and hold baseline equity
