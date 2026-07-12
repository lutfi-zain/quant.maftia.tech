# ichimoku-chart-rebuild Specification (Delta)

## MODIFIED Requirements

### Requirement: Ichimoku Terminal reconstructs Tenkan/Kijun from OHLCV client-side

**FROM (original):**
Because `unified_daily_analytics` does not return raw Tenkan-sen and Kijun-sen values, the `IchimokuTerminal` component SHALL compute these client-side from the `master_ohlcv` `high`/`low` arrays in `dailyData` using standard Ichimoku periods: Tenkan=9, Kijun=26, Senkou B=52, Chikou displacement=26.

**TO (updated):**
The IchimokuTerminal SHALL read Tenkan-sen, Kijun-sen, Senkou Span A, Senkou Span B, and Chikou Span values from the API-provided `DailyAnalyticsPoint` fields (`ichimoku_tenkan`, `ichimoku_kijun`, `ichimoku_senkou_a`, `ichimoku_senkou_b`, `ichimoku_chikou`) instead of computing them client-side.

Client-side Ichimoku line computation (`computeIchimokuLines()`) SHALL be removed. The FE SHALL NOT recompute Ichimoku cloud components from OHLCV data.

#### Scenario: Tenkan/Kijun lines render from API data

- **WHEN** IchimokuTerminal loads with `dailyData` containing `ichimoku_tenkan`, `ichimoku_kijun` values
- **THEN** Tenkan (red, `#F87171`) and Kijun (blue, `#60A5FA`) lines SHALL be drawn using API-provided values
- **AND** the chart SHALL filter out NULL values (warmup period) using `filter(d => d.value != null)`

#### Scenario: Span A and Span B rendered from API data

- **WHEN** IchimokuTerminal loads
- **THEN** Span A (green, 25% opacity, `rgba(34,197,94,0.35)`) and Span B (red, 25% opacity, `rgba(239,68,68,0.35)`) lines SHALL be drawn using `ichimoku_senkou_a` and `ichimoku_senkou_b` from API

#### Scenario: Chikou Span rendered from API data

- **WHEN** IchimokuTerminal loads
- **THEN** the Chikou Span (violet, 55% opacity, `rgba(168,85,247,0.55)`, line style Dotted) SHALL be drawn using `ichimoku_chikou` from API

### Requirement: Equity Curve Subplot Uses API Reference Data

[REQUIREMENT ADDED]
The equity curve subplot (Pane 4) SHALL render two line series sourced from API-provided reference equity fields:

- `ichimoku_cum_strat` — green (`#22C55E`), labeled "Cum_Strat (Reference)"
- `ichimoku_cum_market` — blue (`#3B82F6`), labeled "Cum_Market (BTC Reference)"

The interactive `useStudioBacktest` curve SHALL be preserved as a toggleable overlay labeled "Interactive (What-If)", NOT as the default data source.

#### Scenario: Pane 4 shows reference equity by default

- **WHEN** IchimokuTerminal mounts with `dailyData` containing populated `ichimoku_cum_strat` and `ichimoku_cum_market`
- **THEN** the equity subplot SHALL display two line series with the reference labels
- **AND** the interactive backtest curve SHALL NOT be visible by default

#### Scenario: Interactive backtest renders on user toggle

- **WHEN** the user clicks a toggle button labeled "Show What-If"
- **THEN** the `useStudioBacktest` curve SHALL appear as a third line series with label "Interactive (What-If)"
- **AND** the reference curves SHALL remain visible
