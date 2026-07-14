# ichimoku-chart-rebuild Specification (Delta)

## MODIFIED Requirements

### Requirement: Equity Curve Subplot Uses API Reference Data and 4-Pane Layout

The equity curve subplot (Pane 4 in the 4-pane layout) SHALL render two line series sourced from API-provided reference equity fields:

- `ichimoku_cum_strat` — green (`#22C55E`), labeled "Cum_Strat (Reference)"
- `ichimoku_cum_market` — blue (`#3B82F6`), labeled "Cum_Market (BTC Reference)"

The interactive `useStudioBacktest` curve SHALL be preserved as a toggleable overlay labeled "Interactive (What-If)", NOT as the default data source.

The metrics grid above the equity curve SHALL display reference metrics computed from `ichimoku_strat_net_ret` by default. When the interactive toggle is activated, the metrics grid SHALL switch to displaying interactive-computed metrics.

#### Scenario: Pane 4 shows reference equity by default

- **WHEN** IchimokuTerminal mounts with `dailyData` containing populated `ichimoku_cum_strat` and `ichimoku_cum_market`
- **THEN** the equity subplot SHALL display two line series with the reference labels
- **AND** the interactive backtest curve SHALL NOT be visible by default

#### Scenario: Metrics grid defaults to reference values

- **WHEN** IchimokuTerminal mounts with data containing non-null `ichimoku_strat_net_ret`
- **THEN** the metrics grid SHALL display reference-computed metrics
- **AND** the displayed Win Rate, Sharpe Ratio, Max Drawdown etc. SHALL match `calculate_metrics()` from the prior system within tolerance

#### Scenario: Interactive backtest renders on user toggle

- **WHEN** the user clicks a toggle button labeled "Show What-If"
- **THEN** the `useStudioBacktest` curve SHALL appear as a third line series with label "Interactive (What-If)"
- **AND** the reference curves SHALL remain visible
- **AND** the metrics grid SHALL switch to displaying interactive-computed metrics

#### Scenario: Vertical crosshair synchronization and 85px Y-axis lock maintained across all 4 panes

- **WHEN** the user moves the cursor over any of the 4 panes (`btcChart`, `oscChart`, `sCompChart`, `eqChart`)
- **THEN** vertical crosshairs (`syncCrosshairs`) SHALL align perfectly across all panes without horizontal time-tick drift due to strict `rightPriceScale: { minimumWidth: 85 }` width locking

### Requirement: Ichimoku Studio Incorporates Dedicated Trading Subplot and Table

The `IchimokuTerminal` component SHALL incorporate the client-side dynamic `useStudioBacktest` engine to render a dedicated 4th equity curve subplot (`eqChart`) and a bottom completed trades log table (`trades-table`) with interactive date range and fee friction (`bps`) sliders.

The backtest engine SHALL support two modes:

- **Reference mode** (default): uses `ichimoku_strat_net_ret` and `ichimoku_active_pos` from the API for metric computation, producing values bit-exact with the Python backend
- **Interactive mode** (toggle): recomputes from `ichimoku_position × close × feeBps`, allowing fee friction exploration

#### Scenario: Dynamic calculation over user-selected start and end dates

- **WHEN** the user modifies start/end dates in `IchimokuTerminal`
- **THEN** the `eqChart` and `trades-table` recalculate in real-time without making redundant API requests, displaying exact cumulative returns and exit attributions for that window
- **AND** when in reference mode, the recalculated metrics SHALL match `calculate_metrics()` restricted to the same window
