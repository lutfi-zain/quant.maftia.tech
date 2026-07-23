# sdca-backend-computation Specification Delta

## MODIFIED Requirements

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

#### Scenario: Backtest with hysteresis strategy thresholds

- **WHEN** a client provides `thresholds: { dca_in_start: 1.8, all_in_val: 1.5, dca_out_start: -1.5, all_out_val: 0.0 }` in request body
- **THEN** the backtest engine SHALL execute the 4-phase Hysteresis State Machine (`OUT_ALL` → `DCA_IN` → `ALL_IN` → `DCA_OUT` → `OUT_ALL`)
- **AND** calculate equity curves, trade logs, and metrics enforcing strict $t-1$ causal filtering

## ADDED Requirements

### Requirement: Hysteresis State Machine Signal Computation

The shared SDCA engine (`src/lib/sdcaEngine.ts` and `src/lib/sdcaBacktest.ts`) SHALL implement a 4-state Hysteresis State Machine tracking macro cycles across `valuation_composite`:
1. `OUT_ALL` transitions to `DCA_IN` when `valuation_composite >= dca_in_start`
2. `DCA_IN` transitions to `ALL_IN` when `valuation_composite <= all_in_val`
3. `ALL_IN` transitions to `DCA_OUT` when `valuation_composite <= dca_out_start`
4. `DCA_OUT` transitions to `OUT_ALL` when `valuation_composite >= all_out_val`

#### Scenario: Hysteresis state transition execution
- **WHEN** `computeSdcaSignals()` processes daily records with threshold parameters `{ dca_in_start: 1.8, all_in_val: 1.5, dca_out_start: -1.5, all_out_val: 0.0 }`
- **THEN** signals SHALL reflect `DCA_IN` when composite crosses above `+1.8`, `ALL_IN` when dropping below `+1.5` after `DCA_IN`, `DCA_OUT` when dropping below `-1.5`, and `OUT_ALL` when rising above `0.0` after `DCA_OUT`

#### Scenario: Causal $t-1$ enforcement for state transitions
- **WHEN** computing state transitions for day `t`
- **THEN** the engine SHALL use `valuation_composite` from day `t-1` to prevent lookahead bias
